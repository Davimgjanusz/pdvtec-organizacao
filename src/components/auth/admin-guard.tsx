import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

// Com Cache Components, a leitura da sessão (cookies) precisa ficar atrás de um <Suspense>
export function AdminOnly({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AdminGuard>{children}</AdminGuard>
    </Suspense>
  );
}

// Guarda no servidor: a rota protegida é exclusiva de administradores
async function AdminGuard({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  return <>{children}</>;
}
