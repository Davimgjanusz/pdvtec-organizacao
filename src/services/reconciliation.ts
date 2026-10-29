"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/require-admin";
import { monthBounds, reconcile, type ExpectedContract } from "@/lib/reconciliation";
import {
  reconciliationKeySchema,
  reconciliationPayloadSchema,
  type ReconciliationPayload,
} from "@/lib/validations/schemas";
import type { FinancialReconciliation } from "@/types/database";

const RECONCILIATION_SELECT = "*, contract:contracts(id, contract_number, client:clients(corporate_name, cnpj))";

export interface ReconciliationBatch {
  partner_name: string;
  reference_month: string;
  imported_at: string;
  total: number;
}

/**
 * Cruza as linhas da planilha do parceiro com os contratos vigentes no mês de referência
 * e grava o resultado, substituindo uma conciliação anterior do mesmo parceiro/mês.
 */
export async function reconcileSpreadsheetAction(payload: ReconciliationPayload) {
  const auth = await requireAdmin();
  if ("error" in auth) return { error: auth.error };

  const parsed = reconciliationPayloadSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { partner_name, reference_month, rows } = parsed.data;
  const { start, end } = monthBounds(reference_month);
  const { supabase, user } = auth;

  // Contratos que deveriam ser cobrados no mês: vigentes no período e não cancelados
  const { data: contracts, error: contractsError } = await supabase
    .from("contracts")
    .select("id, client_id, monthly_amount, client:clients(corporate_name, trade_name, cnpj)")
    .neq("status", "cancelled")
    .lte("start_date", end)
    .gte("end_date", start);

  if (contractsError) return { error: "Erro ao carregar os contratos para a conciliação." };

  const expected: ExpectedContract[] = (contracts ?? []).flatMap((c) => {
    const client = (Array.isArray(c.client) ? c.client[0] : c.client) as
      | { corporate_name: string; trade_name: string | null; cnpj: string }
      | null;
    if (!client) return [];
    return [
      {
        contract_id: c.id as string,
        client_id: c.client_id as string,
        corporate_name: client.corporate_name,
        trade_name: client.trade_name,
        cnpj: client.cnpj,
        monthly_amount: Number(c.monthly_amount ?? 0),
      },
    ];
  });

  const results = reconcile(rows, expected);

  const { error: deleteError } = await supabase
    .from("financial_reconciliations")
    .delete()
    .eq("partner_name", partner_name)
    .eq("reference_month", reference_month);

  if (deleteError) return { error: "Erro ao substituir a conciliação anterior deste parceiro/mês." };

  const { data, error } = await supabase
    .from("financial_reconciliations")
    .insert(results.map((r) => ({ ...r, partner_name, reference_month, imported_by: user.id })))
    .select(RECONCILIATION_SELECT);

  if (error) return { error: "Erro ao salvar o resultado da conciliação." };

  const summary = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  await logAudit({
    action: "reconcile",
    tableName: "financial_reconciliations",
    recordId: data?.[0]?.id ?? user.id,
    details: { partner_name, reference_month, rows: rows.length, summary },
  });

  revalidatePath("/dashboard/financeiro/conciliacao");
  return { data: (data ?? []) as FinancialReconciliation[] };
}

/** Conciliações já gravadas, agrupadas por parceiro e mês (mais recentes primeiro) */
export async function listReconciliationBatchesAction(): Promise<{ data?: ReconciliationBatch[]; error?: string }> {
  const auth = await requireAdmin();
  if ("error" in auth) return { error: auth.error };

  const { data, error } = await auth.supabase
    .from("financial_reconciliations")
    .select("partner_name, reference_month, imported_at")
    .order("imported_at", { ascending: false })
    .limit(10000);

  if (error) return { error: "Erro ao carregar o histórico de conciliações." };

  const batches = new Map<string, ReconciliationBatch>();
  for (const row of data ?? []) {
    const key = `${row.reference_month}|${row.partner_name}`;
    const batch = batches.get(key);
    if (batch) batch.total += 1;
    else batches.set(key, { ...row, total: 1 } as ReconciliationBatch);
  }

  return {
    data: [...batches.values()].sort(
      (a, b) => b.reference_month.localeCompare(a.reference_month) || a.partner_name.localeCompare(b.partner_name)
    ),
  };
}

export async function getReconciliationAction(partnerName: string, referenceMonth: string) {
  const auth = await requireAdmin();
  if ("error" in auth) return { error: auth.error };

  const parsed = reconciliationKeySchema.safeParse({ partner_name: partnerName, reference_month: referenceMonth });
  if (!parsed.success) return { error: "Conciliação inválida." };

  const { data, error } = await auth.supabase
    .from("financial_reconciliations")
    .select(RECONCILIATION_SELECT)
    .eq("partner_name", parsed.data.partner_name)
    .eq("reference_month", parsed.data.reference_month)
    .order("status")
    .order("client_name_external");

  if (error) return { error: "Erro ao carregar a conciliação." };
  return { data: (data ?? []) as FinancialReconciliation[] };
}
