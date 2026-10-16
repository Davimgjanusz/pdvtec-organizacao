"use server";

import { createClient } from "@/lib/supabase/server";
import { clientSchema, type ClientFormData } from "@/lib/validations/schemas";
import { normalizeCnpj } from "@/lib/validations/cnpj";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function getClients(search?: string) {
  const supabase = await createClient();

  let query = supabase
    .from("clients")
    .select("*")
    .order("corporate_name");

  if (search) {
    const normalized = normalizeCnpj(search);
    query = query.or(
      `corporate_name.ilike.%${search}%,trade_name.ilike.%${search}%,cnpj.ilike.%${normalized}%`
    );
  }

  const { data, error } = await query;
  if (error) throw new Error("Erro ao buscar clientes.");
  return data;
}

export async function getClient(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error("Cliente não encontrado.");
  return data;
}

export async function createClientAction(formData: ClientFormData) {
  const parsed = clientSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const supabase = await createClient();
  const cnpj = normalizeCnpj(parsed.data.cnpj);

  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("cnpj", cnpj)
    .maybeSingle();

  if (existing) {
    return { error: "CNPJ já cadastrado." };
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      ...parsed.data,
      cnpj,
      trade_name: parsed.data.trade_name || null,
      zip_code: parsed.data.zip_code || null,
      street: parsed.data.street || null,
      neighborhood: parsed.data.neighborhood || null,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
    })
    .select()
    .single();

  if (error) {
    return { error: "Erro ao cadastrar cliente." };
  }

  await logAudit({
    action: "create",
    tableName: "clients",
    recordId: data.id,
    details: { corporate_name: data.corporate_name, cnpj },
  });

  revalidatePath("/clientes");
  return { data };
}

export async function updateClientAction(id: string, formData: ClientFormData) {
  const parsed = clientSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const supabase = await createClient();
  const cnpj = normalizeCnpj(parsed.data.cnpj);

  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("cnpj", cnpj)
    .neq("id", id)
    .maybeSingle();

  if (existing) {
    return { error: "CNPJ já cadastrado para outro cliente." };
  }

  const { data, error } = await supabase
    .from("clients")
    .update({
      ...parsed.data,
      cnpj,
      trade_name: parsed.data.trade_name || null,
      zip_code: parsed.data.zip_code || null,
      street: parsed.data.street || null,
      neighborhood: parsed.data.neighborhood || null,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { error: "Erro ao atualizar cliente." };
  }

  await logAudit({
    action: "update",
    tableName: "clients",
    recordId: id,
    details: { corporate_name: data.corporate_name },
  });

  revalidatePath("/clientes");
  return { data };
}

export async function deleteClientAction(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("clients").delete().eq("id", id);

  if (error) {
    return { error: "Erro ao excluir cliente. Verifique se há propostas ou contratos vinculados." };
  }

  await logAudit({
    action: "delete",
    tableName: "clients",
    recordId: id,
  });

  revalidatePath("/clientes");
  return { success: true };
}
