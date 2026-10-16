"use server";

import { createClient } from "@/lib/supabase/server";
import { taskSchema, type TaskFormData } from "@/lib/validations/schemas";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function getTasks() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*, contract:contracts(*, client:clients(*)), assignee:profiles(*)")
    .order("position");

  if (error) throw new Error("Erro ao buscar tarefas.");
  return data;
}

export async function createTaskAction(formData: TaskFormData & { board_id?: string | null }) {
  const parsed = taskSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();

  const { data: maxPos } = await supabase
    .from("tasks")
    .select("position")
    .eq("column_status", parsed.data.column_status)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (maxPos?.position ?? 0) + 1;

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      ...parsed.data,
      contract_id: parsed.data.contract_id || null,
      assigned_to: parsed.data.assigned_to || null,
      description: parsed.data.description || null,
      due_date: parsed.data.due_date || null,
      board_id: formData.board_id || null,
      position,
    })
    .select()
    .single();

  if (error) return { error: "Erro ao criar tarefa." };

  await logAudit({
    action: "create",
    tableName: "tasks",
    recordId: data.id,
    details: { title: data.title },
  });

  revalidatePath("/tarefas");
  return { data };
}

export async function updateTaskAction(id: string, formData: TaskFormData) {
  const parsed = taskSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .update({
      ...parsed.data,
      contract_id: parsed.data.contract_id || null,
      assigned_to: parsed.data.assigned_to || null,
      description: parsed.data.description || null,
      due_date: parsed.data.due_date || null,
    })
    .eq("id", id)
    .select()
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

export async function moveTaskAction(
  id: string,
  columnStatus: string,
  position: number
) {
  const supabase = await createClient();

  const { data: currentTask } = await supabase
    .from("tasks")
    .select("column_status, started_at, completed_at")
    .eq("id", id)
    .single();

  const updates: Record<string, unknown> = { column_status: columnStatus, position };

  if (columnStatus === "in_progress" && !currentTask?.started_at) {
    updates.started_at = new Date().toISOString();
  }

  if (columnStatus === "done" && !currentTask?.completed_at) {
    updates.completed_at = new Date().toISOString();
  } else if (columnStatus !== "done" && currentTask?.completed_at) {
    updates.completed_at = null;
  }

  const { error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id);

  if (error) return { error: "Erro ao mover tarefa." };

  await logAudit({
    action: "move",
    tableName: "tasks",
    recordId: id,
    details: { column_status: columnStatus, position },
  });

  return { success: true };
}

export async function deleteTaskAction(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) return { error: "Erro ao excluir tarefa." };

  await logAudit({ action: "delete", tableName: "tasks", recordId: id });

  revalidatePath("/tarefas");
  return { success: true };
}
