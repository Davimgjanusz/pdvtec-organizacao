"use server";

import { createClient } from "@/lib/supabase/server";
import {
  contractSchema,
  contractStatusChangeSchema,
  storagePathSchema,
  type ContractFormData,
} from "@/lib/validations/schemas";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function getContracts(filters?: {
  search?: string;
  status?: string;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("contracts")
    .select("*, client:clients(*), proposal:proposals(*)")
    .order("created_at", { ascending: false });

  if (filters?.search) {
    query = query.or(
      `contract_number.ilike.%${filters.search}%,client.corporate_name.ilike.%${filters.search}%`
    );
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) throw new Error("Erro ao buscar contratos.");
  return data;
}

export async function createContractAction(
  formData: ContractFormData,
  fileStoragePath: string
) {
  const parsed = contractSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();

  if (parsed.data.proposal_id) {
    const { data: existingContract } = await supabase
      .from("contracts")
      .select("id")
      .eq("proposal_id", parsed.data.proposal_id)
      .maybeSingle();

    if (existingContract) {
      return { error: "Já existe um contrato para esta proposta." };
    }
  }

  const { data: contractNumber } = await supabase.rpc("generate_contract_number");

  const { data, error } = await supabase
    .from("contracts")
    .insert({
      client_id: parsed.data.client_id,
      proposal_id: parsed.data.proposal_id || null,
      contract_number: contractNumber,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      monthly_amount: parsed.data.monthly_amount,
      file_storage_path: fileStoragePath,
      status: "active",
    })
    .select()
    .single();

  if (error) return { error: "Erro ao criar contrato." };

  await logAudit({
    action: "create",
    tableName: "contracts",
    recordId: data.id,
    details: { contract_number: contractNumber, client_id: parsed.data.client_id },
  });

  revalidatePath("/contratos");
  return { data };
}

export async function updateContractStatusAction(
  id: string,
  newStatus: string
) {
  const parsed = contractStatusChangeSchema.safeParse({ id, status: newStatus });
  if (!parsed.success) return { error: "Status de contrato inválido." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("contracts")
    .select("status")
    .eq("id", id)
    .single();

  if (!existing) return { error: "Contrato não encontrado." };

  const { error } = await supabase
    .from("contracts")
    .update({ status: newStatus })
    .eq("id", id);

  if (error) return { error: "Erro ao atualizar status." };

  await logAudit({
    action: `status_change_${newStatus}`,
    tableName: "contracts",
    recordId: id,
    details: { from: existing.status, to: newStatus },
  });

  revalidatePath("/contratos");
  return { success: true };
}

export async function getSignedDocumentUrl(storagePath: string) {
  const parsedPath = storagePathSchema.safeParse(storagePath);
  if (!parsedPath.success) return { error: "Documento inválido." };

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data, error } = await supabase.storage
    .from("pdvtec-documents")
    .createSignedUrl(parsedPath.data, 900);

  if (error || !data?.signedUrl) {
    return { error: "Não foi possível gerar o link temporário." };
  }

  return { url: data.signedUrl };
}
