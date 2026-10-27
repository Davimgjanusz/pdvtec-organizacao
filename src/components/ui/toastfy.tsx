"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastfyType = "success" | "error" | "warning" | "info";

/**
 * Cartão de notificação inspirado no react-toastfy (título + mensagem + ícone, empilhado no
 * canto superior direito), completado com cores auxiliares, botão de fechar e barra de tempo.
 */
const typeStyles: Record<ToastfyType, { icon: LucideIcon; accent: string; badge: string; bar: string; label: string }> = {
  success: {
    icon: CheckCircle2,
    accent: "before:bg-emerald-600",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    bar: "bg-emerald-600",
    label: "Tudo certo!",
  },
  error: {
    icon: XCircle,
    accent: "before:bg-red-600",
    badge: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400",
    bar: "bg-red-600",
    label: "Algo deu errado",
  },
  warning: {
    icon: AlertTriangle,
    accent: "before:bg-amber-500",
    badge: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
    bar: "bg-amber-500",
    label: "Atenção",
  },
  info: {
    icon: Info,
    accent: "before:bg-primary",
    badge: "bg-sky-100 text-primary dark:bg-sky-500/15 dark:text-sky-400",
    bar: "bg-primary",
    label: "Informação",
  },
};

export function getToastfyLabel(type: ToastfyType) {
  return typeStyles[type].label;
}

interface ToastfyCardProps {
  type: ToastfyType;
  title: React.ReactNode;
  message?: React.ReactNode;
  duration: number;
  onClose: () => void;
}

export function ToastfyCard({ type, title, message, duration, onClose }: ToastfyCardProps) {
  const style = typeStyles[type];
  const Icon = style.icon;

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={cn(
        "toastfy relative flex w-[var(--width)] max-w-[calc(100vw-2rem)] items-start gap-3 overflow-hidden rounded-lg border bg-card py-3 pl-5 pr-3 font-sans text-card-foreground shadow-lg",
        "before:absolute before:inset-y-0 before:left-0 before:w-1.5",
        style.accent
      )}
    >
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", style.badge)}>
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[15px] font-semibold leading-snug">{title}</p>
        {message && <p className="mt-0.5 text-sm leading-snug text-muted-foreground break-words">{message}</p>}
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar notificação"
        className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      {Number.isFinite(duration) && (
        <span
          aria-hidden
          className={cn("toastfy-progress absolute bottom-0 left-0 h-1 w-full origin-left", style.bar)}
          style={{ animationDuration: `${duration}ms` }}
        />
      )}
    </div>
  );
}
