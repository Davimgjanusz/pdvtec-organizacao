"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type Table,
} from "@tanstack/react-table";
import {
  formatCurrency,
  formatDate,
  getStatusLabel,
  getBillingTypeLabel,
} from "@/lib/utils";
import { exportToXlsx, exportToCsv } from "@/lib/exports";
import type { Proposal, Contract } from "@/types/database";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table as UiTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowUpDown,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { toast } from "@/lib/notify";

const proposalHelper = createColumnHelper<Proposal>();
const contractHelper = createColumnHelper<Contract>();

export default function RelatoriosPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [proposalSearch, setProposalSearch] = useState("");
  const [contractSearch, setContractSearch] = useState("");
  const [proposalSorting, setProposalSorting] = useState<SortingState>([]);
  const [contractSorting, setContractSorting] = useState<SortingState>([]);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const [pRes, cRes] = await Promise.all([
        supabase.from("proposals").select("*, client:clients(*), user:profiles(*)").order("created_at", { ascending: false }),
        supabase.from("contracts").select("*, client:clients(*)").order("created_at", { ascending: false }),
      ]);
      if (pRes.error || cRes.error) {
        toast.error("Erro ao carregar os dados dos relatórios.", {
          id: "carregar-relatorios",
          description: "As tabelas podem estar incompletas. Recarregue a página.",
        });
      }
      setProposals((pRes.data ?? []) as Proposal[]);
      setContracts((cRes.data ?? []) as Contract[]);
      setLoading(false);
    };
    fetchData();
  }, []);

  const proposalColumns = useMemo(
    () => [
      proposalHelper.accessor("title", { header: "Título", cell: (i) => i.getValue() }),
      proposalHelper.accessor((row) => row.client?.corporate_name ?? "", { id: "client", header: "Cliente" }),
      proposalHelper.accessor("status", { header: "Status", cell: (i) => getStatusLabel(i.getValue()) }),
      proposalHelper.accessor("billing_type", { header: "Tipo", cell: (i) => getBillingTypeLabel(i.getValue()) }),
      proposalHelper.accessor("setup_value", { header: "Implantação", cell: (i) => formatCurrency(Number(i.getValue())) }),
      proposalHelper.accessor("recurring_value", { header: "Recorrente", cell: (i) => formatCurrency(Number(i.getValue())) }),
      proposalHelper.accessor("valid_until", { header: "Validade", cell: (i) => formatDate(i.getValue()) }),
    ],
    []
  );

  const contractColumns = useMemo(
    () => [
      contractHelper.accessor("contract_number", { header: "Número" }),
      contractHelper.accessor((row) => row.client?.corporate_name ?? "", { id: "client", header: "Cliente" }),
      contractHelper.accessor("status", { header: "Status", cell: (i) => getStatusLabel(i.getValue()) }),
      contractHelper.accessor("start_date", { header: "Início", cell: (i) => formatDate(i.getValue()) }),
      contractHelper.accessor("end_date", { header: "Término", cell: (i) => formatDate(i.getValue()) }),
      contractHelper.accessor("monthly_amount", { header: "Valor Mensal", cell: (i) => formatCurrency(Number(i.getValue())) }),
    ],
    []
  );

  const proposalTable = useReactTable({
    data: proposals,
    columns: proposalColumns,
    state: { sorting: proposalSorting, globalFilter: proposalSearch },
    onSortingChange: setProposalSorting,
    onGlobalFilterChange: setProposalSearch,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  const contractTable = useReactTable({
    data: contracts,
    columns: contractColumns,
    state: { sorting: contractSorting, globalFilter: contractSearch },
    onSortingChange: setContractSorting,
    onGlobalFilterChange: setContractSearch,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  const runExport = (type: "xlsx" | "csv", opts: Parameters<typeof exportToXlsx>[0]) => {
    if (opts.rows.length === 0) {
      toast.warning("Não há registros para exportar.", { description: "Ajuste a busca e tente novamente." });
      return;
    }
    try {
      if (type === "xlsx") exportToXlsx(opts);
      else exportToCsv(opts);
    } catch {
      toast.error(`Erro ao gerar o arquivo ${type.toUpperCase()}.`, { description: "Tente novamente." });
    }
  };

  const exportProposals = (type: "xlsx" | "csv") => {
    const filtered = proposalTable.getFilteredRowModel().rows;
    const headers = ["Título", "Cliente", "Status", "Tipo", "Implantação", "Recorrente", "Validade"];
    const rows = filtered.map((r) => [
      r.original.title,
      r.original.client?.corporate_name ?? "",
      getStatusLabel(r.original.status),
      getBillingTypeLabel(r.original.billing_type),
      Number(r.original.setup_value),
      Number(r.original.recurring_value),
      formatDate(r.original.valid_until),
    ]);
    const opts = { filename: "propostas", sheetName: "Propostas", headers, rows };
    runExport(type, opts);
  };

  const exportContracts = (type: "xlsx" | "csv") => {
    const filtered = contractTable.getFilteredRowModel().rows;
    const headers = ["Número", "Cliente", "Status", "Início", "Término", "Valor Mensal"];
    const rows = filtered.map((r) => [
      r.original.contract_number,
      r.original.client?.corporate_name ?? "",
      getStatusLabel(r.original.status),
      formatDate(r.original.start_date),
      formatDate(r.original.end_date),
      Number(r.original.monthly_amount),
    ]);
    const opts = { filename: "contratos", sheetName: "Contratos", headers, rows };
    runExport(type, opts);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground">Consulte e exporte dados do sistema</p>
      </div>

      <Tabs defaultValue="propostas">
        <TabsList>
          <TabsTrigger value="propostas">Propostas</TabsTrigger>
          <TabsTrigger value="contratos">Contratos</TabsTrigger>
        </TabsList>
        <TabsContent value="propostas" className="mt-4">
          <ReportTable
            table={proposalTable}
            searchValue={proposalSearch}
            setSearch={setProposalSearch}
            onExport={exportProposals}
          />
        </TabsContent>
        <TabsContent value="contratos" className="mt-4">
          <ReportTable
            table={contractTable}
            searchValue={contractSearch}
            setSearch={setContractSearch}
            onExport={exportContracts}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportTable<T>({
  table,
  searchValue,
  setSearch,
  onExport,
}: {
  table: Table<T>;
  searchValue: string;
  setSearch: (v: string) => void;
  onExport: (type: "xlsx" | "csv") => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchValue}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onExport("xlsx")}>
            <Download className="mr-2 h-4 w-4" />
            XLSX
          </Button>
          <Button variant="outline" size="sm" onClick={() => onExport("csv")}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <UiTable>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="cursor-pointer select-none"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={table.getAllColumns().length} className="text-center py-8 text-muted-foreground">
                      Nenhum registro encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </UiTable>
          </div>
        </CardContent>
      </Card>
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} registro(s)
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Próxima página"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
