"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/permissions";
import { createTaskAction, deleteTaskAction, moveTasksAction, updateTaskAction } from "@/services/tasks";
import { archiveBoardAction, createBoardAction, updateBoardAction } from "@/services/boards";
import { KanbanBoard, type BoardColumn } from "@/components/kanban/kanban-board";
import { KanbanMetrics } from "@/components/kanban/kanban-metrics";
import { BoardForm, WipLimitsForm } from "@/components/kanban/board-forms";
import { TaskForm } from "@/components/forms/task-form";
import {
  DEFAULT_COLUMNS,
  NO_LANE,
  SWIMLANE_OPTIONS,
  buildLanes,

  type SwimlaneMode,
} from "@/lib/kanban";
import { PRIORITY_OPTIONS } from "@/lib/utils";
import type {
  Task,
  Profile,
  TaskColumnStatus,
  KanbanBoard as KanbanBoardType,
  KanbanColumn as KanbanColumnType,
} from "@/types/database";
import type { TaskFormData, TaskMove } from "@/lib/validations/schemas";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OptionSelect } from "@/components/ui/option-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Loader2, LayoutGrid, BarChart3, Gauge, Archive, Pencil, KanbanSquare } from "lucide-react";
import { toast } from "@/lib/notify";
import { useConfirm } from "@/components/ui/confirm-dialog";

const TASK_SELECT = "*, contract:contracts(*, client:clients(*)), assignee:profiles(*)";
const STORAGE_BOARD = "pdvtec-kanban-board";
const STORAGE_LANES = "pdvtec-kanban-swimlanes";

function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Armazenamento indisponível (modo privado); preferência não é persistida
  }
}

type NewTaskPreset = Partial<TaskFormData> | null;

