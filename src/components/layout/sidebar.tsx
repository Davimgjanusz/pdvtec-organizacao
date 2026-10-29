"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  FolderOpen,
  KanbanSquare,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  UserCog,
  Scale,
} from "lucide-react";
import { cn, getRoleLabel } from "@/lib/utils";
import { LogoPDVTEC } from "@/components/layout/logo-pdvtec";
import { canAccessModule } from "@/lib/permissions";
import type { UserRole } from "@/types/database";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface SidebarProps {
  role: UserRole;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  { href: "/clientes", label: "Clientes", icon: Users, module: "clientes" },
  { href: "/propostas", label: "Propostas", icon: FileText, module: "propostas" },
  { href: "/contratos", label: "Contratos", icon: FolderOpen, module: "contratos" },
  { href: "/tarefas", label: "Tarefas", icon: KanbanSquare, module: "tarefas" },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, module: "relatorios" },
  { href: "/dashboard/financeiro/conciliacao", label: "Conciliação", icon: Scale, module: "financeiro" },
  { href: "/admin/usuarios", label: "Usuários", icon: UserCog, module: "admin" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, module: "configuracoes" },
];

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const filteredItems = navItems.filter((item) => canAccessModule(role, item.module));

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        <Link href="/dashboard" aria-label="Ir para o Dashboard">
          <LogoPDVTEC collapsed={collapsed} />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 shrink-0"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1" aria-label="Menu principal">
        {filteredItems.map((item) => {
          // Item mais específico vence: /dashboard não fica ativo dentro de /dashboard/financeiro/...
          const matches = (href: string) => pathname === href || pathname.startsWith(href + "/");
          const isActive =
            matches(item.href) && !filteredItems.some((other) => other.href.length > item.href.length && matches(other.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            <span>{getRoleLabel(role)}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
