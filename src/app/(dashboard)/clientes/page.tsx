"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/permissions";
import { createClientAction, updateClientAction, deleteClientAction } from "@/services/clients";
import { ClientForm } from "@/components/forms/client-form";
import { formatCnpj } from "@/lib/validations/cnpj";
import type { Client } from "@/types/database";
import type { ClientFormData } from "@/lib/validations/schemas";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/lib/notify";
import { useConfirm } from "@/components/ui/confirm-dialog";

export default function ClientesPage() {
  const { profile } = useAuth();
  const confirm = useConfirm();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Incrementado para recarregar a lista após criar, editar ou excluir
  const [reloadKey, setReloadKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  useEffect(() => {
    let ignore = false;
    const supabase = createClient();
    let query = supabase.from("clients").select("*").order("corporate_name");

    if (search) {
      const normalized = search.replace(/\D/g, "");
      query = query.or(
        `corporate_name.ilike.%${search}%,trade_name.ilike.%${search}%,cnpj.ilike.%${normalized}%`
      );
    }

    query.then(({ data, error }) => {
      if (ignore) return;
      if (error) toast.error("Erro ao carregar os clientes.", { id: "carregar-clientes", description: "Tente novamente em instantes." });
      setClients(data ?? []);
      setLoading(false);
    });

    return () => {
      ignore = true;
    };
  }, [search, reloadKey]);

  const canCreate = profile ? hasPermission(profile.role, "clients:create") : false;
  const canEdit = profile ? hasPermission(profile.role, "clients:edit") : false;
  const canDelete = profile ? hasPermission(profile.role, "clients:delete") : false;

  const handleCreate = async (data: ClientFormData) => {
    const result = await createClientAction(data);
    if (result.error) return { error: result.error };
    toast.success("Cliente cadastrado com sucesso!");
    setDialogOpen(false);
    setReloadKey((k) => k + 1);
    return {};
  };

  const handleUpdate = async (data: ClientFormData) => {
    if (!editingClient) return { error: "Erro interno." };
    const result = await updateClientAction(editingClient.id, data);
    if (result.error) return { error: result.error };
    toast.success("Cliente atualizado com sucesso!");
    setEditingClient(null);
    setReloadKey((k) => k + 1);
    return {};
  };

  const handleDelete = (client: Client) =>
    confirm({
      tone: "danger",
      title: "Excluir cliente?",
      description: (
        <>
          <strong className="text-foreground">{client.corporate_name}</strong>
          <br />
          O cadastro será removido permanentemente. Esta ação não pode ser desfeita.
        </>
      ),
      confirmLabel: "Excluir",
      action: async () => {
        const result = await deleteClientAction(client.id);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Cliente excluído.");
          setReloadKey((k) => k + 1);
        }
      },
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">Gerencie os clientes corporativos</p>
        </div>
        {canCreate && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Cliente
          </Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por razão social, nome fantasia ou CNPJ..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setLoading(true); }}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : clients.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {search ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Razão Social</TableHead>
                    <TableHead className="hidden md:table-cell">Nome Fantasia</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead className="hidden lg:table-cell">Contato</TableHead>
                    <TableHead className="hidden lg:table-cell">Cidade/UF</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.corporate_name}</TableCell>
                      <TableCell className="hidden md:table-cell">{client.trade_name ?? "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{formatCnpj(client.cnpj)}</TableCell>
                      <TableCell className="hidden lg:table-cell">{client.contact_name}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {client.city && client.state ? `${client.city}/${client.state}` : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {canEdit && (
                            <Button variant="ghost" size="icon" onClick={() => setEditingClient(client)} aria-label="Editar cliente">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(client)} aria-label="Excluir cliente">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Criar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <ClientForm onSubmit={handleCreate} onCancel={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Dialog Editar */}
      <Dialog open={!!editingClient} onOpenChange={() => setEditingClient(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          {editingClient && (
            <ClientForm
              defaultValues={editingClient}
              onSubmit={handleUpdate}
              onCancel={() => setEditingClient(null)}
            />
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
