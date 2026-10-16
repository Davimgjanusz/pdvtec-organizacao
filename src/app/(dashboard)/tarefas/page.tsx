"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/permissions";
import { createTaskAction, updateTaskAction } from "@/services/tasks";
import { createBoardAction, archiveBoardAction, updateColumnWipLimitAction } from "@/services/boards";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { KanbanMetrics } from "@/components/kanban/kanban-metrics";
import { TaskForm } from "@/components/forms/task-form";
import type { Task, KanbanBoard as KanbanBoardType, KanbanColumn as KanbanColumnType } from "@/types/database";
import type { TaskFormData } from "@/lib/validations/schemas";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Loader2,
  LayoutGrid,
  BarChart3,
  Settings2,
  Archive,
} from "lucide-react";
import { toast } from "sonner";

type SwimlaneMode = "none" | "priority" | "assignee";

export default function TarefasPage() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [boards, setBoards] = useState<KanbanBoardType[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [swimlaneMode, setSwimlaneMode] = useState<SwimlaneMode>("none");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [boardDialogOpen, setBoardDialogOpen] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [newBoardDesc, setNewBoardDesc] = useState("");
  const [wipDialogOpen, setWipDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("board");

  const canCreate = profile ? hasPermission(profile.role, "tasks:create") : false;

  const fetchBoards = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("kanban_boards")
      .select("*, columns:kanban_columns(*)")
      .eq("archived", false)
      .order("created_at", { ascending: true });

    const sorted = (data ?? []).map((b) => ({
      ...b,
      columns: ((b.columns ?? []) as KanbanColumnType[]).sort(
        (a: KanbanColumnType, b: KanbanColumnType) => a.position - b.position
      ),
    })) as KanbanBoardType[];

    setBoards(sorted);
    if (!selectedBoardId && sorted.length > 0) {
      setSelectedBoardId(sorted[0].id);
    }
  }, [selectedBoardId]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("tasks")
      .select("*, contract:contracts(*, client:clients(*)), assignee:profiles(*)")
      .order("position");

    if (selectedBoardId) {
      query = query.eq("board_id", selectedBoardId);
    }

    const { data } = await query;
    setTasks((data ?? []) as Task[]);
    setLoading(false);
  }, [selectedBoardId]);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (search) {
      result = result.filter((t) =>
        t.title.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (priorityFilter !== "all") {
      result = result.filter((t) => t.priority === priorityFilter);
    }
    if (assigneeFilter !== "all") {
      if (assigneeFilter === "unassigned") {
        result = result.filter((t) => !t.assigned_to);
      } else {
        result = result.filter((t) => t.assigned_to === assigneeFilter);
      }
    }
    return result;
  }, [tasks, search, priorityFilter, assigneeFilter]);

  const uniqueAssignees = useMemo(() => Array.from(
    new Map(
      tasks
        .filter((t) => t.assignee)
        .map((t) => [t.assignee!.id, t.assignee!])
    ).values()
  ), [tasks]);

  const selectedBoard = boards.find((b) => b.id === selectedBoardId);

  const swimlaneGroups = useMemo(() => {
    if (swimlaneMode === "none") return [{ key: "all", label: "Todas", tasks: filteredTasks }];

    if (swimlaneMode === "priority") {
      const priorities = ["urgent", "high", "medium", "low"] as const;
      const labels: Record<string, string> = { urgent: "Urgente", high: "Alta", medium: "Média", low: "Baixa" };
      return priorities
        .map((p) => ({
          key: p,
          label: labels[p],
          tasks: filteredTasks.filter((t) => t.priority === p),
        }))
        .filter((g) => g.tasks.length > 0);
    }

    if (swimlaneMode === "assignee") {
      const groups: { key: string; label: string; tasks: Task[] }[] = [];
      const byAssignee = new Map<string, Task[]>();

      for (const t of filteredTasks) {
        const key = t.assigned_to ?? "unassigned";
        if (!byAssignee.has(key)) byAssignee.set(key, []);
        byAssignee.get(key)!.push(t);
      }

      for (const [key, tasks] of byAssignee) {
        const label = key === "unassigned"
          ? "Não Atribuído"
          : tasks[0]?.assignee?.full_name ?? "Desconhecido";
        groups.push({ key, label, tasks });
      }

      return groups.sort((a, b) => a.label.localeCompare(b.label));
    }

    return [{ key: "all", label: "Todas", tasks: filteredTasks }];
  }, [filteredTasks, swimlaneMode]);

  const handleCreate = async (data: TaskFormData) => {
    const payload = { ...data, board_id: selectedBoardId } as TaskFormData & { board_id: string | null };
    const result = await createTaskAction(payload);
    if (result.error) return { error: result.error };
    toast.success("Tarefa criada!");
    setDialogOpen(false);
    fetchTasks();
    return {};
  };

  const handleUpdate = async (data: TaskFormData) => {
    if (!editingTask) return { error: "Erro interno." };
    const result = await updateTaskAction(editingTask.id, data);
    if (result.error) return { error: result.error };
    toast.success("Tarefa atualizada!");
    setEditingTask(null);
    fetchTasks();
    return {};
  };

  const handleCreateBoard = async () => {
    if (!newBoardTitle.trim()) {
      toast.error("Título do quadro é obrigatório.");
      return;
    }
    const result = await createBoardAction({
      title: newBoardTitle.trim(),
      description: newBoardDesc.trim() || null,
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Quadro criado!");
    setNewBoardTitle("");
    setNewBoardDesc("");
    setBoardDialogOpen(false);
    setSelectedBoardId(result.data ?? null);
    fetchBoards();
  };

  const handleArchiveBoard = async () => {
    if (!selectedBoardId) return;
    const result = await archiveBoardAction(selectedBoardId);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Quadro arquivado!");
    setSelectedBoardId(null);
    fetchBoards();
  };

  if (loading && boards.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tarefas</h1>
          <p className="text-muted-foreground">Gerencie as tarefas operacionais</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setBoardDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Quadro
          </Button>
          {canCreate && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Tarefa
            </Button>
          )}
        </div>
      </div>

      {/* Board selector */}
      {boards.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {boards.map((board) => (
            <Button
              key={board.id}
              variant={board.id === selectedBoardId ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedBoardId(board.id)}
            >
              <LayoutGrid className="mr-2 h-4 w-4" />
              {board.title}
            </Button>
          ))}
          {selectedBoard && boards.length > 1 && (
            <Button variant="ghost" size="sm" onClick={handleArchiveBoard} title="Arquivar quadro">
              <Archive className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      )}

      {/* Tabs: Quadro / Métricas */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
          {/* Filters */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar tarefa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v ?? "all")}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Prioridade</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={(v) => setAssigneeFilter(v ?? "all")}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Responsável</SelectItem>
                <SelectItem value="unassigned">Sem responsável</SelectItem>
                {uniqueAssignees.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={swimlaneMode} onValueChange={(v) => setSwimlaneMode((v ?? "none") as SwimlaneMode)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem Raias</SelectItem>
                <SelectItem value="priority">Raias: Prioridade</SelectItem>
                <SelectItem value="assignee">Raias: Responsável</SelectItem>
              </SelectContent>
            </Select>
            {selectedBoard && (
              <Button variant="outline" size="icon" onClick={() => setWipDialogOpen(true)} title="Configurar WIP Limits">
                <Settings2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Board with swimlanes */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              {swimlaneGroups.map((group) => (
                <div key={group.key}>
                  {swimlaneMode !== "none" && (
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-semibold">
                        {group.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {group.tasks.length} tarefa(s)
                      </span>
                    </div>
                  )}
                  <KanbanBoard
                    tasks={group.tasks}
                    columns={selectedBoard?.columns}
                    onTasksChange={fetchTasks}
                    onEditTask={(task) => setEditingTask(task)}
                  />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="metrics" className="mt-4">
          <KanbanMetrics tasks={tasks} />
        </TabsContent>
      </Tabs>

      {/* Dialog: Nova tarefa */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <TaskForm onSubmit={handleCreate} onCancel={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar tarefa */}
      <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Tarefa</DialogTitle>
          </DialogHeader>
          {editingTask && (
            <TaskForm
              defaultValues={editingTask}
              onSubmit={handleUpdate}
              onCancel={() => setEditingTask(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Novo quadro */}
      <Dialog open={boardDialogOpen} onOpenChange={setBoardDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Quadro Kanban</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="board-title">Título</Label>
              <Input
                id="board-title"
                value={newBoardTitle}
                onChange={(e) => setNewBoardTitle(e.target.value)}
                placeholder="Ex.: Implantações PDV"
              />
            </div>
            <div>
              <Label htmlFor="board-desc">Descrição (opcional)</Label>
              <Input
                id="board-desc"
                value={newBoardDesc}
                onChange={(e) => setNewBoardDesc(e.target.value)}
                placeholder="Descreva o propósito deste quadro"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBoardDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateBoard}>Criar Quadro</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: WIP Limits */}
      <Dialog open={wipDialogOpen} onOpenChange={setWipDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Limites WIP — {selectedBoard?.title}</DialogTitle>
          </DialogHeader>
          {selectedBoard?.columns && (
            <WipLimitEditor
              columns={selectedBoard.columns}
              onSave={() => {
                setWipDialogOpen(false);
                fetchBoards();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WipLimitEditor({
  columns,
  onSave,
}: {
  columns: KanbanColumnType[];
  onSave: () => void;
}) {
  const [limits, setLimits] = useState<Record<string, string>>(
    Object.fromEntries(columns.map((c) => [c.id, c.wip_limit?.toString() ?? ""]))
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    for (const col of columns) {
      const raw = limits[col.id];
      const wipLimit = raw === "" ? null : parseInt(raw, 10);
      if (raw !== "" && (isNaN(wipLimit as number) || (wipLimit as number) < 1)) {
        toast.error(`Limite inválido para "${col.title}". Use um número >= 1 ou deixe vazio.`);
        setSaving(false);
        return;
      }
      await updateColumnWipLimitAction(col.id, wipLimit);
    }
    toast.success("Limites WIP salvos!");
    setSaving(false);
    onSave();
  };

  return (
    <div className="space-y-4">
      {columns.map((col) => (
        <div key={col.id} className="flex items-center gap-3">
          <Label className="flex-1">{col.title}</Label>
          <Input
            type="number"
            min="1"
            className="w-24"
            placeholder="Sem limite"
            value={limits[col.id]}
            onChange={(e) => setLimits((prev) => ({ ...prev, [col.id]: e.target.value }))}
          />
        </div>
      ))}
      <div className="flex justify-end gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}
