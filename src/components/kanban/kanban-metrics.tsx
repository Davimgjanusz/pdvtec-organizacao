"use client";

import { useMemo, useState } from "react";
import { addWeeks, differenceInMinutes, format, isWithinInterval, startOfWeek, subDays } from "date-fns";
import { ptBR } from "@/lib/date";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OptionSelect } from "@/components/ui/option-select";
import type { Task } from "@/types/database";
import type { BoardColumn } from "./kanban-board";
import { getWipState } from "./kanban-column";
import { cn } from "@/lib/utils";
import { AlertTriangle, BarChart3, Clock, Timer, Users } from "lucide-react";

interface KanbanMetricsProps {
  tasks: Task[];
  columns: BoardColumn[];
}

const PERIOD_OPTIONS = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 180 dias" },
  { value: "all", label: "Todo o período" },
];

const WEEKS_IN_CHART = 8;

function average(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/** Duração legível: horas abaixo de 1 dia, dias com uma casa decimal acima disso */
function formatDuration(minutes: number | null) {
  if (minutes === null) return { value: "—", unit: "" };
  const days = minutes / 1440;
  if (days < 1) return { value: Math.max(1, Math.round(minutes / 60)).toLocaleString("pt-BR"), unit: "horas" };
  return { value: days.toLocaleString("pt-BR", { maximumFractionDigits: 1 }), unit: days < 2 ? "dia" : "dias" };
}

export function KanbanMetrics({ tasks, columns }: KanbanMetricsProps) {
  const [period, setPeriod] = useState("30");

  const metrics = useMemo(() => {
    const now = new Date();
    const from = period === "all" ? null : subDays(now, Number(period));
    const completed = tasks.filter(
      (t) => t.column_status === "done" && t.completed_at && (!from || new Date(t.completed_at) >= from)
    );

    const leadTimes = completed.map((t) => differenceInMinutes(new Date(t.completed_at!), new Date(t.created_at)));
    const cycleTimes = completed
      .filter((t) => t.started_at)
      .map((t) => differenceInMinutes(new Date(t.completed_at!), new Date(t.started_at!)));

    const periodDays = from ? Number(period) : null;
    const throughputPerWeek = periodDays ? (completed.length / periodDays) * 7 : null;

    // Throughput das últimas semanas (segunda a domingo)
    const firstWeek = startOfWeek(addWeeks(now, -(WEEKS_IN_CHART - 1)), { weekStartsOn: 1 });
    const weeks = Array.from({ length: WEEKS_IN_CHART }, (_, i) => {
      const start = addWeeks(firstWeek, i);
      const end = addWeeks(start, 1);
      const count = tasks.filter(
        (t) =>
          t.column_status === "done" &&
          t.completed_at &&
          isWithinInterval(new Date(t.completed_at), { start, end: new Date(end.getTime() - 1) })
      ).length;
      return { start, count, label: format(start, "dd/MM", { locale: ptBR }) };
    });

    const active = tasks.filter((t) => t.column_status !== "done");
    const byAssignee = new Map<string, { name: string; count: number }>();
    for (const t of active) {
      const key = t.assigned_to ?? "none";
      const entry = byAssignee.get(key) ?? { name: t.assignee?.full_name ?? "Sem responsável", count: 0 };
      entry.count++;
      byAssignee.set(key, entry);
    }

    const columnCounts: Record<string, number> = {};
    for (const t of tasks) columnCounts[t.column_status] = (columnCounts[t.column_status] ?? 0) + 1;

    return {
      leadTime: average(leadTimes),
      cycleTime: average(cycleTimes),
      sampleSize: completed.length,
      cycleSample: cycleTimes.length,
      throughput: completed.length,
      throughputPerWeek,
      weeks,
      wip: active.length,
      columnCounts,
      assignees: Array.from(byAssignee.values()).sort((a, b) => b.count - a.count),
    };
  }, [tasks, period]);

  const lead = formatDuration(metrics.leadTime);
  const cycle = formatDuration(metrics.cycleTime);
  const maxWeek = Math.max(1, ...metrics.weeks.map((w) => w.count));
  const periodLabel = PERIOD_OPTIONS.find((p) => p.value === period)?.label.toLowerCase();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Métricas calculadas sobre as tarefas concluídas do quadro selecionado ({periodLabel}).
        </p>
        <OptionSelect
          value={period}
          onValueChange={setPeriod}
          options={PERIOD_OPTIONS}
          className="sm:w-[200px]"
          aria-label="Período das métricas"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={Clock}
          label="Lead Time Médio"
          value={lead.value}
          unit={lead.unit}
          hint={`Da criação à conclusão · ${metrics.sampleSize} tarefa(s)`}
        />
        <StatTile
          icon={Timer}
          label="Cycle Time Médio"
          value={cycle.value}
          unit={cycle.unit}
          hint={`Do início do trabalho à conclusão · ${metrics.cycleSample} tarefa(s)`}
        />
        <StatTile
          icon={BarChart3}
          label="Throughput"
          value={metrics.throughput.toLocaleString("pt-BR")}
          unit={metrics.throughput === 1 ? "tarefa" : "tarefas"}
          hint={
            metrics.throughputPerWeek !== null
              ? `Média de ${metrics.throughputPerWeek.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} por semana`
              : "Concluídas em todo o período"
          }
        />
        <StatTile
          icon={Users}
          label="WIP Atual"
          value={metrics.wip.toLocaleString("pt-BR")}
          unit="em andamento"
          hint="Tarefas ainda não concluídas"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Throughput semanal</CardTitle>
            <CardDescription>Tarefas concluídas por semana (últimas {WEEKS_IN_CHART} semanas)</CardDescription>
          </CardHeader>
          <CardContent>
            <WeeklyThroughputChart weeks={metrics.weeks} max={maxWeek} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição e WIP por coluna</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {columns.map((col) => {
              const count = metrics.columnCounts[col.slug] ?? 0;
              const state = getWipState(count, col.wipLimit);
              const base = col.wipLimit ?? Math.max(1, tasks.length);
              const pct = Math.min(100, Math.round((count / base) * 100));
              return (
                <div key={col.slug} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span>{col.title}</span>
                    <span className={cn("flex items-center gap-1 font-medium tabular-nums", state === "over" && "text-destructive")}>
                      {state === "over" && <AlertTriangle className="h-3.5 w-3.5" aria-label="Limite WIP excedido" />}
                      {count}
                      {col.wipLimit ? <span className="-ml-1 text-muted-foreground">/{col.wipLimit}</span> : null}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", state === "over" ? "bg-destructive" : "bg-chart-1")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Carga por responsável</CardTitle>
          <CardDescription>Tarefas não concluídas</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.assignees.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span className="truncate">{entry.name}</span>
              <Badge variant="outline" className="font-mono">
                {entry.count}
              </Badge>
            </div>
          ))}
          {metrics.assignees.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tarefa ativa.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  unit,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  unit: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums">
            {value} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
          </p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function WeeklyThroughputChart({ weeks, max }: { weeks: { start: Date; count: number; label: string }[]; max: number }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = weeks.reduce((s, w) => s + w.count, 0);

  return (
    <figure>
      <div className="relative flex h-44 items-end gap-0.5 border-b border-border" role="img" aria-label={`Throughput semanal: ${total} tarefas concluídas em ${weeks.length} semanas`}>
        {weeks.map((w, i) => {
          const height = (w.count / max) * 100;
          const isLast = i === weeks.length - 1;
          return (
            <div
              key={w.label}
              className="group relative flex h-full flex-1 items-end justify-center"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              tabIndex={0}
              aria-label={`Semana de ${w.label}: ${w.count} concluída(s)`}
            >
              {(hovered === i || (hovered === null && isLast)) && w.count > 0 && (
                <span className="absolute -translate-y-1 text-xs font-medium tabular-nums text-foreground" style={{ bottom: `${height}%` }}>
                  {w.count}
                </span>
              )}
              <div
                className={cn("w-full max-w-6 rounded-t bg-chart-1 transition-opacity", hovered !== null && hovered !== i && "opacity-50")}
                style={{ height: `${height}%`, minHeight: w.count > 0 ? 4 : 0 }}
              />
              {hovered === i && (
                <div className="pointer-events-none absolute bottom-full z-10 mb-6 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md">
                  Semana de {w.label}
                  <div className="font-semibold tabular-nums">{w.count} concluída(s)</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-0.5">
        {weeks.map((w) => (
          <span key={w.label} className="flex-1 text-center text-[11px] text-muted-foreground tabular-nums">
            {w.label}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        <table>
          <thead>
            <tr>
              <th>Semana</th>
              <th>Concluídas</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.label}>
                <td>{w.label}</td>
                <td>{w.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