export default function TarefasPage() {
  const { profile } = useAuth();
  const confirm = useConfirm();
  const [boards, setBoards] = useState<KanbanBoardType[]>([]);
  const [boardsLoaded, setBoardsLoaded] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  // Quadro cujas tarefas estão carregadas; enquanto difere do selecionado, exibe carregamento
  const [loadedBoardId, setLoadedBoardId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [swimlaneMode, setSwimlaneMode] = useState<SwimlaneMode>(() => {
    const stored = readStorage(STORAGE_LANES);
    return SWIMLANE_OPTIONS.find((o) => o.value === stored)?.value ?? "none";
  });

  const [newTaskPreset, setNewTaskPreset] = useState<NewTaskPreset>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [boardDialog, setBoardDialog] = useState<"create" | "edit" | null>(null);
  const [wipDialogOpen, setWipDialogOpen] = useState(false);

  // Fila que serializa a persistência dos movimentos otimistas
  const persistQueue = useRef<Promise<unknown>>(Promise.resolve());

  const role = profile?.role;
  const canEdit = role ? hasPermission(role, "tasks:edit") : false;
  const canCreate = role ? hasPermission(role, "tasks:create") : false;
  const canDelete = role ? hasPermission(role, "tasks:delete") : false;

  const selectedBoard = boards.find((b) => b.id === selectedBoardId) ?? null;

  const columns: BoardColumn[] = useMemo(() => {
    const source = selectedBoard?.columns?.length
      ? selectedBoard.columns.map((c) => ({ slug: c.slug as TaskColumnStatus, title: c.title, wipLimit: c.wip_limit }))
      : DEFAULT_COLUMNS.map((c) => ({ ...c, wipLimit: null }));
    return source;
  }, [selectedBoard]);

  const fetchBoards = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("kanban_boards")
      .select("*, columns:kanban_columns(*)")
      .eq("archived", false)
      .order("created_at", { ascending: true });

    if (error) toast.error("Erro ao carregar os quadros.");

    const sorted = (data ?? []).map((b) => ({
      ...b,
      columns: ((b.columns ?? []) as KanbanColumnType[]).sort((a, c) => a.position - c.position),
    })) as KanbanBoardType[];

    setBoards(sorted);
    setBoardsLoaded(true);
    setSelectedBoardId((current) => {
      if (current && sorted.some((b) => b.id === current)) return current;
      const stored = readStorage(STORAGE_BOARD);
      return sorted.find((b) => b.id === stored)?.id ?? sorted[0]?.id ?? null;
    });
  }, []);

  const fetchTasks = useCallback(async (boardId: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.from("tasks").select(TASK_SELECT).eq("board_id", boardId).order("position");
    if (error) toast.error("Erro ao carregar as tarefas.");
    setTasks((data ?? []) as Task[]);
    setLoadedBoardId(boardId);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("*")
      .order("full_name")
      .then(({ data, error }) => {
        if (error) toast.error("Erro ao carregar a lista de colaboradores.", { id: "carregar-colaboradores" });
        setProfiles((data ?? []) as Profile[]);
      });
  }, []);

  useEffect(() => {
    // Carregamento inicial dos quadros (todos os setState ocorrem após o await)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBoards();
  }, [fetchBoards]);

  useEffect(() => {
    if (!selectedBoardId) return;
    writeStorage(STORAGE_BOARD, selectedBoardId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTasks(selectedBoardId);
  }, [selectedBoardId, fetchTasks]);

  const loadingTasks = !!selectedBoardId && loadedBoardId !== selectedBoardId;

  const isVisible = useCallback(
    (t: Task) => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (assigneeFilter === NO_LANE) return !t.assigned_to;
      if (assigneeFilter !== "all" && t.assigned_to !== assigneeFilter) return false;
      return true;
    },
    [search, priorityFilter, assigneeFilter]
  );

  const lanes = useMemo(() => buildLanes(swimlaneMode, tasks, profiles), [swimlaneMode, tasks, profiles]);

  // Ao trocar de raia, atualiza também os objetos relacionados exibidos no cartão
  const resolveLanePatch = useCallback(
    (laneKey: string): Partial<Task> => {
      if (swimlaneMode === "assignee") {
        return { assignee: laneKey === NO_LANE ? undefined : profiles.find((p) => p.id === laneKey) };
      }
      if (swimlaneMode === "contract") {
        return { contract: laneKey === NO_LANE ? undefined : tasks.find((t) => t.contract_id === laneKey)?.contract };
      }
      return {};
    },
    [swimlaneMode, profiles, tasks]
  );

  /** UI otimista: aplica o novo estado na hora e persiste em segundo plano */
  const handleMove = useCallback(
    (next: Task[], changes: TaskMove[], movedTaskId: string) => {
      setTasks(next);
      const boardId = selectedBoardId;
      persistQueue.current = persistQueue.current.then(async () => {
        // Nunca deixa a fila rejeitada: uma falha não pode impedir os próximos movimentos de salvar
        let failure: string | null = null;
        try {
          const result = await moveTasksAction({ board_id: boardId, moved_task_id: movedTaskId, changes });
          failure = result.error ?? null;
        } catch {
          failure = "Não foi possível salvar o movimento. Verifique sua conexão.";
        }
        if (failure) {
          toast.error(failure, { description: "O quadro foi recarregado com os dados do servidor." });
          if (boardId) await fetchTasks(boardId).catch(() => undefined);
        }
      });
    },
    [selectedBoardId, fetchTasks]
  );

  const handleCreateTask = async (data: TaskFormData) => {
    const result = await createTaskAction({ ...data, board_id: selectedBoardId });
    if (result.error) return { error: result.error };
    setTasks((prev) => [...prev, result.data as Task]);
    toast.success("Tarefa criada!");
    setNewTaskPreset(null);
    return {};
  };

  const handleUpdateTask = async (data: TaskFormData) => {
    if (!editingTask) return { error: "Erro interno." };
    const result = await updateTaskAction(editingTask.id, data);
    if (result.error) return { error: result.error };
    setTasks((prev) => prev.map((t) => (t.id === editingTask.id ? (result.data as Task) : t)));
    toast.success("Tarefa atualizada!");
    setEditingTask(null);
    return {};
  };

  const deleteTask = async (task: Task) => {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    const result = await deleteTaskAction(task.id);
    if (result.error) {
      toast.error(result.error);
      if (selectedBoardId) fetchTasks(selectedBoardId);
      return;
    }
    toast.success("Tarefa excluída.");
  };

  const handleDeleteTask = (task: Task) =>
    confirm({
      tone: "danger",
      title: "Excluir tarefa?",
      description: (
        <>
          <strong className="text-foreground">{task.title}</strong>
          <br />
          A tarefa será removida permanentemente. Esta ação não pode ser desfeita.
        </>
      ),
      confirmLabel: "Excluir",
      action: () => deleteTask(task),
    });

  const handleAddInColumn = useCallback((column: TaskColumnStatus) => {
    setNewTaskPreset({ column_status: column });
  }, []);

  const handleSaveBoard = async (data: { title: string; description?: string | null }) => {
    if (boardDialog === "edit" && selectedBoardId) {
      const result = await updateBoardAction(selectedBoardId, data);
      if (result.error) return { error: result.error };
      toast.success("Quadro atualizado!");
    } else {
      const result = await createBoardAction(data);
      if (result.error) return { error: result.error };
      toast.success("Quadro criado!");
      if (result.data) setSelectedBoardId(result.data);
    }
    setBoardDialog(null);
    await fetchBoards();
    return {};
  };

  const handleArchiveBoard = () => {
    if (!selectedBoardId || !selectedBoard) return;
    return confirm({
      tone: "warning",
      icon: Archive,
      title: "Arquivar quadro?",
      description: (
        <>
          <strong className="text-foreground">{selectedBoard.title}</strong>
          <br />
          O quadro deixará de aparecer na lista. As tarefas são preservadas.
        </>
      ),
      confirmLabel: "Arquivar",
      action: () => archiveBoard(selectedBoardId),
    });
  };

  const archiveBoard = async (boardId: string) => {
    const result = await archiveBoardAction(boardId);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Quadro arquivado!");
    setSelectedBoardId(null);
    fetchBoards();
  };

  const columnCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) counts[t.column_status] = (counts[t.column_status] ?? 0) + 1;
    return counts;
  }, [tasks]);

  if (!boardsLoaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tarefas</h1>
          <p className="text-muted-foreground">
            {selectedBoard?.description || "Gerencie o fluxo de trabalho em quadros Kanban"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {boards.length > 0 && (
            <OptionSelect
              value={selectedBoardId}
              onValueChange={setSelectedBoardId}
              options={boards.map((b) => ({ value: b.id, label: b.title }))}
              className="w-[220px]"
              aria-label="Selecionar quadro"
            />
          )}
          {selectedBoard && (
            <>
              <Button variant="outline" size="icon" onClick={() => setBoardDialog("edit")} aria-label="Editar quadro" title="Editar quadro">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setWipDialogOpen(true)} aria-label="Configurar limites WIP" title="Configurar limites WIP">
                <Gauge className="h-4 w-4" />
              </Button>
              {boards.length > 1 && (
                <Button variant="outline" size="icon" onClick={handleArchiveBoard} aria-label="Arquivar quadro" title="Arquivar quadro">
                  <Archive className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
          <Button variant="outline" onClick={() => setBoardDialog("create")}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Quadro
          </Button>
          {canCreate && selectedBoard && (
            <Button onClick={() => setNewTaskPreset({})}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Tarefa
            </Button>
          )}
        </div>
      </div>

      {!selectedBoard ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <KanbanSquare className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Nenhum quadro disponível</p>
              <p className="text-sm text-muted-foreground">Crie um quadro para organizar as tarefas da equipe.</p>
            </div>
            <Button onClick={() => setBoardDialog("create")}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Quadro
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="board">
          <TabsList>
            <TabsTrigger value="board" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              Quadro
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Métricas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="board" className="mt-4 space-y-4">
            {/* Filtros */}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar tarefa..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  aria-label="Buscar tarefa"
                />
              </div>
              <OptionSelect
                value={priorityFilter}
                onValueChange={setPriorityFilter}
                className="sm:w-[170px]"
                aria-label="Filtrar por prioridade"
                options={[{ value: "all", label: "Todas as prioridades" }, ...PRIORITY_OPTIONS]}
              />
              <OptionSelect
                value={assigneeFilter}
                onValueChange={setAssigneeFilter}
                className="sm:w-[190px]"
                aria-label="Filtrar por responsável"
                options={[
                  { value: "all", label: "Todos os responsáveis" },
                  { value: NO_LANE, label: "Sem responsável" },
                  ...profiles.map((p) => ({ value: p.id, label: p.full_name })),
                ]}
              />
              <OptionSelect
                value={swimlaneMode}
                onValueChange={(v) => {
                  setSwimlaneMode(v as SwimlaneMode);
                  writeStorage(STORAGE_LANES, v);
                }}
                className="sm:w-[210px]"
                aria-label="Agrupar em raias"
                options={SWIMLANE_OPTIONS}
              />
            </div>

            {loadingTasks ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <KanbanBoard
                tasks={tasks}
                isVisible={isVisible}
                columns={columns}
                lanes={lanes}
                swimlaneMode={swimlaneMode}
                canEdit={canEdit}
                onMove={handleMove}
                lanePatch={resolveLanePatch}
                onEditTask={canEdit ? setEditingTask : undefined}
                onDeleteTask={canDelete ? handleDeleteTask : undefined}
                onAddTask={canCreate ? handleAddInColumn : undefined}
              />
            )}
            {canEdit && !loadingTasks && tasks.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Dica: arraste o cartão inteiro entre colunas e raias. Clique duas vezes para editar.
              </p>
            )}
          </TabsContent>

          <TabsContent value="metrics" className="mt-4">
            <KanbanMetrics tasks={tasks} columns={columns} />
          </TabsContent>
        </Tabs>
      )}

      {/* Nova tarefa */}
      <Dialog open={!!newTaskPreset} onOpenChange={(open) => !open && setNewTaskPreset(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
            {selectedBoard && <DialogDescription>Quadro: {selectedBoard.title}</DialogDescription>}
          </DialogHeader>
          {newTaskPreset && (
            <TaskForm
              initialValues={newTaskPreset}
              columns={columns}
              onSubmit={handleCreateTask}
              onCancel={() => setNewTaskPreset(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Editar tarefa */}
      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Tarefa</DialogTitle>
          </DialogHeader>
          {editingTask && (
            <TaskForm
              defaultValues={editingTask}
              columns={columns}
              onSubmit={handleUpdateTask}
              onCancel={() => setEditingTask(null)}
            />
          )}
        </DialogContent>
      </Dialog>


      {/* Criar / editar quadro */}
      <Dialog open={!!boardDialog} onOpenChange={(open) => !open && setBoardDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{boardDialog === "edit" ? "Editar Quadro" : "Novo Quadro Kanban"}</DialogTitle>
            {boardDialog === "create" && (
              <DialogDescription>
                O quadro é criado com as colunas A Fazer, Em Andamento, Em Revisão e Concluído.
              </DialogDescription>
            )}
          </DialogHeader>
          {boardDialog && (
            <BoardForm
              key={boardDialog}
              defaultValues={
                boardDialog === "edit" && selectedBoard
                  ? { title: selectedBoard.title, description: selectedBoard.description ?? "" }
                  : undefined
              }
              onSubmit={handleSaveBoard}
              onCancel={() => setBoardDialog(null)}
            />
          )}
        </DialogContent>
      </Dialog>


      {/* Limites WIP */}
      <Dialog open={wipDialogOpen} onOpenChange={setWipDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Limites WIP — {selectedBoard?.title}</DialogTitle>
          </DialogHeader>
          {wipDialogOpen && selectedBoard?.columns && (
            <WipLimitsForm
              columns={selectedBoard.columns}
              counts={columnCounts}
              onSaved={() => {
                setWipDialogOpen(false);
                fetchBoards();
              }}
              onCancel={() => setWipDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
