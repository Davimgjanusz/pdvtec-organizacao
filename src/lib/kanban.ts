import type { Task, TaskColumnStatus, TaskPriority } from "@/types/database";
import type { TaskMove } from "@/lib/validations/schemas";
import { getPriorityLabel } from "@/lib/utils";

export type SwimlaneMode = "none" | "priority" | "assignee" | "contract";

export const SWIMLANE_OPTIONS: { value: SwimlaneMode; label: string }[] = [
  { value: "none", label: "Sem raias" },
  { value: "priority", label: "Raias: Prioridade" },
  { value: "assignee", label: "Raias: Responsável" },
  { value: "contract", label: "Raias: Cliente/Contrato" },
];

export const DEFAULT_COLUMNS: { slug: TaskColumnStatus; title: string }[] = [
  { slug: "todo", title: "A Fazer" },
  { slug: "in_progress", title: "Em Andamento" },
  { slug: "review", title: "Em Revisão" },
  { slug: "done", title: "Concluído" },
];

/** Chave da raia "vazia" (sem responsável / sem contrato) */
export const NO_LANE = "__none__";
const ALL_LANE = "__all__";

export interface Lane {
  key: string;
  label: string;
  description?: string;
}

const PRIORITY_ORDER: TaskPriority[] = ["urgent", "high", "medium", "low"];

export function laneKeyOf(task: Task, mode: SwimlaneMode): string {
  switch (mode) {
    case "priority":
      return task.priority;
    case "assignee":
      return task.assigned_to ?? NO_LANE;
    case "contract":
      return task.contract_id ?? NO_LANE;
    default:
      return ALL_LANE;
  }
}

/** Campos da tarefa alterados ao soltá-la em outra raia */
export function lanePatch(mode: SwimlaneMode, laneKey: string): Partial<Pick<Task, "priority" | "assigned_to" | "contract_id">> {
  switch (mode) {
    case "priority":
      return { priority: laneKey as TaskPriority };
    case "assignee":
      return { assigned_to: laneKey === NO_LANE ? null : laneKey };
    case "contract":
      return { contract_id: laneKey === NO_LANE ? null : laneKey };
    default:
      return {};
  }
}

export function buildLanes(
  mode: SwimlaneMode,
  tasks: Task[],
  profiles: { id: string; full_name: string }[]
): Lane[] {
  if (mode === "none") return [{ key: ALL_LANE, label: "Todas" }];

  if (mode === "priority") {
    return PRIORITY_ORDER.map((p) => ({ key: p, label: getPriorityLabel(p) }));
  }

  if (mode === "assignee") {
    // Todos os colaboradores aparecem, para permitir atribuir arrastando
    return [
      ...profiles
        .map((p) => ({ key: p.id, label: p.full_name }))
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
      { key: NO_LANE, label: "Sem responsável" },
    ];
  }

  const contracts = new Map<string, Lane>();
  for (const t of tasks) {
    if (!t.contract_id || contracts.has(t.contract_id)) continue;
    contracts.set(t.contract_id, {
      key: t.contract_id,
      label: t.contract?.client?.corporate_name ?? "Cliente não identificado",
      description: t.contract?.contract_number,
    });
  }
  return [
    ...Array.from(contracts.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
    { key: NO_LANE, label: "Sem contrato" },
  ];
}

export function cellId(laneKey: string, column: string) {
  return `cell|${laneKey}|${column}`;
}

export function parseCellId(id: string): { laneKey: string; column: TaskColumnStatus } | null {
  const [prefix, laneKey, column] = id.split("|");
  if (prefix !== "cell" || !laneKey || !column) return null;
  return { laneKey, column: column as TaskColumnStatus };
}

export function isCellId(id: string | number) {
  return String(id).startsWith("cell|");
}

/**
 * Datas de fluxo ao mudar de coluna:
 * - started_at: primeira saída de "A Fazer" (base do Cycle Time)
 * - completed_at: entrada em "Concluído"; limpa ao reabrir (base do Lead Time e Throughput)
 */
export function transitionTimestamps(
  current: Pick<Task, "column_status" | "started_at" | "completed_at">,
  nextStatus: TaskColumnStatus,
  now = new Date().toISOString()
): Pick<Task, "started_at" | "completed_at"> {
  return {
    started_at: current.started_at ?? (nextStatus !== "todo" ? now : null),
    completed_at: nextStatus === "done" ? current.completed_at ?? now : null,
  };
}

export interface MoveTarget {
  laneKey: string;
  column: TaskColumnStatus;
  /** Tarefa sobre a qual o cartão foi solto (ausente quando solto na área vazia da célula) */
  overTaskId?: string;
  placeAfter?: boolean;
}

/**
 * Calcula o novo estado do quadro após mover um cartão e a lista mínima de alterações a
 * persistir. As posições são renumeradas por coluna (compartilhadas entre raias).
 */
export function computeMove(
  tasks: Task[],
  activeId: string,
  target: MoveTarget,
  mode: SwimlaneMode,
  extraPatch: (laneKey: string) => Partial<Task> = () => ({})
): { next: Task[]; changes: TaskMove[] } | null {
  const active = tasks.find((t) => t.id === activeId);
  if (!active) return null;

  const laneChanged = laneKeyOf(active, mode) !== target.laneKey;
  const columnChanged = active.column_status !== target.column;

  const moved: Task = {
    ...active,
    ...(laneChanged ? { ...lanePatch(mode, target.laneKey), ...extraPatch(target.laneKey) } : {}),
    column_status: target.column,
    ...(columnChanged ? transitionTimestamps(active, target.column) : {}),
  };

  const column = tasks
    .filter((t) => t.column_status === target.column && t.id !== activeId)
    .sort((a, b) => a.position - b.position);

  let index: number;
  const overIndex = target.overTaskId ? column.findIndex((t) => t.id === target.overTaskId) : -1;
  if (overIndex >= 0) {
    index = target.placeAfter ? overIndex + 1 : overIndex;
  } else {
    // Solto na área vazia: vai para o fim da raia de destino dentro da coluna
    let lastInLane = -1;
    column.forEach((t, i) => {
      if (laneKeyOf(t, mode) === target.laneKey) lastInLane = i;
    });
    index = lastInLane >= 0 ? lastInLane + 1 : column.length;
  }
  column.splice(index, 0, moved);

  const original = new Map(tasks.map((t) => [t.id, t]));
  const renumbered = new Map(column.map((t, i) => [t.id, { ...t, position: i }]));

  const changes: TaskMove[] = [];
  for (const t of renumbered.values()) {
    const before = original.get(t.id)!;
    const isActive = t.id === activeId;
    if (!isActive && before.position === t.position) continue;
    if (isActive && !laneChanged && !columnChanged && before.position === t.position) continue;

    changes.push({
      id: t.id,
      column_status: t.column_status,
      position: t.position,
      ...(isActive && laneChanged ? lanePatch(mode, target.laneKey) : {}),
    });
  }

  if (changes.length === 0) return null;

  return {
    next: tasks.map((t) => renumbered.get(t.id) ?? t),
    changes,
  };
}
