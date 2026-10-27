"use client";

import { useCallback, useId, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Announcements,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "@/lib/notify";

import { KanbanCell, KanbanColumnHeader, getWipState } from "./kanban-column";
import { KanbanCard, KanbanCardOverlay } from "./kanban-card";
import {
  cellId,
  computeMove,
  isCellId,
  laneKeyOf,
  parseCellId,
  type Lane,
  type MoveTarget,
  type SwimlaneMode,
} from "@/lib/kanban";
import type { TaskMove } from "@/lib/validations/schemas";
import type { Task, TaskColumnStatus } from "@/types/database";

export interface BoardColumn {
  slug: TaskColumnStatus;
  title: string;
  wipLimit: number | null;
}

interface KanbanBoardProps {
  tasks: Task[];
  isVisible: (task: Task) => boolean;
  columns: BoardColumn[];
  lanes: Lane[];
  swimlaneMode: SwimlaneMode;
  canEdit: boolean;
  /** Aplicação otimista: o pai atualiza o estado na hora e persiste em segundo plano */
  onMove: (next: Task[], changes: TaskMove[], movedTaskId: string) => void;
  /** Complementa os dados exibidos (ex.: objeto do responsável) ao trocar de raia */
  lanePatch: (laneKey: string) => Partial<Task>;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (task: Task) => void;
  onAddTask?: (column: TaskColumnStatus, laneKey: string) => void;
}

// Prioriza o cartão sob o ponteiro; sem cartão, usa a célula (área vazia da coluna/raia)
const collisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  const hits = pointerHits.length > 0 ? pointerHits : rectIntersection(args);
  const cardHits = hits.filter((h) => !isCellId(h.id));
  if (cardHits.length > 0) {
    const ids = new Set(cardHits.map((h) => h.id));
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => ids.has(c.id)),
    });
  }
  return hits.length > 0 ? hits : closestCenter(args);
};

