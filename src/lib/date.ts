import { setDefaultOptions, format, formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// Locale padrão de todas as funções do date-fns na aplicação
setDefaultOptions({ locale: ptBR, weekStartsOn: 0 });

export { ptBR };

export function formatDateBR(date: string | Date, pattern = "dd/MM/yyyy"): string {
  return format(typeof date === "string" ? parseISO(date) : date, pattern, { locale: ptBR });
}

export function formatRelativeBR(date: string | Date): string {
  return formatDistanceToNow(typeof date === "string" ? parseISO(date) : date, {
    addSuffix: true,
    locale: ptBR,
  });
}
