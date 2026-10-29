"use server";

import { createClient } from "@/lib/supabase/server";
import {
  proposalSchema,
  proposalStatusChangeSchema,
  recordIdSchema,
  storagePathSchema,
  type ProposalFormData,
} from "@/lib/validations/schemas";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["sent", "cancelled"],
  sent: ["approved", "rejected", "cancelled"],
  approved: [],
  rejected: [],
  cancelled: [],
};

export async function getProposals(filters?: {
  search?: string;
  status?: string;
  clientId?: string;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("proposals")
    .select("*, client:clients(*), user:profiles(*)")
    .order("created_at", { ascending: false });

  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%`);
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.clientId) {
    query = query.eq("client_id", filters.clientId);
  }

  const { data, error } = await query;
  if (error) throw new Error("Erro ao buscar propostas.");
  return data;
}

export async function getProposal(id: string) {
  if (!recordIdSchema.safeParse(id).success) throw new Error("Identificador inválido.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proposals")
    .select("*, client:clients(*), user:profiles(*)")
    .eq("id", id)
    .single();
  if (error) throw new Error("Proposta não encontrada.");
  return data;
}

export async function createProposalAction(formData: ProposalFormData) {
  const parsed = proposalSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data, error } = await supabase
    .from("proposals")
    .insert({
      ...parsed.data,
      user_id: user.id,
      notes: parsed.data.notes || null,
      status: "draft",
    })
    .select()
    .single();

  if (error) return { error: "Erro ao criar proposta." };

  await logAudit({
    action: "create",
    tableName: "proposals",
    recordId: data.id,
    details: { title: data.title, client_id: data.client_id },
  });

  revalidatePath("/propostas");
  return { data };
}

export async function updateProposalAction(id: string, formData: ProposalFormData) {
  if (!recordIdSchema.safeParse(id).success) return { error: "Identificador inválido." };
  const parsed = proposalSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("proposals")
    .select("status")
    .eq("id", id)
    .single();

  if (!existing) return { error: "Proposta não encontrada." };
  if (existing.status !== "draft") return { error: "Apenas propostas em rascunho podem ser editadas." };

  const { data, error } = await supabase
    .from("proposals")
    .update({
      ...parsed.data,
      notes: parsed.data.notes || null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: "Erro ao atualizar proposta." };

  await logAudit({
    action: "update",
    tableName: "proposals",
    recordId: id,
    details: { title: data.title },
  });

  revalidatePath("/propostas");
  return { data };
}

export async function changeProposalStatusAction(
  id: string,
  newStatus: string,
  reason?: string
) {
  const parsed = proposalStatusChangeSchema.safeParse({ id, status: newStatus, reason });
  if (!parsed.success) return { error: "Status de proposta inválido." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("proposals")
    .select("status, title, client_id")
    .eq("id", id)
    .single();

  if (!existing) return { error: "Proposta não encontrada." };

  const allowed = VALID_TRANSITIONS[existing.status];
  if (!allowed?.includes(newStatus)) {
    return { error: `Transição de "${existing.status}" para "${newStatus}" não é permitida.` };
  }

  const { error } = await supabase
    .from("proposals")
    .update({ status: newStatus })
    .eq("id", id);

  if (error) return { error: "Erro ao alterar status." };

  await logAudit({
    action: `status_change_${newStatus}`,
    tableName: "proposals",
    recordId: id,
    details: {
      from: existing.status,
      to: newStatus,
      reason: reason ?? null,
    },
  });

  revalidatePath("/propostas");
  return { success: true, previousStatus: existing.status, clientId: existing.client_id };
}

export async function saveProposalDocument(proposalId: string, storagePath: string) {
  if (!recordIdSchema.safeParse(proposalId).success || !storagePathSchema.safeParse(storagePath).success) {
    return { error: "Documento inválido." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("proposals")
    .update({ document_path: storagePath })
    .eq("id", proposalId);

  if (error) return { error: "Erro ao salvar documento." };
  return { success: true };
}
