"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Task } from "@/types/database";
import { getPriorityLabel } from "@/lib/utils";
import { Clock, TrendingUp, BarChart3, Users } from "lucide-react";

interface KanbanMetricsProps {
  tasks: Task[];
}

function daysBetween(a: string, b: string): number {
  const diff = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

export function KanbanMetrics({ tasks }: KanbanMetricsProps) {
  const metrics = useMemo(() => {
    const completedTasks = tasks.filter((t) => t.completed_at);
    const now = new Date();

    const leadTimes = completedTasks
      .filter((t) => t.completed_at)
      .map((t) => daysBetween(t.created_at, t.completed_at!));

    const avgLeadTime = leadTimes.length > 0
      ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length)
      : 0;

    const cycleTimes = completedTasks
      .filter((t) => t.started_at && t.completed_at)
      .map((t) => daysBetween(t.started_at!, t.completed_at!));

    const avgCycleTime = cycleTimes.length > 0
      ? Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length)
      : 0;

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentCompleted = completedTasks.filter(
      (t) => new Date(t.completed_at!) >= thirtyDaysAgo
    );
    const throughputMonth = recentCompleted.length;

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weeklyCompleted = completedTasks.filter(
      (t) => new Date(t.completed_at!) >= sevenDaysAgo
    );
    const throughputWeek = weeklyCompleted.length;

    const columnCounts: Record<string, number> = {};
    const columnLabels: Record<string, string> = {
      todo: "A Fazer",
      in_progress: "Em Andamento",
      review: "Em Revisão",
      done: "Concluído",
    };
    for (const t of tasks) {
      columnCounts[t.column_status] = (columnCounts[t.column_status] || 0) + 1;
    }

    const assigneeCounts: Record<string, { name: string; count: number }> = {};
    for (const t of tasks.filter((t) => t.column_status !== "done")) {
      const key = t.assigned_to ?? "unassigned";
      const name = t.assignee?.full_name ?? "Não atribuído";
      if (!assigneeCounts[key]) assigneeCounts[key] = { name, count: 0 };
      assigneeCounts[key].count++;
    }

    return {
      avgLeadTime,
      avgCycleTime,
      throughputMonth,
      throughputWeek,
      totalActive: tasks.filter((t) => t.column_status !== "done").length,
      totalDone: completedTasks.length,
      columnCounts,
      columnLabels,
      assigneeCounts,
    };
  }, [tasks]);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Lead Time Médio</p>
              <p className="text-xl font-bold">{metrics.avgLeadTime} <span className="text-sm font-normal text-muted-foreground">dias</span></p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
              <TrendingUp className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cycle Time Médio</p>
              <p className="text-xl font-bold">{metrics.avgCycleTime} <span className="text-sm font-normal text-muted-foreground">dias</span></p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <BarChart3 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vazão (30 dias)</p>
              <p className="text-xl font-bold">{metrics.throughputMonth} <span className="text-sm font-normal text-muted-foreground">tarefas</span></p>
              <p className="text-xs text-muted-foreground">{metrics.throughputWeek} esta semana</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <Users className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">WIP Atual</p>
              <p className="text-xl font-bold">{metrics.totalActive} <span className="text-sm font-normal text-muted-foreground">ativas</span></p>
              <p className="text-xs text-muted-foreground">{metrics.totalDone} concluídas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribution */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Distribuição por Coluna</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(metrics.columnLabels).map(([slug, label]) => {
              const count = metrics.columnCounts[slug] ?? 0;
              const total = Math.max(1, Object.values(metrics.columnCounts).reduce((a, b) => a + b, 0));
              const pct = Math.round((count / total) * 100);
              return (
                <div key={slug} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{label}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Carga por Responsável</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.values(metrics.assigneeCounts)
              .sort((a, b) => b.count - a.count)
              .map((entry) => (
                <div key={entry.name} className="flex items-center justify-between text-sm">
                  <span>{entry.name}</span>
                  <Badge variant="outline" className="font-mono">{entry.count}</Badge>
                </div>
              ))}
            {Object.keys(metrics.assigneeCounts).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma tarefa ativa.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
