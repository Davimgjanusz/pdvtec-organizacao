"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import { moveTaskAction } from "@/services/tasks";
import type { Task, TaskColumnStatus, KanbanColumn as KanbanColumnType } from "@/types/database";
import { toast } from "sonner";

const DEFAULT_COLUMNS: { id: TaskColumnStatus; label: string }[] = [
  { id: "todo", label: "A Fazer" },
  { id: "in_progress", label: "Em Andamento" },
  { id: "review", label: "Em Revisão" },
  { id: "done", label: "Concluído" },
];

interface KanbanBoardProps {
  tasks: Task[];
  columns?: KanbanColumnType[];
  onTasksChange: () => void;
  onEditTask: (task: Task) => void;
}

export function KanbanBoard({ tasks, columns, onTasksChange, onEditTask }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [localTasks, setLocalTasks] = useState(tasks);

  const displayColumns = columns
    ? columns.map((c) => ({ id: c.slug as TaskColumnStatus, label: c.title, wipLimit: c.wip_limit }))
    : DEFAULT_COLUMNS.map((c) => ({ ...c, wipLimit: null as number | null }));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  if (tasks !== localTasks && !activeTask) {
    setLocalTasks(tasks);
  }

  const getTasksByColumn = useCallback(
    (columnSlug: string) =>
      localTasks
        .filter((t) => t.column_status === columnSlug)
        .sort((a, b) => a.position - b.position),
    [localTasks]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = localTasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const task = localTasks.find((t) => t.id === taskId);
    if (!task) return;

    let targetColumn: string;

    if (displayColumns.some((c) => c.id === over.id)) {
      targetColumn = over.id as string;
    } else {
      const overTask = localTasks.find((t) => t.id === over.id);
      if (!overTask) return;
      targetColumn = overTask.column_status;
    }

    const colDef = displayColumns.find((c) => c.id === targetColumn);
    const columnTasks = localTasks
      .filter((t) => t.column_status === targetColumn && t.id !== taskId)
      .sort((a, b) => a.position - b.position);

    if (colDef?.wipLimit && columnTasks.length >= colDef.wipLimit && task.column_status !== targetColumn) {
      toast.warning(
        `Limite WIP excedido na coluna "${colDef.label}" (${columnTasks.length}/${colDef.wipLimit}). Cartão movido, mas revise a carga.`
      );
    }

    const newPosition = columnTasks.length;
    const previousState = [...localTasks];

    setLocalTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, column_status: targetColumn as TaskColumnStatus, position: newPosition }
          : t
      )
    );

    const result = await moveTaskAction(taskId, targetColumn, newPosition);
    if (result.error) {
      toast.error("Erro ao mover tarefa. Revertendo.");
      setLocalTasks(previousState);
    } else {
      onTasksChange();
    }
  };

  const handleMoveViaMenu = async (taskId: string, targetColumn: TaskColumnStatus) => {
    const task = localTasks.find((t) => t.id === taskId);
    if (!task) return;

    const colDef = displayColumns.find((c) => c.id === targetColumn);
    const columnTasks = localTasks
      .filter((t) => t.column_status === targetColumn && t.id !== taskId)
      .sort((a, b) => a.position - b.position);

    if (colDef?.wipLimit && columnTasks.length >= colDef.wipLimit) {
      toast.warning(
        `Limite WIP excedido na coluna "${colDef.label}" (${columnTasks.length}/${colDef.wipLimit}). Cartão movido, mas revise a carga.`
      );
    }

    const newPosition = columnTasks.length;
    const previousState = [...localTasks];

    setLocalTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, column_status: targetColumn, position: newPosition }
          : t
      )
    );

    const result = await moveTaskAction(taskId, targetColumn, newPosition);
    if (result.error) {
      toast.error("Erro ao mover tarefa.");
      setLocalTasks(previousState);
    } else {
      onTasksChange();
    }
  };

  const columnDefs = displayColumns.map((c) => ({ id: c.id as TaskColumnStatus, label: c.label }));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {displayColumns.map((column) => {
          const columnTasks = getTasksByColumn(column.id);
          return (
            <KanbanColumn
              key={column.id}
              id={column.id}
              title={column.label}
              count={columnTasks.length}
              wipLimit={column.wipLimit}
            >
              <SortableContext items={columnTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {columnTasks.map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    onEdit={() => onEditTask(task)}
                    onMove={(col) => handleMoveViaMenu(task.id, col)}
                    columns={columnDefs}
                  />
                ))}
              </SortableContext>
              {columnTasks.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma tarefa
                </div>
              )}
            </KanbanColumn>
          );
        })}
      </div>

      <DragOverlay>
        {activeTask && (
          <KanbanCard
            task={activeTask}
            onEdit={() => {}}
            onMove={() => {}}
            columns={columnDefs}
            isDragOverlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
