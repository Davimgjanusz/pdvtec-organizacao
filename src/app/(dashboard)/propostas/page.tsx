"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/permissions";
import {
  createProposalAction,
  updateProposalAction,
  changeProposalStatusAction,
} from "@/services/proposals";
import { ProposalForm } from "@/components/forms/proposal-form";
import { ProposalPDF } from "@/components/pdf/proposal-pdf";
import type { Proposal, Client } from "@/types/database";
import type { ProposalFormData } from "@/lib/validations/schemas";
import {
  formatCurrency,
  formatDate,
  getStatusLabel,
  getBillingTypeLabel,
} from "@/lib/utils";
import { pdf } from "@react-pdf/renderer";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OptionSelect } from "@/components/ui/option-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Pencil,
  MoreHorizontal,
  Send,
  Check,
  X,
  Ban,
  FileDown,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "@/lib/notify";
import { useRouter } from "next/navigation";
import { useConfirm, type ConfirmOptions } from "@/components/ui/confirm-dialog";

const statusColors: Record<string, string> = {
  draft: "bg-secondary text-secondary-foreground",
  sent: "bg-info/10 text-info",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

export default function PropostasPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Incrementado para recarregar a lista após criar, editar ou alterar status
  const [reloadKey, setReloadKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);

  const canCreate = profile ? hasPermission(profile.role, "proposals:create") : false;
  const canEdit = profile ? hasPermission(profile.role, "proposals:edit") : false;
  const canChangeStatus = profile ? hasPermission(profile.role, "proposals:change_status") : false;

  useEffect(() => {
    let ignore = false;
    const supabase = createClient();

    let query = supabase
      .from("proposals")
      .select("*, client:clients(*), user:profiles(*)")
      .order("created_at", { ascending: false });

    if (search) query = query.ilike("title", `%${search}%`);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);

    query.then(({ data, error }) => {
      if (ignore) return;
      if (error) toast.error("Erro ao carregar as propostas.", { id: "carregar-propostas", description: "Tente novamente em instantes." });
      setProposals((data ?? []) as Proposal[]);
      setLoading(false);
    });

    return () => {
      ignore = true;
    };
  }, [search, statusFilter, reloadKey]);

  const handleCreate = async (data: ProposalFormData) => {
    const result = await createProposalAction(data);
    if (result.error) return { error: result.error };
    toast.success("Proposta criada com sucesso!");
    setDialogOpen(false);
    setReloadKey((k) => k + 1);
    return {};
  };

  const handleUpdate = async (data: ProposalFormData) => {
    if (!editingProposal) return { error: "Erro interno." };
    const result = await updateProposalAction(editingProposal.id, data);
    if (result.error) return { error: result.error };
    toast.success("Proposta atualizada!");
    setEditingProposal(null);
    setReloadKey((k) => k + 1);
    return {};
  };

  const statusConfirmations: Record<string, Omit<ConfirmOptions, "action" | "description"> & { description: string }> = {
    sent: {
      tone: "info",
      icon: Send,
      title: "Marcar proposta como enviada?",
      description: "Após o envio, a proposta não poderá mais ser editada.",
      confirmLabel: "Marcar como Enviada",
    },
    approved: {
      tone: "success",
      icon: Check,
      title: "Aprovar proposta?",
      description: "A proposta será aprovada e você será levado ao registro do contrato.",
      confirmLabel: "Aprovar",
    },
    rejected: {
      tone: "danger",
      icon: X,
      title: "Recusar proposta?",
      description: "A proposta será marcada como recusada pelo cliente. Esta ação não pode ser desfeita.",
      confirmLabel: "Recusar",
    },
    cancelled: {
      tone: "danger",
      icon: Ban,
      title: "Cancelar proposta?",
      description: "A proposta será cancelada e não poderá mais ser enviada ou aprovada.",
      confirmLabel: "Cancelar Proposta",
    },
  };

  const handleStatusChange = (proposal: Proposal, newStatus: string) => {
    const options = statusConfirmations[newStatus];
    return confirm({
      ...options,
      description: (
        <>
          <strong className="text-foreground">{proposal.title}</strong>
          <br />
          {options.description}
        </>
      ),
      cancelLabel: "Voltar",
      action: () => applyStatusChange(proposal.id, newStatus),
    });
  };

  const applyStatusChange = async (id: string, newStatus: string) => {
    const result = await changeProposalStatusAction(id, newStatus);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Status alterado para ${getStatusLabel(newStatus)}.`);

    if (newStatus === "approved" && result.clientId) {
      router.push(`/contratos?from_proposal=${id}&client_id=${result.clientId}`);
    }

    setReloadKey((k) => k + 1);
  };

  const handleDownloadPdf = async (proposal: Proposal) => {
    if (!proposal.client) return;
    try {
      const blob = await pdf(
        <ProposalPDF proposal={proposal} client={proposal.client as Client} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proposta-${proposal.title.replace(/\s+/g, "-").toLowerCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Erro ao gerar o PDF da proposta.", { description: "Tente novamente em instantes." });
    }
  };

  const isExpired = (proposal: Proposal) => {
    return new Date(proposal.valid_until) < new Date() && proposal.status === "sent";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Propostas</h1>
          <p className="text-muted-foreground">Gerencie as propostas comerciais</p>
        </div>
        {canCreate && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Proposta
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por título..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setLoading(true); }}
            className="pl-9"
          />
        </div>
        <OptionSelect
          value={statusFilter}
          onValueChange={(v) => { setStatusFilter(v); setLoading(true); }}
          className="sm:w-[200px]"
          aria-label="Filtrar por status"
          options={[
            { value: "all", label: "Todos os status" },
            { value: "draft", label: "Rascunho" },
            { value: "sent", label: "Enviada" },
            { value: "approved", label: "Aprovada" },
            { value: "rejected", label: "Recusada" },
            { value: "cancelled", label: "Cancelada" },
          ]}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : proposals.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Nenhuma proposta encontrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead className="hidden md:table-cell">Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Tipo</TableHead>
                    <TableHead className="hidden lg:table-cell">Valor</TableHead>
                    <TableHead className="hidden md:table-cell">Validade</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proposals.map((proposal) => (
                    <TableRow key={proposal.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {proposal.title}
                          {isExpired(proposal) && (
                            <AlertTriangle className="h-4 w-4 text-warning" aria-label="Validade vencida" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {proposal.client?.corporate_name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[proposal.status]}>
                          {getStatusLabel(proposal.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {getBillingTypeLabel(proposal.billing_type)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {Number(proposal.recurring_value) > 0
                          ? formatCurrency(Number(proposal.recurring_value)) + "/mês"
                          : formatCurrency(Number(proposal.setup_value))}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {formatDate(proposal.valid_until)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon" aria-label="Ações" />}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDownloadPdf(proposal)}>
                              <FileDown className="mr-2 h-4 w-4" />
                              Baixar PDF
                            </DropdownMenuItem>
                            {canEdit && proposal.status === "draft" && (
                              <DropdownMenuItem onClick={() => setEditingProposal(proposal)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            {canChangeStatus && proposal.status === "draft" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(proposal, "sent")}>
                                <Send className="mr-2 h-4 w-4" />
                                Marcar como Enviada
                              </DropdownMenuItem>
                            )}
                            {canChangeStatus && proposal.status === "sent" && (
                              <>
                                <DropdownMenuItem onClick={() => handleStatusChange(proposal, "approved")}>
                                  <Check className="mr-2 h-4 w-4" />
                                  Aprovar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(proposal, "rejected")}>
                                  <X className="mr-2 h-4 w-4" />
                                  Recusar
                                </DropdownMenuItem>
                              </>
                            )}
                            {canChangeStatus && ["draft", "sent"].includes(proposal.status) && (
                              <DropdownMenuItem onClick={() => handleStatusChange(proposal, "cancelled")}>
                                <Ban className="mr-2 h-4 w-4" />
                                Cancelar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Proposta</DialogTitle>
          </DialogHeader>
          <ProposalForm onSubmit={handleCreate} onCancel={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingProposal} onOpenChange={() => setEditingProposal(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Proposta</DialogTitle>
          </DialogHeader>
          {editingProposal && (
            <ProposalForm
              defaultValues={editingProposal}
              onSubmit={handleUpdate}
              onCancel={() => setEditingProposal(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
