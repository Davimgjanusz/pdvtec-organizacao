"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

interface KanbanColumnProps {
  id: string;
  title: string;
  count: number;
  wipLimit?: number | null;
  children: React.ReactNode;
}

export function KanbanColumn({ id, title, count, wipLimit, children }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const isOverWip = wipLimit !== null && wipLimit !== undefined && count > wipLimit;
  const isAtWip = wipLimit !== null && wipLimit !== undefined && count === wipLimit;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-lg bg-card border p-3 min-h-[200px] transition-colors shadow-sm",
        isOver && "bg-accent ring-2 ring-primary/20",
        isOverWip && "border-destructive/60"
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex items-center gap-1.5">
          {wipLimit !== null && wipLimit !== undefined && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-mono",
                isOverWip && "border-destructive text-destructive bg-destructive/10",
                isAtWip && !isOverWip && "border-warning text-warning bg-warning/10"
              )}
            >
              {count}/{wipLimit}
            </Badge>
          )}
          {isOverWip && (
            <span title="Limite de WIP excedido">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </span>
          )}
          {!wipLimit && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
              {count}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2 flex-1">{children}</div>
    </div>
  );
}
