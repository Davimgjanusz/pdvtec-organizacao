"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn, getPriorityLabel, formatDate } from "@/lib/utils";
import type { Task, TaskColumnStatus } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  GripVertical,
  MoreHorizontal,
  Pencil,
  ArrowRight,
  Clock,
  User,
} from "lucide-react";

const priorityColors: Record<string, string> = {
  low: "bg-secondary text-secondary-foreground",
  medium: "bg-info/10 text-info",
  high: "bg-warning/10 text-warning",
  urgent: "bg-destructive/10 text-destructive",
};

interface KanbanCardProps {
  task: Task;
  onEdit: () => void;
  onMove: (column: TaskColumnStatus) => void;
  columns: { id: TaskColumnStatus; label: string }[];
  isDragOverlay?: boolean;
}

export function KanbanCard({ task, onEdit, onMove, columns, isDragOverlay }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.column_status !== "done";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        isDragging && "opacity-50",
        isDragOverlay && "shadow-lg rotate-2",
        isOverdue && "border-destructive/50"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab text-muted-foreground hover:text-foreground"
          aria-label="Arrastar tarefa"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <h4 className="text-sm font-medium leading-tight">{task.title}</h4>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label="Opções da tarefa" />}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Mover para
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {columns
                      .filter((c) => c.id !== task.column_status)
                      .map((c) => (
                        <DropdownMenuItem key={c.id} onClick={() => onMove(c.id)}>
                          {c.label}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {task.contract?.client && (
            <p className="mt-1 text-xs text-muted-foreground truncate">
              {task.contract.client.corporate_name}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className={cn("text-xs", priorityColors[task.priority])}>
              {getPriorityLabel(task.priority)}
            </Badge>

            {task.due_date && (
              <span className={cn("flex items-center gap-1 text-xs", isOverdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                <Clock className="h-3 w-3" />
                {formatDate(task.due_date)}
              </span>
            )}

            {task.assignee && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                {task.assignee.full_name.split(" ")[0]}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
