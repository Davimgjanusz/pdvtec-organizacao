"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/lib/notify";
import { Eye, EyeOff, KeyRound, Loader2, Plus, Search, Shield, UserPlus, Users } from "lucide-react";

import { createUserAction, listUsersAction, updateUserRoleAction, type ManagedUser } from "@/services/users";
import {
  createUserSchema,
  updateUserRoleSchema,
  type CreateUserFormData,
  type UpdateUserRoleFormData,
} from "@/lib/validations/schemas";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_OPTIONS, formatDateTime, getRoleLabel } from "@/lib/utils";
import { formatRelativeBR } from "@/lib/date";
import type { UserRole } from "@/types/database";

import { FieldError } from "@/components/forms/masked-inputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { OptionSelect } from "@/components/ui/option-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const roleColors: Record<UserRole, string> = {
  admin: "bg-destructive/10 text-destructive",
  comercial: "bg-info/10 text-info",
  operacional: "bg-success/10 text-success",
};

export function UsersManager() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const result = await listUsersAction();
      if (result.error) {
        setLoadError(result.error);
      } else {
        setLoadError(null);
        setUsers(result.data ?? []);
      }
    } catch {
      // Falha de rede/servidor: nunca deixar a tela presa no carregamento
      setLoadError("Não foi possível carregar os usuários. Verifique a conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  const retry = () => {
    setLoading(true);
    setLoadError(null);
    fetchUsers();
  };

  useEffect(() => {
    // Todos os setState de fetchUsers ocorrem após o await
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!term) return true;
      return u.full_name.toLowerCase().includes(term) || (u.email ?? "").toLowerCase().includes(term);
    });
  }, [users, search, roleFilter]);

  const countByRole = useMemo(
    () =>
      users.reduce<Record<string, number>>((acc, u) => {
        acc[u.role] = (acc[u.role] ?? 0) + 1;
        return acc;
      }, {}),
    [users]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Usuários</h1>
          <p className="text-muted-foreground">Cadastre colaboradores e defina o cargo de acesso ao sistema</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <SummaryCard label="Total de colaboradores" value={users.length} />
        {ROLE_OPTIONS.map((r) => (
          <SummaryCard key={r.value} label={r.label} value={countByRole[r.value] ?? 0} />
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Buscar usuários"
          />
        </div>
        <OptionSelect
          value={roleFilter}
          onValueChange={setRoleFilter}
          className="sm:w-[200px]"
          aria-label="Filtrar por cargo"
          options={[{ value: "all", label: "Todos os cargos" }, ...ROLE_OPTIONS]}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center" role="alert">
              <p className="text-sm text-destructive">{loadError}</p>
              <Button variant="outline" size="sm" onClick={retry}>
                Tentar novamente
              </Button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Users className="h-8 w-8" />
              Nenhum colaborador encontrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">E-mail</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="hidden lg:table-cell">Último acesso</TableHead>
                  <TableHead className="hidden lg:table-cell">Cadastrado em</TableHead>
                  <TableHead className="w-[80px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.full_name}
                      {user.id === profile?.id && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}
                      <div className="text-xs text-muted-foreground md:hidden">{user.email}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{user.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={roleColors[user.role]}>{getRoleLabel(user.role)}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {user.last_sign_in_at ? formatRelativeBR(user.last_sign_in_at) : "Nunca acessou"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{formatDateTime(user.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingUser(user)}
                        aria-label={`Alterar cargo de ${user.full_name}`}
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
            <DialogDescription>
              O colaborador poderá entrar imediatamente com a senha provisória informada.
            </DialogDescription>
          </DialogHeader>
          <CreateUserForm
            onSuccess={() => {
              setCreateOpen(false);
              fetchUsers();
            }}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Cargo</DialogTitle>
            <DialogDescription>{editingUser?.full_name}</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <RoleForm
              user={editingUser}
              onSuccess={(role) => {
                setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? { ...u, role } : u)));
                setEditingUser(null);
              }}
              onCancel={() => setEditingUser(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card size="sm">
      <CardContent>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const values = crypto.getRandomValues(new Uint32Array(10));
  const base = Array.from(values, (v) => chars[v % chars.length]).join("");
  // Garante ao menos uma letra e um número
  return `${base}${(values[0] % 8) + 2}a`;
}

function CreateUserForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { full_name: "", email: "", password: "", role: "operacional" },
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit(async (data) => {
        const result = await createUserAction(data);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(`Usuário ${data.full_name} cadastrado com sucesso!`);
        onSuccess();
      })}
      className="space-y-4"
    >
      <div>
        <Label htmlFor="full_name">Nome completo</Label>
        <Input id="full_name" autoComplete="off" {...register("full_name")} aria-invalid={!!errors.full_name} />
        <FieldError message={errors.full_name?.message} />
      </div>

      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" autoComplete="off" {...register("email")} aria-invalid={!!errors.email} />
        <FieldError message={errors.email?.message} />
      </div>

      <div>
        <Label htmlFor="password">Senha provisória</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className="pr-9"
              {...register("password")}
              aria-invalid={!!errors.password}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Gerar senha aleatória"
            aria-label="Gerar senha aleatória"
            onClick={() => {
              setValue("password", generatePassword(), { shouldValidate: true });
              setShowPassword(true);
            }}
          >
            <KeyRound className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Mínimo de 8 caracteres, com letras e números.</p>
        <FieldError message={errors.password?.message} />
      </div>

      <div>
        <Label htmlFor="role">Cargo</Label>
        <Controller
          name="role"
          control={control}
          render={({ field }) => (
            <OptionSelect
              id="role"
              value={field.value}
              onValueChange={field.onChange}
              options={ROLE_OPTIONS}
              aria-invalid={!!errors.role}
            />
          )}
        />
        <FieldError message={errors.role?.message} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Cadastrar
        </Button>
      </div>
    </form>
  );
}

function RoleForm({
  user,
  onSuccess,
  onCancel,
}: {
  user: ManagedUser;
  onSuccess: (role: UserRole) => void;
  onCancel: () => void;
}) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateUserRoleFormData>({
    resolver: zodResolver(updateUserRoleSchema),
    defaultValues: { role: user.role },
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit(async ({ role }) => {
        const result = await updateUserRoleAction(user.id, role);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Cargo atualizado!");
        onSuccess(role);
      })}
      className="space-y-4"
    >
      <div>
        <Label htmlFor="edit_role">Cargo</Label>
        <Controller
          name="role"
          control={control}
          render={({ field }) => (
            <OptionSelect id="edit_role" value={field.value} onValueChange={field.onChange} options={ROLE_OPTIONS} />
          )}
        />
        <FieldError message={errors.role?.message} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </div>
    </form>
  );
}
