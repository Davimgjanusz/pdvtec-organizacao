"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as XLSX from "xlsx";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  History,
  Loader2,
  Scale,
  Search,
  Upload,
} from "lucide-react";

import {
  getReconciliationAction,
  listReconciliationBatchesAction,
  reconcileSpreadsheetAction,
  type ReconciliationBatch,
} from "@/services/reconciliation";
import {
  SPREADSHEET_EXTENSIONS,
  reconciliationFormSchema,
  type ReconciliationFormData,
} from "@/lib/validations/schemas";
import {
  RECONCILIATION_STATUS_OPTIONS,
  getReconciliationStatusLabel,
  guessColumn,
  parseAmount,
  type SpreadsheetRow,
} from "@/lib/reconciliation";
import { exportToCsv, exportToXlsx } from "@/lib/exports";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "@/lib/notify";
import type { FinancialReconciliation, ReconciliationStatus } from "@/types/database";

import { FieldError } from "@/components/forms/masked-inputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OptionSelect } from "@/components/ui/option-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const NO_COLUMN = "__none__";

const statusColors: Record<ReconciliationStatus, string> = {
  matched: "bg-success/10 text-success",
  divergent: "bg-warning/15 text-warning",
  missing_in_system: "bg-destructive/10 text-destructive",
  missing_in_spreadsheet: "bg-info/10 text-info",
};

interface ParsedSheet {
  headers: string[];
  rows: unknown[][];
}

