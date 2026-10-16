"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/permissions";
import {
  createContractAction,
  updateContractStatusAction,
  getSignedDocumentUrl,
} from "@/services/contracts";
import type { Contract, Client, Proposal } from "@/types/database";
import type { ContractFormData } from "@/lib/validations/schemas";
import { contractSchema } from "@/lib/validations/schemas";
import { formatCurrency, formatDate, getStatusLabel } from "@/lib/utils";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { NumericFormat } from "react-number-format";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  MoreHorizontal,
  Download,
  AlertTriangle,
  Upload,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  active: "bg-success/10 text-success",
  pending_renewal: "bg-warning/10 text-warning",
  expired: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2D];
const MAX_FILE_SIZE = 15 * 1024 * 1024;

export default function ContratosPage() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fromProposal = searchParams.get("from_proposal");
  const fromClientId = searchParams.get("client_id");

  const canCreate = profile ? hasPermission(profile.role, "contracts:create") : false;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      client_id: fromClientId ?? "",
      proposal_id: fromProposal,
      monthly_amount: 0,
    },
  });

  useEffect(() => {
    if (fromProposal && fromClientId) {
      setDialogOpen(true);
    }
  }, [fromProposal, fromClientId]);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("contracts")
      .select("*, client:clients(*)")
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`contract_number.ilike.%${search}%`);
    }
    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data } = await query;
    setContracts((data ?? []) as Contract[]);
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  useEffect(() => {
    const fetchClients = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("clients").select("*").order("corporate_name");
      setClients(data ?? []);
    };
    fetchClients();
  }, []);

  const validateFile = async (file: File): Promise<boolean> => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Arquivo excede o limite de 15 MB.");
      return false;
    }
    if (file.type !== "application/pdf") {
      toast.error("Apenas arquivos PDF são permitidos.");
      return false;
    }
    const buffer = await file.slice(0, 5).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const isPdf = PDF_MAGIC.every((b, i) => bytes[i] === b);
    if (!isPdf) {
      toast.error("O arquivo não parece ser um PDF válido.");
      return false;
    }
    return true;
  };

  const handleCreate = async (data: ContractFormData) => {
    if (!selectedFile) {
      toast.error("Selecione o arquivo PDF do contrato.");
      return;
    }

    const valid = await validateFile(selectedFile);
    if (!valid) return;

    setUploading(true);

    const supabase = createClient();
    const storagePath = `contracts/${data.client_id}/${Date.now()}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("pdvtec-documents")
      .upload(storagePath, selectedFile, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      toast.error("Erro ao fazer upload do arquivo.");
      setUploading(false);
      return;
    }

    const result = await createContractAction(data, storagePath);
    setUploading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Contrato registrado com sucesso!");
    setDialogOpen(false);
    setSelectedFile(null);
    reset();
    fetchContracts();
  };

  const handleDownload = async (contract: Contract) => {
    const result = await getSignedDocumentUrl(contract.file_storage_path);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.url) {
      window.open(result.url, "_blank");
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const result = await updateContractStatusAction(id, newStatus);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Status alterado para ${getStatusLabel(newStatus)}.`);
    fetchContracts();
  };

  const isExpiring = (contract: Contract) => {
    if (contract.status !== "active") return false;
    const end = new Date(contract.end_date);
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return end <= thirtyDays && end >= now;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contratos</h1>
          <p className="text-muted-foreground">Gerencie os contratos e documentos</p>
        </div>
        {canCreate && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Contrato
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número do contrato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="pending_renewal">Renovação Pendente</SelectItem>
            <SelectItem value="expired">Expirado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : contracts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Nenhum contrato encontrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Início</TableHead>
                    <TableHead className="hidden md:table-cell">Término</TableHead>
                    <TableHead className="hidden lg:table-cell">Valor Mensal</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-mono font-medium">
                        <div className="flex items-center gap-2">
                          {contract.contract_number}
                          {isExpiring(contract) && (
                            <AlertTriangle className="h-4 w-4 text-warning" aria-label="Vencimento próximo" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{contract.client?.corporate_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[contract.status]}>
                          {getStatusLabel(contract.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{formatDate(contract.start_date)}</TableCell>
                      <TableCell className="hidden md:table-cell">{formatDate(contract.end_date)}</TableCell>
                      <TableCell className="hidden lg:table-cell">{formatCurrency(Number(contract.monthly_amount))}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon" aria-label="Ações" />}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDownload(contract)}>
                              <Download className="mr-2 h-4 w-4" />
                              Baixar Contrato
                            </DropdownMenuItem>
                            {canCreate && contract.status === "active" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(contract.id, "pending_renewal")}>
                                Renovação Pendente
                              </DropdownMenuItem>
                            )}
                            {canCreate && contract.status === "active" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(contract.id, "cancelled")}>
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

      {/* Create Contract Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setSelectedFile(null); reset(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Contrato</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
            <div>
              <Label htmlFor="contract_client">Cliente</Label>
              <Controller
                name="client_id"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.corporate_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.client_id && <p className="text-sm text-destructive mt-1">{errors.client_id.message}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="start_date">Data de Início</Label>
                <Input id="start_date" type="date" {...register("start_date")} />
                {errors.start_date && <p className="text-sm text-destructive mt-1">{errors.start_date.message}</p>}
              </div>
              <div>
                <Label htmlFor="end_date">Data de Término</Label>
                <Input id="end_date" type="date" {...register("end_date")} />
                {errors.end_date && <p className="text-sm text-destructive mt-1">{errors.end_date.message}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="monthly_amount">Valor Mensal (R$)</Label>
              <Controller
                name="monthly_amount"
                control={control}
                render={({ field }) => (
                  <NumericFormat
                    customInput={Input}
                    id="monthly_amount"
                    thousandSeparator="."
                    decimalSeparator=","
                    decimalScale={2}
                    fixedDecimalScale
                    prefix="R$ "
                    value={field.value}
                    onValueChange={(values) => field.onChange(values.floatValue ?? 0)}
                  />
                )}
              />
            </div>

            <div>
              <Label>Documento PDF do Contrato</Label>
              <div
                className="mt-2 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-6 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) setSelectedFile(file);
                }}
                role="button"
                tabIndex={0}
                aria-label="Selecionar arquivo PDF"
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
              >
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                {selectedFile ? (
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Arraste o PDF ou clique para selecionar</p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setSelectedFile(file);
                  }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar Contrato
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
