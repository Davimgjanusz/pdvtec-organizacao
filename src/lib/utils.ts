import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(dateStr));
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Rascunho",
    sent: "Enviada",
    approved: "Aprovada",
    rejected: "Recusada",
    cancelled: "Cancelada",
    active: "Ativo",
    pending_renewal: "Renovação Pendente",
    expired: "Expirado",
    todo: "A Fazer",
    in_progress: "Em Andamento",
    review: "Em Revisão",
    done: "Concluído",
  };
  return labels[status] ?? status;
}

export function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    low: "Baixa",
    medium: "Média",
    high: "Alta",
    urgent: "Urgente",
  };
  return labels[priority] ?? priority;
}

export function getBillingTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    one_off: "Pontual",
    recurring: "Recorrente",
    hybrid: "Híbrido",
  };
  return labels[type] ?? type;
}