/** Lê a primeira aba da planilha; a primeira linha preenchida é tratada como cabeçalho */
async function readSpreadsheet(file: File): Promise<ParsedSheet> {
  const workbook = file.name.toLowerCase().endsWith(".csv")
    ? XLSX.read(await file.text(), { type: "string" })
    : XLSX.read(await file.arrayBuffer(), { type: "array" });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("A planilha não possui abas.");

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true, blankrows: false });
  const headerIndex = matrix.findIndex((row) => row.some((cell) => String(cell).trim() !== ""));
  if (headerIndex < 0) throw new Error("A planilha está vazia.");

  const seen = new Map<string, number>();
  const headers = matrix[headerIndex].map((cell, i) => {
    const base = String(cell).trim() || `Coluna ${i + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count ? `${base} (${count + 1})` : base;
  });

  return { headers, rows: matrix.slice(headerIndex + 1) };
}

const currentMonth = () => new Date().toISOString().slice(0, 7);

const formatMonth = (referenceMonth: string) => {
  const [year, month] = referenceMonth.split("-");
  return `${month}/${year}`;
};

const helper = createColumnHelper<FinancialReconciliation>();

export function ReconciliationManager() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [readingFile, setReadingFile] = useState(false);
  const [results, setResults] = useState<FinancialReconciliation[] | null>(null);
  const [activeBatch, setActiveBatch] = useState<{ partner_name: string; reference_month: string } | null>(null);
  const [batches, setBatches] = useState<ReconciliationBatch[]>([]);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([]);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ReconciliationFormData>({
    resolver: zodResolver(reconciliationFormSchema),
    defaultValues: {
      partner_name: "",
      reference_month: currentMonth(),
      client_column: "",
      amount_column: "",
      cnpj_column: null,
    },
  });

  const selectedFile = watch("file");

  const fetchBatches = useCallback(async () => {
    try {
      const result = await listReconciliationBatchesAction();
      if (result.error) toast.error(result.error, { id: "historico-conciliacao" });
      else setBatches(result.data ?? []);
    } catch {
      toast.error("Não foi possível carregar o histórico de conciliações.", { id: "historico-conciliacao" });
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const selectFile = async (file: File | undefined) => {
    if (!file) return;
    setValue("file", file, { shouldValidate: true });
    setSheet(null);

    const valid = SPREADSHEET_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!valid) return;

    setReadingFile(true);
    try {
      const parsed = await readSpreadsheet(file);
      setSheet(parsed);
      setValue("client_column", guessColumn(parsed.headers, "client") ?? "", { shouldValidate: !!errors.client_column });
      setValue("amount_column", guessColumn(parsed.headers, "amount") ?? "", { shouldValidate: !!errors.amount_column });
      setValue("cnpj_column", guessColumn(parsed.headers, "cnpj"));
      clearErrors("file");
    } catch (error) {
      setError("file", {
        message: error instanceof Error && error.message ? error.message : "Não foi possível ler a planilha.",
      });
    } finally {
      setReadingFile(false);
    }
  };

  const onSubmit = async (data: ReconciliationFormData) => {
    if (!sheet) {
      setError("file", { message: "Não foi possível ler a planilha." });
      return;
    }

    const clientIdx = sheet.headers.indexOf(data.client_column);
    const amountIdx = sheet.headers.indexOf(data.amount_column);
    const cnpjIdx = data.cnpj_column ? sheet.headers.indexOf(data.cnpj_column) : -1;

    const rows: SpreadsheetRow[] = [];
    let skipped = 0;
    for (const row of sheet.rows) {
      const clientName = String(row[clientIdx] ?? "").trim();
      const amount = parseAmount(row[amountIdx]);
      if (!clientName || amount === null) {
        skipped += 1;
        continue;
      }
      rows.push({ client_name: clientName, amount, cnpj: cnpjIdx >= 0 ? String(row[cnpjIdx] ?? "") : null });
    }

    if (rows.length === 0) {
      setError("amount_column", { message: "Nenhuma linha com cliente e valor válidos nas colunas escolhidas." });
      return;
    }

    try {
      const result = await reconcileSpreadsheetAction({
        partner_name: data.partner_name,
        reference_month: data.reference_month,
        rows,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setResults(result.data ?? []);
      setActiveBatch({ partner_name: data.partner_name.trim(), reference_month: data.reference_month });
      setStatusFilter("all");
      toast.success("Conciliação concluída!", {
        description:
          skipped > 0
            ? `${rows.length} linha(s) analisada(s); ${skipped} ignorada(s) sem cliente ou valor.`
            : `${rows.length} linha(s) analisada(s).`,
      });
      fetchBatches();
    } catch {
      toast.error("Não foi possível processar a conciliação. Verifique sua conexão.");
    }
  };

  const openBatch = async (key: string) => {
    const batch = batches.find((b) => `${b.reference_month}|${b.partner_name}` === key);
    if (!batch) return;
    setLoadingBatch(true);
    try {
      const result = await getReconciliationAction(batch.partner_name, batch.reference_month);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setResults(result.data ?? []);
      setActiveBatch({ partner_name: batch.partner_name, reference_month: batch.reference_month });
      setStatusFilter("all");
    } catch {
      toast.error("Não foi possível carregar a conciliação.");
    } finally {
      setLoadingBatch(false);
    }
  };

  const filteredResults = useMemo(
    () => (results ?? []).filter((r) => statusFilter === "all" || r.status === statusFilter),
    [results, statusFilter]
  );

  const summary = useMemo(() => {
    const list = results ?? [];
    const count = (status: ReconciliationStatus) => list.filter((r) => r.status === status).length;
    const expected = list.reduce((sum, r) => sum + Number(r.expected_amount), 0);
    const imported = list.reduce((sum, r) => sum + Number(r.imported_amount), 0);
    return {
      counts: Object.fromEntries(RECONCILIATION_STATUS_OPTIONS.map((o) => [o.value, count(o.value)])) as Record<
        ReconciliationStatus,
        number
      >,
      expected,
      imported,
      difference: imported - expected,
    };
  }, [results]);

  const columns = useMemo(
    () => [
      helper.accessor("client_name_external", { header: "Cliente (planilha)" }),
      helper.accessor((row) => row.contract?.client?.corporate_name ?? "", {
        id: "internal_client",
        header: "Cliente (sistema)",
        cell: (i) => i.getValue() || <span className="text-muted-foreground">—</span>,
      }),
      helper.accessor((row) => row.contract?.contract_number ?? "", {
        id: "contract",
        header: "Contrato",
        cell: (i) => (i.getValue() ? <span className="font-mono text-xs">{i.getValue()}</span> : "—"),
      }),
      helper.accessor((row) => Number(row.expected_amount), {
        id: "expected",
        header: "Esperado",
        cell: (i) => formatCurrency(i.getValue()),
      }),
      helper.accessor((row) => Number(row.imported_amount), {
        id: "imported",
        header: "Importado",
        cell: (i) => formatCurrency(i.getValue()),
      }),
      helper.accessor((row) => Number(row.imported_amount) - Number(row.expected_amount), {
        id: "difference",
        header: "Diferença",
        cell: (i) => {
          const value = i.getValue();
          return (
            <span className={cn("font-medium", Math.abs(value) >= 0.01 && "text-destructive")}>
              {formatCurrency(value)}
            </span>
          );
        },
      }),
      helper.accessor("status", {
        header: "Status",
        cell: (i) => (
          <Badge variant="secondary" className={statusColors[i.getValue()]}>
            {getReconciliationStatusLabel(i.getValue())}
          </Badge>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: filteredResults,
    columns,
    state: { sorting, globalFilter: search },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  const runExport = (type: "xlsx" | "csv") => {
    if (!activeBatch) return;
    const opts = {
      filename: `conciliacao-${activeBatch.partner_name.replace(/[^\w-]+/g, "_")}-${activeBatch.reference_month}`,
      sheetName: "Conciliação",
      headers: ["Cliente (planilha)", "Cliente (sistema)", "Contrato", "Esperado", "Importado", "Diferença", "Status"],
      rows: table.getFilteredRowModel().rows.map(({ original: r }) => [
        r.client_name_external,
        r.contract?.client?.corporate_name ?? "",
        r.contract?.contract_number ?? "",
        Number(r.expected_amount),
        Number(r.imported_amount),
        Number(r.imported_amount) - Number(r.expected_amount),
        getReconciliationStatusLabel(r.status),
      ]),
    };
    try {
      if (type === "xlsx") exportToXlsx(opts);
      else exportToCsv(opts);
    } catch {
      toast.error("Não foi possível gerar o arquivo de exportação.");
    }
  };

  const columnOptions = (sheet?.headers ?? []).map((h) => ({ value: h, label: h }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conciliação Financeira</h1>
          <p className="text-muted-foreground">
            Importe a planilha do parceiro e compare os valores com os contratos vigentes no mês
          </p>
        </div>
        {batches.length > 0 && (
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <OptionSelect
              value={activeBatch ? `${activeBatch.reference_month}|${activeBatch.partner_name}` : null}
              onValueChange={openBatch}
              placeholder="Conciliações anteriores"
              className="w-[260px]"
              aria-label="Abrir conciliação anterior"
              options={batches.map((b) => ({
                value: `${b.reference_month}|${b.partner_name}`,
                label: `${formatMonth(b.reference_month)} — ${b.partner_name}`,
              }))}
            />
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            Nova conciliação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="partner_name">Parceiro</Label>
                <Input
                  id="partner_name"
                  placeholder="Ex.: Adquirente, distribuidor ou revenda"
                  {...register("partner_name")}
                  aria-invalid={!!errors.partner_name}
                />
                <FieldError message={errors.partner_name?.message} />
              </div>
              <div>
                <Label htmlFor="reference_month">Mês de referência</Label>
                <Input
                  id="reference_month"
                  type="month"
                  {...register("reference_month")}
                  aria-invalid={!!errors.reference_month}
                />
                <FieldError message={errors.reference_month?.message} />
              </div>
            </div>

            <div>
              <Label id="spreadsheet_label">Planilha (.xlsx, .xls ou .csv)</Label>
              <Controller
                name="file"
                control={control}
                render={() => (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-labelledby="spreadsheet_label"
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      selectFile(e.dataTransfer.files[0]);
                    }}
                    className={cn(
                      "mt-2 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 outline-none transition-colors hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50",
                      errors.file ? "border-destructive" : "border-border"
                    )}
                  >
                    {readingFile ? (
                      <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" />
                    ) : (
                      <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                    )}
                    {selectedFile ? (
                      <p className="text-sm font-medium">
                        {selectedFile.name}
                        {sheet && (
                          <span className="font-normal text-muted-foreground"> — {sheet.rows.length} linha(s)</span>
                        )}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Arraste a planilha ou clique para selecionar</p>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={SPREADSHEET_EXTENSIONS.join(",")}
                      className="hidden"
                      onChange={(e) => {
                        selectFile(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </div>
                )}
              />
              <FieldError message={errors.file?.message} />
            </div>

            {sheet && (
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="client_column">Coluna do cliente</Label>
                  <Controller
                    name="client_column"
                    control={control}
                    render={({ field }) => (
                      <OptionSelect
                        id="client_column"
                        value={field.value || null}
                        onValueChange={field.onChange}
                        options={columnOptions}
                        aria-invalid={!!errors.client_column}
                      />
                    )}
                  />
                  <FieldError message={errors.client_column?.message} />
                </div>
                <div>
                  <Label htmlFor="amount_column">Coluna do valor</Label>
                  <Controller
                    name="amount_column"
                    control={control}
                    render={({ field }) => (
                      <OptionSelect
                        id="amount_column"
                        value={field.value || null}
                        onValueChange={field.onChange}
                        options={columnOptions}
                        aria-invalid={!!errors.amount_column}
                      />
                    )}
                  />
                  <FieldError message={errors.amount_column?.message} />
                </div>
                <div>
                  <Label htmlFor="cnpj_column">Coluna do CNPJ (opcional)</Label>
                  <Controller
                    name="cnpj_column"
                    control={control}
                    render={({ field }) => (
                      <OptionSelect
                        id="cnpj_column"
                        value={field.value ?? NO_COLUMN}
                        onValueChange={(v) => field.onChange(v === NO_COLUMN ? null : v)}
                        options={[{ value: NO_COLUMN, label: "Não usar" }, ...columnOptions]}
                      />
                    )}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Com CNPJ, o cruzamento é mais preciso que pelo nome.</p>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting || readingFile}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Scale className="mr-2 h-4 w-4" />}
                Conciliar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {loadingBatch ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        results &&
        activeBatch && (
          <section aria-labelledby="resultado-conciliacao" className="space-y-4">
            <h2 id="resultado-conciliacao" className="text-lg font-semibold">
              Resultado — {activeBatch.partner_name} · {formatMonth(activeBatch.reference_month)}
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {RECONCILIATION_STATUS_OPTIONS.map((o) => (
                <Card key={o.value}>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">{o.label}</p>
                    <p className="text-2xl font-bold">{summary.counts[o.value]}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total esperado (contratos)</p>
                  <p className="text-xl font-bold">{formatCurrency(summary.expected)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total importado (planilha)</p>
                  <p className="text-xl font-bold">{formatCurrency(summary.imported)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Diferença</p>
                  <p className={cn("text-xl font-bold", Math.abs(summary.difference) >= 0.01 && "text-destructive")}>
                    {formatCurrency(summary.difference)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                <div className="relative max-w-md flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente ou contrato..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                    aria-label="Buscar no resultado"
                  />
                </div>
                <OptionSelect
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                  className="sm:w-[200px]"
                  aria-label="Filtrar por status"
                  options={[{ value: "all", label: "Todos os status" }, ...RECONCILIATION_STATUS_OPTIONS]}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => runExport("xlsx")}>
                  <Download className="mr-2 h-4 w-4" />
                  XLSX
                </Button>
                <Button variant="outline" size="sm" onClick={() => runExport("csv")}>
                  <Download className="mr-2 h-4 w-4" />
                  CSV
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      {table.getHeaderGroups().map((hg) => (
                        <TableRow key={hg.id}>
                          {hg.headers.map((header) => (
                            <TableHead
                              key={header.id}
                              aria-sort={
                                header.column.getIsSorted() === "asc"
                                  ? "ascending"
                                  : header.column.getIsSorted() === "desc"
                                    ? "descending"
                                    : "none"
                              }
                            >
                              <button
                                type="button"
                                onClick={header.column.getToggleSortingHandler()}
                                className="flex items-center gap-1 select-none"
                              >
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {table.getRowModel().rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                            Nenhum registro encontrado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        table.getRowModel().rows.map((row) => (
                          <TableRow key={row.id}>
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                            ))}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{table.getFilteredRowModel().rows.length} registro(s)</p>
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
                  {table.getState().pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)}
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
          </section>
        )
      )}
    </div>
  );
}
