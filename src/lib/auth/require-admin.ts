import { createClient } from "@/lib/supabase/server";

/** Confirma no servidor que a sessão pertence a um administrador (usado pelas Server Actions restritas) */
export async function requireAdmin() {
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

  return { user, supabase };
}
