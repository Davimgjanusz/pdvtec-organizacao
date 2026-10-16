"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const createUserSchema = z.object({
  full_name: z.string().min(1, "Nome completo é obrigatório").max(200),
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  role: z.enum(["admin", "comercial", "operacional"], {
    required_error: "Cargo é obrigatório",
  }),
});

export type CreateUserFormData = z.infer<typeof createUserSchema>;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Acesso restrito a administradores." };

  return { user };
}

export async function createUserAction(formData: CreateUserFormData) {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return { error: adminCheck.error };

  const parsed = createUserSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const serviceClient = await createServiceClient();

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
    if (authError.message.includes("already been registered")) {
      return { error: "Este e-mail já está cadastrado." };
    }
    return { error: `Erro ao criar usuário: ${authError.message}` };
  }

  if (!authData.user) return { error: "Erro inesperado ao criar usuário." };

  const { error: profileError } = await serviceClient
    .from("profiles")
    .upsert({
      id: authData.user.id,
      full_name: parsed.data.full_name,
      role: parsed.data.role,
    });

  if (profileError) {
    return { error: "Usuário criado no Auth, mas houve erro ao salvar o perfil." };
  }

  await logAudit({
    action: "create",
    tableName: "profiles",
    recordId: authData.user.id,
    details: { email: parsed.data.email, role: parsed.data.role },
  });

  revalidatePath("/configuracoes");
  return { data: authData.user };
}

export async function updateUserRoleAction(userId: string, newRole: string) {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return { error: adminCheck.error };

  if (!["admin", "comercial", "operacional"].includes(newRole)) {
    return { error: "Cargo inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", userId);

  if (error) return { error: "Erro ao atualizar cargo." };

  await logAudit({
    action: "update",
    tableName: "profiles",
    recordId: userId,
    details: { role: newRole },
  });

  revalidatePath("/configuracoes");
  return { success: true };
}
