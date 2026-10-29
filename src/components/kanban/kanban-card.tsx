"use client";

import { memo, type HTMLAttributes, type Ref } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn, getPriorityLabel, formatDate } from "@/lib/utils";
import { getColorTagOption } from "@/lib/kanban";
import type { Task, TaskColumnStatus } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, ArrowRight, Clock, User, Building2, Trash2 } from "lucide-react";

const priorityColors: Record<string, string> = {
  low: "bg-secondary text-secondary-foreground",
  medium: "bg-info/10 text-info",
  high: "bg-warning/15 text-warning",
  urgent: "bg-destructive/10 text-destructive",
};

const priorityBar: Record<string, string> = {
  low: "before:bg-muted-foreground/30",
  medium: "before:bg-info",
  high: "before:bg-warning",
  urgent: "before:bg-destructive",
};

interface KanbanCardProps {
  task: Task;
  columns: { id: TaskColumnStatus; label: string }[];
  disabled?: boolean;
  onEdit?: (task: Task) => void;
  onMove?: (task: Task, column: TaskColumnStatus) => void;
  onDelete?: (task: Task) => void;
  isDragOverlay?: boolean;
}

interface CardViewProps extends KanbanCardProps {
  nodeRef?: Ref<HTMLDivElement>;
  dragProps?: HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
}

/** Cartão inteiro arrastável: listeners do dnd-kit ficam no contêiner, não em uma alça */
function SortableKanbanCard(props: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.task.id,
    disabled: props.disabled,
  });

  return (
    <KanbanCardView
      {...props}
      nodeRef={setNodeRef}
      isDragging={isDragging}
      dragProps={{
        ...attributes,
        ...listeners,
        style: { transform: CSS.Translate.toString(transform), transition },
      }}
    />
  );
}

function KanbanCardView({
  task,
  columns,
  disabled,
  onEdit,
  onMove,
  onDelete,
  isDragOverlay,
  nodeRef,
  dragProps,
  isDragging,
}: CardViewProps) {
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = !!task.due_date && task.due_date < today && task.column_status !== "done";
  const colorTag = getColorTagOption(task.color_tag);

  return (
    <div
      ref={nodeRef}
      {...dragProps}
      aria-roledescription="Cartão arrastável"
      aria-label={`Tarefa: ${task.title}`}
      onDoubleClick={() => onEdit?.(task)}
      className={cn(
        "group relative touch-manipulation select-none rounded-lg border bg-card p-3 pl-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.06)] outline-none transition-shadow",
        "before:absolute before:inset-y-2 before:left-1.5 before:w-1 before:rounded-full",
        priorityBar[task.priority],
        !disabled && "cursor-grab hover:border-primary/40 hover:shadow-md active:cursor-grabbing",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        isDragging && "opacity-40",
        isDragOverlay && "cursor-grabbing rotate-2 shadow-xl ring-2 ring-primary/30",
        isOverdue && "border-destructive/50"
      )}
    >
      {colorTag.value !== "default" && (
        <span
          aria-hidden
          title={`Etiqueta: ${colorTag.label}`}
          className={cn("absolute inset-x-3 top-0 h-1 rounded-b-full", colorTag.swatch)}
        />
      )}
      <div className="flex items-start justify-between gap-1">
        <h4 className="text-sm font-medium leading-snug break-words">{task.title}</h4>
        {!isDragOverlay && (onEdit || onMove || onDelete) && (
          // Impede que cliques/teclas no menu iniciem o arrasto do cartão
          <span onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="-mr-1 -mt-1 h-6 w-6 shrink-0 opacity-60 group-hover:opacity-100"
                    aria-label="Opções da tarefa"
                  />
                }
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(task)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                )}
                {onMove && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <ArrowRight className="mr-2 h-4 w-4" />
                      Mover para
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {columns
                        .filter((c) => c.id !== task.column_status)
                        .map((c) => (
                          <DropdownMenuItem key={c.id} onClick={() => onMove(task, c.id)}>
                            {c.label}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => onDelete(task)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        )}
      </div>

      {task.contract?.client && (
        <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{task.contract.client.corporate_name}</span>
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className={cn("text-xs", priorityColors[task.priority])}>
          {getPriorityLabel(task.priority)}
        </Badge>

        {task.due_date && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs",
              isOverdue ? "font-medium text-destructive" : "text-muted-foreground"
            )}
            title={isOverdue ? "Prazo vencido" : "Prazo"}
          >
            <Clock className="h-3 w-3" />
            {formatDate(task.due_date)}
          </span>
        )}

        {task.assignee && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground" title={task.assignee.full_name}>
            <User className="h-3 w-3" />
            {task.assignee.full_name.split(" ")[0]}
          </span>
        )}
      </div>
    </div>
  );
}

export const KanbanCard = memo(SortableKanbanCard);

/** Versão estática exibida no DragOverlay enquanto o cartão é arrastado */
export function KanbanCardOverlay({ task, columns }: Pick<KanbanCardProps, "task" | "columns">) {
  return <KanbanCardView task={task} columns={columns} isDragOverlay />;
}
