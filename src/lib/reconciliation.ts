import type { ReconciliationStatus } from "@/types/database";

/** Diferença máxima (em reais) aceita para considerar os valores iguais (arredondamento de centavos) */
export const AMOUNT_TOLERANCE = 0.01;

export const RECONCILIATION_STATUS_OPTIONS: { value: ReconciliationStatus; label: string }[] = [
  { value: "matched", label: "Conciliado" },
  { value: "divergent", label: "Divergente" },
  { value: "missing_in_system", label: "Ausente no sistema" },
  { value: "missing_in_spreadsheet", label: "Ausente na planilha" },
];

export function getReconciliationStatusLabel(status: ReconciliationStatus) {
  return RECONCILIATION_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

const COMPANY_SUFFIXES = /\b(ltda|me|epp|eireli|sa|s a|s\/a|mei|cia|limitada)\b/g;

/** Nome comparável: sem acentos, caixa, pontuação e sufixos societários (LTDA, ME, S/A...) */
export function normalizeCompanyName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(COMPANY_SUFFIXES, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export const onlyDigits = (value: string) => value.replace(/\D/g, "");

/**
 * Converte valores de planilha em número: aceita números nativos do Excel e textos como
 * "R$ 1.234,56", "1234,56", "1,234.56" e "1234.56". Retorna null quando não há valor legível.
 */
export function parseAmount(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;

  let text = raw.replace(/R\$|\s/gi, "").trim();
  if (!text) return null;

  const negative = /^\(.*\)$/.test(text) || text.startsWith("-");
  text = text.replace(/[()\-+]/g, "");

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    // O separador que aparece por último é o decimal
    text = lastComma > lastDot ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else if (lastComma >= 0) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    // "1.234" ou "1.234.567": pontos de milhar
    text = text.replace(/\./g, "");
  }

  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return negative ? -value : value;
}

const HEADER_HINTS = {
  client: ["cliente", "razao social", "razao", "empresa", "nome fantasia", "nome", "estabelecimento"],
  cnpj: ["cnpj", "cpf cnpj", "documento", "doc"],
  amount: ["valor", "valor total", "total", "valor pago", "valor liquido", "mensalidade", "repasse", "amount"],
} as const;

export type SpreadsheetField = keyof typeof HEADER_HINTS;

/** Sugere a coluna da planilha para cada campo a partir do texto dos cabeçalhos */
export function guessColumn(headers: string[], field: SpreadsheetField): string | null {
  const normalized = headers.map((h) => ({ header: h, key: normalizeCompanyName(h) }));
  for (const hint of HEADER_HINTS[field]) {
    const exact = normalized.find((h) => h.key === hint);
    if (exact) return exact.header;
  }
  for (const hint of HEADER_HINTS[field]) {
    const partial = normalized.find((h) => h.key.includes(hint));
    if (partial) return partial.header;
  }
  return null;
}

export interface SpreadsheetRow {
  client_name: string;
  cnpj?: string | null;
  amount: number;
}

export interface ExpectedContract {
  contract_id: string;
  client_id: string;
  corporate_name: string;
  trade_name: string | null;
  cnpj: string;
  monthly_amount: number;
}

export interface ReconciliationResult {
  client_name_external: string;
  contract_id: string | null;
  expected_amount: number;
  imported_amount: number;
  status: ReconciliationStatus;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Auditoria comparativa: agrupa as linhas da planilha por cliente interno (CNPJ primeiro,
 * depois razão social / nome fantasia normalizados) e compara a soma importada com a soma
 * das mensalidades dos contratos vigentes daquele cliente no mês de referência.
 */
export function reconcile(rows: SpreadsheetRow[], contracts: ExpectedContract[]): ReconciliationResult[] {
  const contractsByClient = new Map<string, ExpectedContract[]>();
  const clientByCnpj = new Map<string, string>();
  const clientByName = new Map<string, string>();

  for (const c of contracts) {
    const list = contractsByClient.get(c.client_id);
    if (list) list.push(c);
    else contractsByClient.set(c.client_id, [c]);

    const cnpj = onlyDigits(c.cnpj);
    if (cnpj) clientByCnpj.set(cnpj, c.client_id);
    clientByName.set(normalizeCompanyName(c.corporate_name), c.client_id);
    if (c.trade_name) clientByName.set(normalizeCompanyName(c.trade_name), c.client_id);
  }

  const importedByClient = new Map<string, { amount: number; names: Set<string> }>();
  const unmatched = new Map<string, { name: string; amount: number }>();

  for (const row of rows) {
    const cnpj = row.cnpj ? onlyDigits(row.cnpj) : "";
    const nameKey = normalizeCompanyName(row.client_name);
    const clientId = (cnpj && clientByCnpj.get(cnpj)) || clientByName.get(nameKey);

    if (clientId) {
      const entry = importedByClient.get(clientId) ?? { amount: 0, names: new Set<string>() };
      entry.amount += row.amount;
      entry.names.add(row.client_name.trim());
      importedByClient.set(clientId, entry);
    } else {
      const key = cnpj || nameKey;
      const entry = unmatched.get(key) ?? { name: row.client_name.trim(), amount: 0 };
      entry.amount += row.amount;
      unmatched.set(key, entry);
    }
  }

  const results: ReconciliationResult[] = [];

  for (const [clientId, clientContracts] of contractsByClient) {
    const expected = round2(clientContracts.reduce((sum, c) => sum + c.monthly_amount, 0));
    const imported = importedByClient.get(clientId);
    const first = clientContracts[0];

    if (!imported) {
      results.push({
        client_name_external: first.corporate_name,
        contract_id: first.contract_id,
        expected_amount: expected,
        imported_amount: 0,
        status: "missing_in_spreadsheet",
      });
      continue;
    }

    const importedAmount = round2(imported.amount);
    results.push({
      client_name_external: [...imported.names].join(" / "),
      contract_id: first.contract_id,
      expected_amount: expected,
      imported_amount: importedAmount,
      status: Math.abs(importedAmount - expected) < AMOUNT_TOLERANCE ? "matched" : "divergent",
    });
  }

  for (const { name, amount } of unmatched.values()) {
    results.push({
      client_name_external: name,
      contract_id: null,
      expected_amount: 0,
      imported_amount: round2(amount),
      status: "missing_in_system",
    });
  }

  return results;
}

/** Primeiro e último dia (YYYY-MM-DD) de um mês de referência YYYY-MM */
export function monthBounds(referenceMonth: string) {
  const [year, month] = referenceMonth.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: `${referenceMonth}-01`,
    end: `${referenceMonth}-${String(lastDay).padStart(2, "0")}`,
  };
}
