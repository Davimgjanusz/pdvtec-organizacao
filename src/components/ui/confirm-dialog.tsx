"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, Trash2, type LucideIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConfirmTone = "danger" | "warning" | "success" | "info";

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  icon?: LucideIcon;
  /** Executada ao confirmar; o pop-up permanece aberto com indicador de carregamento até concluir */
  action?: () => Promise<unknown> | unknown;
}

/** Cores auxiliares por gravidade (botões com contraste adequado para texto) */
const toneStyles: Record<ConfirmTone, { icon: LucideIcon; badge: string; bar: string; button: string }> = {
  danger: {
    icon: Trash2,
    badge: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400",
    bar: "bg-red-600",
    button: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600/40",
  },
  warning: {
    icon: AlertTriangle,
    badge: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
    bar: "bg-amber-500",
    button: "bg-amber-500 text-amber-950 hover:bg-amber-400 focus-visible:ring-amber-500/40",
  },
  success: {
    icon: CheckCircle2,
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    bar: "bg-emerald-600",
    button: "bg-emerald-700 text-white hover:bg-emerald-800 focus-visible:ring-emerald-600/40",
  },
  info: {
    icon: Info,
    badge: "bg-sky-100 text-primary dark:bg-sky-500/15 dark:text-sky-400",
    bar: "bg-primary",
    button: "bg-primary text-primary-foreground hover:bg-primary-hover",
  },
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    resolver.current?.(false);
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpen(false);
  };

  const handleConfirm = async () => {
    if (options?.action) {
      setRunning(true);
      try {
        await options.action();
      } finally {
        setRunning(false);
      }
    }
    close(true);
  };

  const tone = toneStyles[options?.tone ?? "info"];
  const Icon = options?.icon ?? tone.icon;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !running) close(false);
        }}
      >
        <AlertDialogContent className="overflow-hidden pt-6 data-[size=default]:sm:max-w-md">
          <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1.5", tone.bar)} />
          <div className="flex items-start gap-4">
            <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", tone.badge)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1.5 pt-1">
              <AlertDialogTitle className="text-left">{options?.title}</AlertDialogTitle>
              {options?.description && (
                <AlertDialogDescription className="text-left">{options.description}</AlertDialogDescription>
              )}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={running}>{options?.cancelLabel ?? "Cancelar"}</AlertDialogCancel>
            <Button className={cn("min-w-28", tone.button)} onClick={handleConfirm} disabled={running} autoFocus>
              {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {options?.confirmLabel ?? "Confirmar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

/** Abre um pop-up de confirmação e resolve `true` se o usuário confirmar */
export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm deve ser usado dentro de <ConfirmProvider>.");
  return confirm;
}
