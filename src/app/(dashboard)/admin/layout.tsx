import { AdminOnly } from "@/components/auth/admin-guard";

// Toda a área /admin é exclusiva de administradores
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminOnly>{children}</AdminOnly>;
}
