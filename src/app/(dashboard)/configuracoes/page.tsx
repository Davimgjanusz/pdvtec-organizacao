"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { AuditLog } from "@/types/database";
import { formatDateTime } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Loader2,
  Users,
  History,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { toast } from "@/lib/notify";

export default function ConfiguracoesPage() {
  const { profile } = useAuth();

  if (profile?.role !== "admin") {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Administração do sistema</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Usuários e cargos</p>
              <p className="text-sm text-muted-foreground">Cadastre colaboradores e gerencie permissões de acesso.</p>
            </div>
          </div>
          <Button render={<Link href="/admin/usuarios" />} nativeButton={false} variant="outline">
            Gerenciar usuários
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <History className="h-4 w-4" />
          Auditoria
        </h2>
        <AuditPanel />
      </div>
    </div>
  );
}

function AuditPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  useEffect(() => {
    let ignore = false;
    const supabase = createClient();
    let query = supabase
      .from("audit_logs")
      .select("*, user:profiles(*)")
      .order("created_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (search) {
      query = query.or(`action.ilike.%${search}%,table_name.ilike.%${search}%`);
    }

    query.then(({ data, error }) => {
      if (ignore) return;
      if (error) toast.error("Erro ao carregar os registros de auditoria.", { id: "carregar-auditoria" });
      setLogs((data ?? []) as AuditLog[]);
      setLoading(false);
    });

    return () => {
      ignore = true;
    };
  }, [page, search]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por ação ou tabela..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); setLoading(true); }}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Nenhum registro de auditoria encontrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Tabela</TableHead>
                    <TableHead className="hidden md:table-cell">ID Registro</TableHead>
                    <TableHead className="hidden lg:table-cell">Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">{formatDateTime(log.created_at)}</TableCell>
                      <TableCell>{log.user?.full_name ?? "Sistema"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.table_name}</TableCell>
                      <TableCell className="hidden md:table-cell font-mono text-xs truncate max-w-[120px]">
                        {log.record_id}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs max-w-[200px] truncate">
                        {log.details ? JSON.stringify(log.details) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => { setPage((p) => Math.max(0, p - 1)); setLoading(true); }}
          disabled={page === 0}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">Página {page + 1}</span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => { setPage((p) => p + 1); setLoading(true); }}
          disabled={logs.length < pageSize}
          aria-label="Próxima página"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
