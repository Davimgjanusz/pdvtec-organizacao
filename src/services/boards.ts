"use server";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const boardSchema = z.object({
  title: z.string().min(1, "Título é obrigatório").max(200),
  description: z.string().max(1000).nullable().optional(),
});

export type BoardFormData = z.infer<typeof boardSchema>;

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
    p_description: parsed.data.description ?? null,
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

export async function archiveBoardAction(boardId: string) {
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

export async function updateColumnWipLimitAction(
  columnId: string,
  wipLimit: number | null
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("kanban_columns")
    .update({ wip_limit: wipLimit })
    .eq("id", columnId);

  if (error) return { error: "Erro ao atualizar limite WIP." };

  revalidatePath("/tarefas");
  return { success: true };
}
