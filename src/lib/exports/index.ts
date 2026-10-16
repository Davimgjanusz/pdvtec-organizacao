import * as XLSX from "xlsx";

interface ExportOptions {
  filename: string;
  sheetName?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}

export function exportToXlsx({ filename, sheetName = "Dados", headers, rows }: ExportOptions) {
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToCsv({ filename, headers, rows }: ExportOptions) {
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";", RS: "\n" });
  const bom = "﻿";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
