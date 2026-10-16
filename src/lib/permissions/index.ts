import type { UserRole } from "@/types/database";

type Permission =
  | "clients:create"
  | "clients:edit"
  | "clients:delete"
  | "proposals:view"
  | "proposals:create"
  | "proposals:edit"
  | "proposals:delete"
  | "proposals:change_status"
  | "contracts:create"
  | "contracts:edit"
  | "contracts:delete"
  | "contracts:upload"
  | "tasks:create"
  | "tasks:edit"
  | "tasks:delete"
  | "users:manage"
  | "audit:view";

const rolePermissions: Record<UserRole, Permission[]> = {
  admin: [
    "clients:create", "clients:edit", "clients:delete",
    "proposals:view", "proposals:create", "proposals:edit", "proposals:delete", "proposals:change_status",
    "contracts:create", "contracts:edit", "contracts:delete", "contracts:upload",
    "tasks:create", "tasks:edit", "tasks:delete",
    "users:manage",
    "audit:view",
  ],
  comercial: [
    "clients:create", "clients:edit",
    "proposals:view", "proposals:create", "proposals:edit", "proposals:change_status",
    "contracts:create", "contracts:edit", "contracts:upload",
  ],
  operacional: [
    "tasks:create", "tasks:edit",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function canAccessModule(role: UserRole, module: string): boolean {
  switch (module) {
    case "dashboard": return true;
    case "clientes": return true;
    case "propostas": return role === "admin" || role === "comercial";
    case "contratos": return true;
    case "tarefas": return true;
    case "relatorios": return role === "admin" || role === "comercial";
    case "configuracoes": return role === "admin";
    default: return false;
  }
}
