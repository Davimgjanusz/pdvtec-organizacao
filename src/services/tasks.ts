"use server";

import { createClient } from "@/lib/supabase/server";
import {
  taskSchema,
  taskMovesSchema,
  type TaskFormData,
  type TaskMovesPayload,
} from "@/lib/validations/schemas";
import { transitionTimestamps } from "@/lib/kanban";
import { logAudit } from "@/lib/audit";
import type { TaskColumnStatus } from "@/types/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const TASK_SELECT = "*, contract:contracts(*, client:clients(*)), assignee:profiles(*)";

async function getColumnIdBySlug(supabase: Awaited<ReturnType<typeof createClient>>, boardId: string | null) {
  if (!boardId) return new Map<string, string>();
  const { data } = await supabase.from("kanban_columns").select("id, slug").eq("board_id", boardId);
  return new Map((data ?? []).map((c) => [c.slug as string, c.id as string]));
}

export async function getTasks(boardId?: string) {
  const supabase = await createClient();

  let query = supabase.from("tasks").select(TASK_SELECT).order("position");
  if (boardId) query = query.eq("board_id", boardId);

  const { data, error } = await query;
  if (error) throw new Error("Erro ao buscar tarefas.");
  return data;
}

export async function createTaskAction(formData: TaskFormData & { board_id?: string | null }) {
  const parsed = taskSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const boardId = z.string().uuid().nullable().catch(null).parse(formData.board_id ?? null);
  const supabase = await createClient();

  let lastQuery = supabase
    .from("tasks")
    .select("position")
    .eq("column_status", parsed.data.column_status)
    .order("position", { ascending: false })
    .limit(1);
  lastQuery = boardId ? lastQuery.eq("board_id", boardId) : lastQuery.is("board_id", null);
  const { data: last } = await lastQuery.maybeSingle();

  const columnIds = await getColumnIdBySlug(supabase, boardId);

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      ...parsed.data,
      contract_id: parsed.data.contract_id || null,
      assigned_to: parsed.data.assigned_to || null,
      description: parsed.data.description || null,
      due_date: parsed.data.due_date || null,
      board_id: boardId,
      column_id: columnIds.get(parsed.data.column_status) ?? null,
      position: (last?.position ?? -1) + 1,
      ...transitionTimestamps({ column_status: "todo", started_at: null, completed_at: null }, parsed.data.column_status),
    })
    .select(TASK_SELECT)
    .single();

  if (error) return { error: "Erro ao criar tarefa. Verifique se você tem permissão." };

  await logAudit({
    action: "create",
    tableName: "tasks",
    recordId: data.id,
    details: { title: data.title, board_id: boardId },
  });

  revalidatePath("/tarefas");
  return { data };
}

export async function updateTaskAction(id: string, formData: TaskFormData) {
  const parsed = taskSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();

  const { data: current } = await supabase
    .from("tasks")
    .select("board_id, column_status, started_at, completed_at")
    .eq("id", id)
    .single();

  if (!current) return { error: "Tarefa não encontrada." };

  const columnChanged = current.column_status !== parsed.data.column_status;
  const columnIds = columnChanged ? await getColumnIdBySlug(supabase, current.board_id) : null;

  const { data, error } = await supabase
    .from("tasks")
    .update({
      ...parsed.data,
      contract_id: parsed.data.contract_id || null,
      assigned_to: parsed.data.assigned_to || null,
      description: parsed.data.description || null,
      due_date: parsed.data.due_date || null,
      ...(columnChanged
        ? {
            column_id: columnIds?.get(parsed.data.column_status) ?? null,
            ...transitionTimestamps(
              { ...current, column_status: current.column_status as TaskColumnStatus },
              parsed.data.column_status
            ),
          }
        : {}),
    })
    .eq("id", id)
    .select(TASK_SELECT)
    .single();

  if (error) return { error: "Erro ao atualizar tarefa." };

  await logAudit({
    action: "update",
    tableName: "tasks",
    recordId: id,
    details: { title: data.title },
  });

  revalidatePath("/tarefas");
  return { data };
}

/**
 * Persiste um movimento do Kanban (arrastar e soltar). O cliente já aplicou o resultado
 * de forma otimista; aqui gravamos coluna, posição, campo da raia e datas de fluxo.
 */
export async function moveTasksAction(payload: TaskMovesPayload) {
  const parsed = taskMovesSchema.safeParse(payload);
  if (!parsed.success) return { error: "Movimento inválido." };

  const { board_id: boardId, changes, moved_task_id: movedId } = parsed.data;
  const supabase = await createClient();

  const ids = changes.map((c) => c.id);
  const [{ data: current, error: fetchError }, columnIds] = await Promise.all([
    supabase.from("tasks").select("id, column_status, started_at, completed_at").in("id", ids),
    getColumnIdBySlug(supabase, boardId),
  ]);

  if (fetchError || !current || current.length !== ids.length) {
    return { error: "Não foi possível localizar as tarefas movidas." };
  }

  const currentById = new Map(current.map((t) => [t.id as string, t]));
  const now = new Date().toISOString();

  const results = await Promise.all(
    changes.map((change) => {
      const before = currentById.get(change.id)!;
      const columnChanged = before.column_status !== change.column_status;
      const updates: Record<string, unknown> = {
        column_status: change.column_status,
        position: change.position,
      };

      if (columnChanged) {
        Object.assign(
          updates,
          { column_id: columnIds.get(change.column_status) ?? null },
          transitionTimestamps(
            { ...before, column_status: before.column_status as TaskColumnStatus },
            change.column_status,
            now
          )
        );
      }
      if (change.priority !== undefined) updates.priority = change.priority;
      if (change.assigned_to !== undefined) updates.assigned_to = change.assigned_to;
      if (change.contract_id !== undefined) updates.contract_id = change.contract_id;

      return supabase.from("tasks").update(updates).eq("id", change.id).select("id");
    })
  );

  // RLS retorna 0 linhas (sem erro) quando o usuário não pode alterar a tarefa
  if (results.some((r) => r.error || !r.data?.length)) {
    return { error: "Erro ao mover tarefa. Verifique se você tem permissão." };
  }

  const movedChange = changes.find((c) => c.id === movedId);
  if (movedChange) {
    await logAudit({ action: "move", tableName: "tasks", recordId: movedId, details: { ...movedChange } });
  }

  return { success: true };
}

export async function deleteTaskAction(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.from("tasks").delete().eq("id", id).select("id");

  if (error || !data?.length) return { error: "Erro ao excluir tarefa. Apenas administradores podem excluir." };

  await logAudit({ action: "delete", tableName: "tasks", recordId: id });

  revalidatePath("/tarefas");
  return { success: true };
}
