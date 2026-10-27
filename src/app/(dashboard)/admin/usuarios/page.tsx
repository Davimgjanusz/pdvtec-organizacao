import type { Metadata } from "next";
import { UsersManager } from "@/components/admin/users-manager";

export const metadata: Metadata = {
  title: "Gestão de Usuários",
};

export default function AdminUsuariosPage() {
  return <UsersManager />;
}
