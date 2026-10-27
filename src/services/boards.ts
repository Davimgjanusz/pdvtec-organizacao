"use server";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import {
  boardSchema,
  wipLimitsSchema,
  type BoardFormData,
  type WipLimitsFormData,
} from "@/lib/validations/schemas";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const uuid = z.string().uuid();

export async function getBoards(includeArchived = false) {
  const supabase = await createClient();
  let query = supabase
    .from("kanban_boards")
    .select("*, columns:kanban_columns(*)")
    .order("created_at", { ascending: true });

  if (!includeArchived) {
    query = query.eq("archived", false);
  }

  const { data, error } = await query;
  if (error) throw new Error("Erro ao buscar quadros.");

  return (data ?? []).map((board) => ({
    ...board,
    columns: (board.columns ?? []).sort(
      (a: { position: number }, b: { position: number }) => a.position - b.position
    ),
  }));
}

export async function createBoardAction(formData: BoardFormData) {
  const parsed = boardSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc("create_default_board", {
    p_title: parsed.data.title,
    p_description: parsed.data.description || null,
    p_created_by: user?.id ?? null,
  });

  if (error) return { error: "Erro ao criar quadro." };

  await logAudit({
    action: "create",
    tableName: "kanban_boards",
    recordId: data as string,
    details: { title: parsed.data.title },
  });

  revalidatePath("/tarefas");
  return { data: data as string };
}

export async function updateBoardAction(boardId: string, formData: BoardFormData) {
  const parsed = boardSchema.safeParse(formData);
  if (!parsed.success || !uuid.safeParse(boardId).success) {
    return { error: parsed.error?.errors[0].message ?? "Quadro inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("kanban_boards")
    .update({ title: parsed.data.title, description: parsed.data.description || null })
    .eq("id", boardId);

  if (error) return { error: "Erro ao atualizar quadro." };

  await logAudit({
    action: "update",
    tableName: "kanban_boards",
    recordId: boardId,
    details: { title: parsed.data.title },
  });

  revalidatePath("/tarefas");
  return { success: true };
}

export async function archiveBoardAction(boardId: string) {
  if (!uuid.safeParse(boardId).success) return { error: "Quadro inválido." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("kanban_boards")
    .update({ archived: true })
    .eq("id", boardId);

  if (error) return { error: "Erro ao arquivar quadro." };

  await logAudit({
    action: "archive",
    tableName: "kanban_boards",
    recordId: boardId,
  });

  revalidatePath("/tarefas");
  return { success: true };
}

export async function updateWipLimitsAction(formData: WipLimitsFormData) {
  const parsed = wipLimitsSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();
  const results = await Promise.all(
    parsed.data.columns.map((col) =>
      supabase.from("kanban_columns").update({ wip_limit: col.wip_limit }).eq("id", col.id)
    )
  );

  if (results.some((r) => r.error)) return { error: "Erro ao salvar limites WIP." };

  revalidatePath("/tarefas");
  return { success: true };
}
