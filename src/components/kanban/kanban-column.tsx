"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Plus } from "lucide-react";

export type WipState = "none" | "ok" | "at" | "over";

export function getWipState(count: number, wipLimit: number | null | undefined): WipState {
  if (!wipLimit) return "none";
  if (count > wipLimit) return "over";
  if (count === wipLimit) return "at";
  return "ok";
}

interface KanbanColumnHeaderProps {
  title: string;
  count: number;
  wipLimit?: number | null;
  onAdd?: () => void;
}

export function KanbanColumnHeader({ title, count, wipLimit, onAdd }: KanbanColumnHeaderProps) {
  const state = getWipState(count, wipLimit);

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border bg-card px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        state === "over" && "border-destructive bg-destructive/5",
        state === "at" && "border-warning/60"
      )}
    >
      {/* Linha 1: título nunca é cortado pelo contador */}
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h3 className="min-w-0 text-sm font-semibold leading-tight break-words">{title}</h3>
        <div className="flex shrink-0 items-center gap-1">
          {state === "none" ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium">
              {count}
            </span>
          ) : (
            <span
              title={`Limite de WIP: ${wipLimit}`}
              className={cn(
                "whitespace-nowrap rounded-md border px-1.5 py-0.5 font-mono text-xs font-semibold",
                state === "ok" && "border-border text-muted-foreground",
                state === "at" && "border-warning bg-warning/10 text-warning",
                state === "over" && "border-destructive bg-destructive/10 text-destructive"
              )}
            >
              {count}/{wipLimit}
            </span>
          )}
          {onAdd && (
            <Button variant="ghost" size="icon-xs" onClick={onAdd} aria-label={`Nova tarefa em ${title}`} title="Nova tarefa">
              <Plus />
            </Button>
          )}
        </div>
      </div>

      {/* Linha 2: alerta de WIP em faixa própria, ocupando toda a largura */}
      {state === "over" && (
        <div
          role="alert"
          className="flex items-center gap-1.5 rounded-md bg-destructive px-2 py-1 text-xs font-semibold text-white"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-nowrap">
            {count}/{wipLimit} - Limite WIP Excedido
          </span>
        </div>
      )}
    </div>
  );
}

interface KanbanCellProps {
  id: string;
  isTarget: boolean;
  wipState: WipState;
  isEmpty: boolean;
  compact?: boolean;
  children: React.ReactNode;
}

/** Área soltável de uma coluna dentro de uma raia */
export function KanbanCell({ id, isTarget, wipState, isEmpty, compact, children }: KanbanCellProps) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-dashed border-transparent bg-muted/40 p-2 transition-colors dark:bg-muted/20",
        compact ? "min-h-20" : "min-h-40",
        wipState === "over" && "bg-destructive/5",
        isTarget && "border-primary/60 bg-accent dark:bg-accent/60"
      )}
    >
      {children}
      {isEmpty && (
        <div className="flex flex-1 items-center justify-center py-4 text-xs text-muted-foreground">
          {isTarget ? "Soltar aqui" : "Nenhuma tarefa"}
        </div>
      )}
    </div>
  );
}