export function KanbanBoard({
  tasks,
  isVisible,
  columns,
  lanes,
  swimlaneMode,
  canEdit,
  onMove,
  lanePatch,
  onEditTask,
  onDeleteTask,
  onAddTask,
}: KanbanBoardProps) {
  // Id estável entre servidor e cliente (evita divergência de hidratação no aria-describedby)
  const dndContextId = useId();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overCell, setOverCell] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const showLanes = swimlaneMode !== "none";

  // Contagem WIP por coluna considera todas as tarefas do quadro (independe de filtros)
  const columnCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) counts[t.column_status] = (counts[t.column_status] ?? 0) + 1;
    return counts;
  }, [tasks]);

  // Células: raia -> coluna -> tarefas visíveis ordenadas
  const cells = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!isVisible(t)) continue;
      const key = cellId(laneKeyOf(t, swimlaneMode), t.column_status);
      const list = map.get(key);
      if (list) list.push(t);
      else map.set(key, [t]);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [tasks, isVisible, swimlaneMode]);

  const cellOfTask = useCallback(
    (taskId: string) => {
      const t = tasksById.get(taskId);
      return t ? cellId(laneKeyOf(t, swimlaneMode), t.column_status) : null;
    },
    [tasksById, swimlaneMode]
  );

  const columnDefs = useMemo(() => columns.map((c) => ({ id: c.slug, label: c.title })), [columns]);

  const resetDrag = () => {
    setActiveId(null);
    setOverCell(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragOver = ({ over }: DragOverEvent) => {
    if (!over) return setOverCell(null);
    const id = String(over.id);
    setOverCell(isCellId(id) ? id : cellOfTask(id));
  };

  const applyMove = (taskId: string, target: MoveTarget) => {
    const task = tasksById.get(taskId);
    if (!task) return;

    const result = computeMove(tasks, taskId, target, swimlaneMode, lanePatch);
    if (!result) return;

    if (task.column_status !== target.column) {
      const column = columns.find((c) => c.slug === target.column);
      const newCount = (columnCounts[target.column] ?? 0) + 1;
      if (column?.wipLimit && newCount > column.wipLimit) {
        toast.warning(`Limite WIP excedido em "${column.title}" (${newCount}/${column.wipLimit}).`, {
          description: "O cartão foi movido, mas revise a carga da coluna.",
        });
      }
    }

    onMove(result.next, result.changes, taskId);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    resetDrag();
    if (!over) return;

    const taskId = String(active.id);
    const overId = String(over.id);
    if (taskId === overId) return;

    const targetCell = isCellId(overId) ? overId : cellOfTask(overId);
    const parsed = targetCell ? parseCellId(targetCell) : null;
    if (!targetCell || !parsed) return;

    let placeAfter = false;
    if (!isCellId(overId)) {
      if (targetCell === cellOfTask(taskId)) {
        // Mesma célula: semântica de arrayMove (descendo -> depois, subindo -> antes)
        const list = cells.get(targetCell) ?? [];
        placeAfter = list.findIndex((t) => t.id === taskId) < list.findIndex((t) => t.id === overId);
      } else {
        const activeRect = active.rect.current.translated;
        placeAfter = !!activeRect && activeRect.top + activeRect.height / 2 > over.rect.top + over.rect.height / 2;
      }
    }

    applyMove(taskId, {
      laneKey: parsed.laneKey,
      column: parsed.column,
      overTaskId: isCellId(overId) ? undefined : overId,
      placeAfter,
    });
  };

  const handleMenuMove = useCallback(
    (task: Task, column: TaskColumnStatus) => {
      applyMove(task.id, { laneKey: laneKeyOf(task, swimlaneMode), column });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, swimlaneMode, columns, columnCounts, lanePatch, onMove]
  );

  const columnTitle = (slug: string) => columns.find((c) => c.slug === slug)?.title ?? slug;
  const laneTitle = (key: string) => lanes.find((l) => l.key === key)?.label ?? "";
  const describeCell = (id: string | number | undefined) => {
    const parsed = id ? parseCellId(isCellId(id) ? String(id) : cellOfTask(String(id)) ?? "") : null;
    if (!parsed) return "";
    return showLanes ? `${columnTitle(parsed.column)} (${laneTitle(parsed.laneKey)})` : columnTitle(parsed.column);
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Cartão "${tasksById.get(String(active.id))?.title}" selecionado.`,
    onDragOver: ({ active, over }) =>
      over ? `Cartão "${tasksById.get(String(active.id))?.title}" sobre ${describeCell(over.id)}.` : "Fora de uma coluna.",
    onDragEnd: ({ active, over }) =>
      over ? `Cartão "${tasksById.get(String(active.id))?.title}" solto em ${describeCell(over.id)}.` : "Movimento cancelado.",
    onDragCancel: () => "Movimento cancelado.",
  };

  const activeTask = activeId ? tasksById.get(activeId) : null;
  const gridTemplate = { gridTemplateColumns: `repeat(${columns.length}, minmax(220px, 1fr))` };

  return (
    <DndContext
      id={dndContextId}
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={resetDrag}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Para mover um cartão, pressione espaço ou Enter. Use as setas para escolher o destino e pressione espaço ou Enter novamente para soltar, ou Esc para cancelar.",
        },
      }}
    >
      <div className="overflow-x-auto pb-2">
        <div className="grid gap-3" style={gridTemplate}>
          {columns.map((column) => (
            <KanbanColumnHeader
              key={column.slug}
              title={column.title}
              count={columnCounts[column.slug] ?? 0}
              wipLimit={column.wipLimit}
              onAdd={canEdit && onAddTask && !showLanes ? () => onAddTask(column.slug, lanes[0]?.key) : undefined}
            />
          ))}

          {lanes.map((lane) => {
            const isCollapsed = collapsed.has(lane.key);
            const laneCount = columns.reduce((sum, c) => sum + (cells.get(cellId(lane.key, c.slug))?.length ?? 0), 0);

            return (
              <div key={lane.key} className="contents">
                {showLanes && (
                  <button
                    type="button"
                    style={{ gridColumn: "1 / -1" }}
                    onClick={() =>
                      setCollapsed((prev) => {
                        const next = new Set(prev);
                        if (next.has(lane.key)) next.delete(lane.key);
                        else next.add(lane.key);
                        return next;
                      })
                    }
                    className="sticky left-0 mt-2 flex w-fit items-center gap-2 rounded-md px-1 py-1 text-left text-sm font-semibold hover:bg-muted"
                    aria-expanded={!isCollapsed}
                  >
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {lane.label}
                    {lane.description && (
                      <span className="font-mono text-xs font-normal text-muted-foreground">{lane.description}</span>
                    )}
                    <span className="rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">{laneCount}</span>
                  </button>
                )}

                {!isCollapsed &&
                  columns.map((column) => {
                    const id = cellId(lane.key, column.slug);
                    const cellTasks = cells.get(id) ?? [];
                    return (
                      <KanbanCell
                        key={id}
                        id={id}
                        isTarget={!!activeId && overCell === id}
                        wipState={getWipState(columnCounts[column.slug] ?? 0, column.wipLimit)}
                        isEmpty={cellTasks.length === 0}
                        compact={showLanes}
                      >
                        <SortableContext items={cellTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                          {cellTasks.map((task) => (
                            <KanbanCard
                              key={task.id}
                              task={task}
                              columns={columnDefs}
                              disabled={!canEdit}
                              onEdit={onEditTask}
                              onMove={canEdit ? handleMenuMove : undefined}
                              onDelete={onDeleteTask}
                            />
                          ))}
                        </SortableContext>
                      </KanbanCell>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
        {activeTask && <KanbanCardOverlay task={activeTask} columns={columnDefs} />}
      </DragOverlay>
    </DndContext>
  );
}
