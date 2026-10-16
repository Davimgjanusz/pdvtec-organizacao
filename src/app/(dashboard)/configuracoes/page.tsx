"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { createUserAction, updateUserRoleAction, type CreateUserFormData } from "@/services/users";
import type { AuditLog, Profile, UserRole } from "@/types/database";
import { formatDateTime } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Search,
  Loader2,
  Shield,
  Users,
  History,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

const createUserFormSchema = z.object({
  full_name: z.string().min(1, "Nome completo é obrigatório").max(200),
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  role: z.enum(["admin", "comercial", "operacional"], {
    required_error: "Cargo é obrigatório",
  }),
});

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

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <History className="h-4 w-4" />
            Auditoria
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4">
          <UsersPanel />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UsersPanel() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [newRole, setNewRole] = useState<UserRole>("operacional");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("profiles").select("*").order("full_name");
    setUsers(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleUpdateRole = async () => {
    if (!editingUser) return;
    const result = await updateUserRoleAction(editingUser.id, newRole);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Cargo atualizado!");
    setEditingUser(null);
    fetchUsers();
  };

  const roleColors: Record<string, string> = {
    admin: "bg-destructive/10 text-destructive",
    comercial: "bg-info/10 text-info",
    operacional: "bg-success/10 text-success",
  };

  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    comercial: "Comercial",
    operacional: "Operacional",
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold">Usuários do Sistema</h2>
        <Button onClick={() => setCreateDialogOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>
                      <Badge className={roleColors[user.role]}>
                        {roleLabels[user.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(user.created_at)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingUser(user);
                          setNewRole(user.role);
                        }}
                        title="Alterar cargo"
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog: alterar cargo */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Cargo — {editingUser?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cargo</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole((v ?? "operacional") as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="operacional">Operacional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
              <Button onClick={handleUpdateRole}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: criar usuário */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
          </DialogHeader>
          <CreateUserForm
            onSuccess={() => {
              setCreateDialogOpen(false);
              fetchUsers();
            }}
            onCancel={() => setCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreateUserForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      role: "operacional",
    },
  });

  return (
    <form
      onSubmit={handleSubmit(async (data) => {
        setLoading(true);
        const result = await createUserAction(data);
        if (result.error) {
          toast.error(result.error);
          setLoading(false);
          return;
        }
        toast.success("Usuário criado com sucesso!");
        onSuccess();
      })}
      className="space-y-4"
    >
      <div>
        <Label htmlFor="full_name">Nome Completo</Label>
        <Input id="full_name" {...register("full_name")} aria-invalid={!!errors.full_name} />
        {errors.full_name && <p className="text-sm text-destructive mt-1">{errors.full_name.message}</p>}
      </div>

      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" {...register("email")} aria-invalid={!!errors.email} />
        {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
      </div>

      <div>
        <Label htmlFor="password">Senha Provisória</Label>
        <Input id="password" type="password" {...register("password")} aria-invalid={!!errors.password} />
        {errors.password && <p className="text-sm text-destructive mt-1">{errors.password.message}</p>}
      </div>

      <div>
        <Label>Cargo</Label>
        <select
          {...register("role")}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="operacional">Operacional</option>
          <option value="comercial">Comercial</option>
          <option value="admin">Administrador</option>
        </select>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Cadastrar
        </Button>
      </div>
    </form>
  );
}

function AuditPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let query = supabase
      .from("audit_logs")
      .select("*, user:profiles(*)")
      .order("created_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (search) {
      query = query.or(`action.ilike.%${search}%,table_name.ilike.%${search}%`);
    }

    const { data } = await query;
    setLogs((data ?? []) as AuditLog[]);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por ação ou tabela..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
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
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">Página {page + 1}</span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setPage((p) => p + 1)}
          disabled={logs.length < pageSize}
          aria-label="Próxima página"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
