"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import {
  createUserSchema,
  updateUserRoleSchema,
  type CreateUserFormData,
} from "@/lib/validations/schemas";
import type { UserRole } from "@/types/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export interface ManagedUser {
  id: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  created_at: string;
  last_sign_in_at: string | null;
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Acesso restrito a administradores." };

  return { user };
}

async function getServiceClient() {
  try {
    return { client: await createServiceClient() };
  } catch {
    return { error: "Chave de serviço do Supabase (SUPABASE_SERVICE_ROLE_KEY) não configurada." };
  }
}

export async function listUsersAction(): Promise<{ data?: ManagedUser[]; error?: string }> {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return { error: adminCheck.error };

  const service = await getServiceClient();
  if (!service.client) return { error: service.error };

  const [{ data: profiles, error: profilesError }, { data: authData, error: authError }] = await Promise.all([
    service.client.from("profiles").select("id, full_name, role, created_at").order("full_name"),
    service.client.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  if (profilesError) return { error: "Erro ao carregar os perfis dos usuários." };
  if (authError) return { error: "Erro ao carregar os usuários do Supabase Auth." };

  const authById = new Map(authData.users.map((u) => [u.id, u]));

  return {
    data: (profiles ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      role: p.role as UserRole,
      created_at: p.created_at,
      email: authById.get(p.id)?.email ?? null,
      last_sign_in_at: authById.get(p.id)?.last_sign_in_at ?? null,
    })),
  };
}

export async function createUserAction(formData: CreateUserFormData) {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return { error: adminCheck.error };

  const parsed = createUserSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const service = await getServiceClient();
  if (!service.client) return { error: service.error };
  const serviceClient = service.client;

  const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.full_name,
      role: parsed.data.role,
    },
  });

  if (authError) {
    if (authError.status === 422 || /already (been )?registered|already exists/i.test(authError.message)) {
      return { error: "Este e-mail já está cadastrado." };
    }
    if (/password/i.test(authError.message)) {
      return { error: "A senha provisória não atende à política de senhas do Supabase." };
    }
    return { error: "Não foi possível criar o usuário no Supabase Auth." };
  }

  if (!authData.user) return { error: "Erro inesperado ao criar usuário." };

  // O trigger on_auth_user_created já cria o perfil; o upsert garante nome e cargo corretos
  const { error: profileError } = await serviceClient.from("profiles").upsert(
    {
      id: authData.user.id,
      full_name: parsed.data.full_name,
      role: parsed.data.role,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    // Desfaz a criação no Auth para não deixar usuário sem perfil
    await serviceClient.auth.admin.deleteUser(authData.user.id);
    return { error: "Erro ao salvar o perfil do usuário. Nenhuma alteração foi mantida." };
  }

  await logAudit({
    action: "create",
    tableName: "profiles",
    recordId: authData.user.id,
    details: { email: parsed.data.email, role: parsed.data.role },
  });

  revalidatePath("/admin/usuarios");
  return { data: { id: authData.user.id, email: authData.user.email ?? parsed.data.email } };
}

export async function updateUserRoleAction(userId: string, newRole: UserRole) {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return { error: adminCheck.error };

  const parsedId = z.string().uuid().safeParse(userId);
  const parsed = updateUserRoleSchema.safeParse({ role: newRole });
  if (!parsedId.success || !parsed.success) return { error: "Dados inválidos." };

  if (userId === adminCheck.user.id && parsed.data.role !== "admin") {
    return { error: "Você não pode remover o seu próprio acesso de administrador." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", userId);

  if (error) return { error: "Erro ao atualizar cargo." };

  await logAudit({
    action: "update",
    tableName: "profiles",
    recordId: userId,
    details: { role: parsed.data.role },
  });

  revalidatePath("/admin/usuarios");
  return { success: true };
}
