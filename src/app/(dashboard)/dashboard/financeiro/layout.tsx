import { AdminOnly } from "@/components/auth/admin-guard";

// Módulo financeiro (conciliação) é exclusivo de administradores
export default function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  return <AdminOnly>{children}</AdminOnly>;
}
