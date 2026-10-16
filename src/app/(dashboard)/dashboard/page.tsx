"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  FileText,
  FolderOpen,
  KanbanSquare,
  AlertTriangle,
  TrendingUp,
  Clock,
} from "lucide-react";
import { formatCurrency, getStatusLabel } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface DashboardStats {
  totalClients: number;
  proposalsByStatus: Record<string, number>;
  activeContracts: number;
  expiringContracts: number;
  tasksByColumn: Record<string, number>;
  tasksByPriority: Record<string, number>;
  totalContractValue: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const supabase = createClient();

      const [clientsRes, proposalsRes, contractsRes, tasksRes] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("proposals").select("status"),
        supabase.from("contracts").select("status, end_date, monthly_amount"),
        supabase.from("tasks").select("column_status, priority"),
      ]);

      const proposalsByStatus: Record<string, number> = {};
      proposalsRes.data?.forEach((p) => {
        proposalsByStatus[p.status] = (proposalsByStatus[p.status] ?? 0) + 1;
      });

      const now = new Date();
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const activeContracts = contractsRes.data?.filter((c) => c.status === "active").length ?? 0;
      const expiringContracts = contractsRes.data?.filter((c) => {
        const endDate = new Date(c.end_date);
        return c.status === "active" && endDate <= thirtyDays && endDate >= now;
      }).length ?? 0;
      const totalContractValue = contractsRes.data
        ?.filter((c) => c.status === "active")
        .reduce((sum, c) => sum + Number(c.monthly_amount), 0) ?? 0;

      const tasksByColumn: Record<string, number> = {};
      const tasksByPriority: Record<string, number> = {};
      tasksRes.data?.forEach((t) => {
        tasksByColumn[t.column_status] = (tasksByColumn[t.column_status] ?? 0) + 1;
        tasksByPriority[t.priority] = (tasksByPriority[t.priority] ?? 0) + 1;
      });

      setStats({
        totalClients: clientsRes.count ?? 0,
        proposalsByStatus,
        activeContracts,
        expiringContracts,
        tasksByColumn,
        tasksByPriority,
        totalContractValue,
      });
      setLoading(false);
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    { title: "Clientes", value: stats.totalClients, icon: Users, color: "text-primary" },
    {
      title: "Propostas Ativas",
      value: (stats.proposalsByStatus["draft"] ?? 0) + (stats.proposalsByStatus["sent"] ?? 0),
      icon: FileText,
      color: "text-info",
    },
    { title: "Contratos Ativos", value: stats.activeContracts, icon: FolderOpen, color: "text-success" },
    {
      title: "Tarefas Pendentes",
      value: (stats.tasksByColumn["todo"] ?? 0) + (stats.tasksByColumn["in_progress"] ?? 0),
      icon: KanbanSquare,
      color: "text-warning",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do sistema PDVTEC</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Propostas por Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Propostas por Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(stats.proposalsByStatus).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma proposta registrada</p>
            ) : (
              Object.entries(stats.proposalsByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <Badge variant="secondary">{getStatusLabel(status)}</Badge>
                  <span className="font-semibold">{count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Contratos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Contratos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Receita Mensal</span>
              <span className="font-semibold">{formatCurrency(stats.totalContractValue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Ativos</span>
              <span className="font-semibold">{stats.activeContracts}</span>
            </div>
            {stats.expiringContracts > 0 && (
              <div className="flex items-center justify-between text-warning">
                <span className="flex items-center gap-1 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  Vencendo em 30 dias
                </span>
                <span className="font-semibold">{stats.expiringContracts}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tarefas por Coluna */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Tarefas por Etapa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {["todo", "in_progress", "review", "done"].map((col) => (
              <div key={col} className="flex items-center justify-between">
                <Badge variant="outline">{getStatusLabel(col)}</Badge>
                <span className="font-semibold">{stats.tasksByColumn[col] ?? 0}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
