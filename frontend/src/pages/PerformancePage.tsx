import React, { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, TrendingUp, Users, Target } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from "recharts";
import Button from "@/components/ui/Button";
import Card, { CardHeader } from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import KPICards from "@/components/performance/KPICards";
import ResponsibleTable from "@/components/performance/ResponsibleTable";
import AreaSummary from "@/components/performance/AreaSummary";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { tasksApi, usersApi, lookupsApi } from "@/services/api";
import type { Task, User, Lookups, PerformanceSummary, PerformanceFilters, AreaStats } from "@/types";

const STATUS_CHART_COLORS: Record<string, string> = {
  "Em Andamento": "#60a5fa",
  "Concluído": "#34d399",
  "Em Atraso": "#f87171",
  "Concluído em Atraso": "#fbbf24",
};

const DEFAULT_FILTERS: PerformanceFilters = {
  from: "", to: "", status: "", responsavel: "", recorrencia: "", tipo: "",
};

function getDefaultFrom(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 2);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getDefaultTo(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function PerformancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [lookups, setLookups] = useState<Lookups>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PerformanceFilters>({
    ...DEFAULT_FILTERS,
    from: getDefaultFrom(),
    to: getDefaultTo(),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, usersRes, lookupsRes] = await Promise.all([
        tasksApi.list(),
        usersApi.list(),
        lookupsApi.list(),
      ]);
      setAllTasks(tasksRes.tasks);
      setUsers(usersRes.users);
      setLookups(lookupsRes.lookups);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao carregar dados", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const set = (field: keyof PerformanceFilters, value: string) =>
    setFilters(f => ({ ...f, [field]: value }));

  // Apply filters
  const filtered = useMemo(() => {
    return allTasks.filter(t => {
      if (filters.from && t.competenciaYm < filters.from) return false;
      if (filters.to && t.competenciaYm > filters.to) return false;
      if (filters.status && t.status !== filters.status) return false;
      if (filters.responsavel && t.responsavelEmail !== filters.responsavel) return false;
      if (filters.recorrencia && t.recorrencia !== filters.recorrencia) return false;
      if (filters.tipo && t.tipo !== filters.tipo) return false;
      return true;
    });
  }, [allTasks, filters]);

  // Helper: contagem de justificativas para tarefas "Concluído em Atraso"
  const countJustification = useMemo(() => {
    const late = filtered.filter(t => t.status === "Concluído em Atraso");
    return {
      justificado: late.filter(t => t.justificationStatus === "approved").length,
      pendente: late.filter(t => t.justificationStatus === "pending").length,
      semJustificativa: late.filter(t =>
        !t.justificationStatus || ["none", "refused", "blocked"].includes(t.justificationStatus)
      ).length,
    };
  }, [filtered]);

  // Compute summary (com métricas de justificativa e por área)
  const summary = useMemo((): PerformanceSummary => {
    const byResp = new Map<string, { nome: string; tasks: Task[] }>();
    const byAreaMap = new Map<string, Task[]>();

    for (const t of filtered) {
      if (!byResp.has(t.responsavelEmail)) {
        byResp.set(t.responsavelEmail, { nome: t.responsavelNome, tasks: [] });
      }
      byResp.get(t.responsavelEmail)!.tasks.push(t);

      const areaKey = t.area?.trim() || "(sem área)";
      if (!byAreaMap.has(areaKey)) byAreaMap.set(areaKey, []);
      byAreaMap.get(areaKey)!.push(t);
    }

    const lateByResp = (tasks: Task[]) => tasks.filter(t => t.status === "Concluído em Atraso");
    const j = (tasks: Task[]) => {
      const l = lateByResp(tasks);
      return {
        justificado: l.filter(t => t.justificationStatus === "approved").length,
        pendente: l.filter(t => t.justificationStatus === "pending").length,
        sem: l.filter(t => !t.justificationStatus || ["none", "refused", "blocked"].includes(t.justificationStatus)).length,
      };
    };

    const byResponsavel = Array.from(byResp.entries()).map(([email, { nome, tasks }]) => {
      const lateCount = lateByResp(tasks).length;
      const { justificado, pendente, sem } = j(tasks);
      return {
        email,
        nome,
        total: tasks.length,
        concluido: tasks.filter(t => t.status === "Concluído").length,
        emAndamento: tasks.filter(t => t.status === "Em Andamento").length,
        emAtraso: tasks.filter(t => t.status === "Em Atraso").length,
        concluidoEmAtraso: lateCount,
        concluidoEmAtrasoJustificado: justificado,
        concluidoEmAtrasoPendente: pendente,
        concluidoEmAtrasoSemJustificativa: sem,
      };
    });

    const byArea: AreaStats[] = Array.from(byAreaMap.entries()).map(([area, tasks]) => {
      const lateCount = lateByResp(tasks).length;
      const { justificado, pendente, sem } = j(tasks);
      return {
        area,
        total: tasks.length,
        concluido: tasks.filter(t => t.status === "Concluído").length,
        emAndamento: tasks.filter(t => t.status === "Em Andamento").length,
        emAtraso: tasks.filter(t => t.status === "Em Atraso").length,
        concluidoEmAtraso: lateCount,
        concluidoEmAtrasoJustificado: justificado,
        concluidoEmAtrasoPendente: pendente,
        concluidoEmAtrasoSemJustificativa: sem,
      };
    }).sort((a, b) => a.area.localeCompare(b.area));

    const concluidoEmAtrasoTotal = filtered.filter(t => t.status === "Concluído em Atraso").length;

    return {
      total: filtered.length,
      emAndamento: filtered.filter(t => t.status === "Em Andamento").length,
      concluido: filtered.filter(t => t.status === "Concluído").length,
      emAtraso: filtered.filter(t => t.status === "Em Atraso").length,
      concluidoEmAtraso: concluidoEmAtrasoTotal,
      concluidoEmAtrasoJustificado: countJustification.justificado,
      concluidoEmAtrasoPendente: countJustification.pendente,
      concluidoEmAtrasoSemJustificativa: countJustification.semJustificativa,
      byResponsavel,
      byArea: byArea.length > 0 ? byArea : undefined,
      lastUpdated: new Date().toISOString(),
    };
  }, [filtered, countJustification]);

  const pieData = [
    { name: "Em Andamento", value: summary.emAndamento },
    { name: "Concluído", value: summary.concluido },
    { name: "Em Atraso", value: summary.emAtraso },
    { name: "Concluído em Atraso", value: summary.concluidoEmAtraso },
  ].filter(d => d.value > 0);

  const barData = summary.byResponsavel
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
    .map(r => ({
      name: r.nome.split(" ")[0],
      fullName: r.nome,
      Concluído: r.concluido,
      "Em Andamento": r.emAndamento,
      "Em Atraso": r.emAtraso,
      "Concl. Atraso": r.concluidoEmAtraso,
    }));

  const recorrenciaOptions = (lookups.RECORRENCIA || []).map(v => ({ value: v, label: v }));
  const tipoOptions = (lookups.TIPO || []).map(v => ({ value: v, label: v }));
  const userOptions = users.map(u => ({ value: u.email, label: u.nome }));

  const statusOptions = [
    { value: "Em Andamento", label: "Em Andamento" },
    { value: "Concluído", label: "Concluído" },
    { value: "Em Atraso", label: "Em Atraso" },
    { value: "Concluído em Atraso", label: "Concluído em Atraso" },
  ];

  function getYmOptions() {
    const options = [];
    for (let i = -24; i <= 3; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() + i);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
      options.push({ value: ym, label });
    }
    return options;
  }

  const isUser = user?.role === "USER";
  const isLeader = user?.role === "LEADER";
  const isAdmin = user?.role === "ADMIN";

  const tooltipStyle = useMemo(() => ({
    backgroundColor: "var(--tooltip-bg, #1e293b)",
    border: "1px solid var(--tooltip-border, #334155)",
    borderRadius: "10px",
    fontSize: "13px",
    padding: "10px 14px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  }), []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner text="Carregando indicadores..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header: orientado por perfil */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-brand-100 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-500/40 shrink-0">
            {isUser ? (
              <Target size={24} className="text-brand-700 dark:text-brand-300" />
            ) : isLeader ? (
              <Users size={24} className="text-brand-700 dark:text-brand-300" />
            ) : (
              <TrendingUp size={24} className="text-brand-700 dark:text-brand-300" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {isUser ? "Sua performance" : isLeader ? "Visão da sua área" : "Performance"}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              {isUser
                ? "Acompanhe suas tarefas e taxa de conclusão no período."
                : isLeader
                  ? "Indicadores e desempenho da sua área para decisão estratégica."
                  : "Análise de desempenho por área e responsável."}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={load} icon={<RefreshCw size={16} />} className="shrink-0">
          Atualizar
        </Button>
      </div>

      {/* Filtros: compactos e acessíveis */}
      <Card>
        <CardHeader
          title="Período e filtros"
          subtitle="Ajuste o intervalo e opcionalmente status, responsável, recorrência ou tipo"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">De</label>
            <Select
              value={filters.from}
              onChange={e => set("from", e.target.value)}
              options={getYmOptions()}
              placeholder="Competência inicial"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Até</label>
            <Select
              value={filters.to}
              onChange={e => set("to", e.target.value)}
              options={getYmOptions()}
              placeholder="Competência final"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Status</label>
            <Select
              value={filters.status}
              onChange={e => set("status", e.target.value)}
              options={statusOptions}
              placeholder="Todos"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Responsável</label>
            <Select
              value={filters.responsavel}
              onChange={e => set("responsavel", e.target.value)}
              options={userOptions}
              placeholder="Todos"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Recorrência</label>
            <Select
              value={filters.recorrencia}
              onChange={e => set("recorrencia", e.target.value)}
              options={recorrenciaOptions}
              placeholder="Todas"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Tipo</label>
            <Select
              value={filters.tipo}
              onChange={e => set("tipo", e.target.value)}
              options={tipoOptions}
              placeholder="Todos"
            />
          </div>
        </div>
        {Object.values(filters).some(Boolean) && (
          <button
            type="button"
            onClick={() => setFilters({ ...DEFAULT_FILTERS, from: getDefaultFrom(), to: getDefaultTo() })}
            className="mt-3 text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium"
          >
            Limpar filtros
          </button>
        )}
      </Card>

      {/* KPIs: sempre em destaque */}
      <KPICards data={summary} />

      {/* USER: priorizar "Seu desempenho" logo após KPIs */}
      {isUser && (
        <Card>
          <CardHeader
            title="Seu desempenho"
            subtitle="Resumo das suas tarefas no período selecionado"
          />
          <ResponsibleTable data={summary.byResponsavel} />
        </Card>
      )}

      {/* LEADER: priorizar "Sua área" antes dos gráficos */}
      {isLeader && summary.byArea && summary.byArea.length > 0 && (
        <Card>
          <CardHeader
            title="Sua área"
            subtitle="Visão consolidada para gestão e acompanhamento"
          />
          <AreaSummary data={summary.byArea} singleAreaForLeader />
        </Card>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Distribuição por status" subtitle="Proporção das tarefas no período" />
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-52 text-slate-500 dark:text-slate-400 text-sm">Sem dados no período</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={88}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map(entry => (
                    <Cell key={entry.name} fill={STATUS_CHART_COLORS[entry.name] || "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "#e2e8f0" }} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="Tarefas por responsável" subtitle="Top 8 por volume no período" />
          {barData.length === 0 ? (
            <div className="flex items-center justify-center h-52 text-slate-500 dark:text-slate-400 text-sm">Sem dados no período</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData} margin={{ top: 8, right: 8, left: -16, bottom: 4 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "#e2e8f0" }}
                  itemStyle={{ color: "#cbd5e1" }}
                  formatter={(value, name) => [value, name]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
                />
                <Bar dataKey="Concluído" stackId="a" fill="#34d399" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Em Andamento" stackId="a" fill="#60a5fa" />
                <Bar dataKey="Em Atraso" stackId="a" fill="#f87171" />
                <Bar dataKey="Concl. Atraso" stackId="a" fill="#fbbf24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Admin: visão por área */}
      {isAdmin && summary.byArea && summary.byArea.length > 0 && (
        <Card>
          <CardHeader
            title="Visão por área"
            subtitle={`${summary.byArea.length} área${summary.byArea.length !== 1 ? "s" : ""} para análise estratégica`}
          />
          <AreaSummary data={summary.byArea} singleAreaForLeader={false} />
        </Card>
      )}

      {/* Tabela por responsável: Leader e Admin (User já viu acima) */}
      {!isUser && (
        <Card>
          <CardHeader
            title={isLeader ? "Desempenho da equipe" : "Detalhamento por responsável"}
            subtitle={`${summary.byResponsavel.length} colaborador${summary.byResponsavel.length !== 1 ? "es" : ""}`}
          />
          <ResponsibleTable data={summary.byResponsavel} />
        </Card>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400 text-right pb-2">
        Atualizado em {new Date(summary.lastUpdated).toLocaleString("pt-BR")}
      </p>
    </div>
  );
}
