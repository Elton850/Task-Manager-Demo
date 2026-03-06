import React, { useState, useEffect, useCallback } from "react";
import { LayoutDashboard, Building2, Users, ListTodo, LogIn, RefreshCw, MessageSquare, CheckCheck, Inbox, Activity } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useToast } from "@/contexts/ToastContext";
import { systemApi } from "@/services/api";

const CHAT_METRICS_POLL_MS = 30_000;

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

type ChatMetrics = {
  status: "healthy" | "warning" | "critical";
  windowMinutes: number;
  messages: { sent: number; readEvents: number };
  threads: { total: number; direct: number; subtask: number };
  unread: { total: number };
  topTenants: { tenantSlug: string; messageCount: number }[];
  cachedAt: string;
};

const STATUS_STYLES: Record<ChatMetrics["status"], { label: string; cls: string }> = {
  healthy:  { label: "Saudável",  cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  warning:  { label: "Atenção",   cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  critical: { label: "Crítico",   cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

function ChatMetricsSection() {
  const [metrics, setMetrics] = useState<ChatMetrics | null>(null);
  const [error, setError] = useState(false);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await systemApi.chatMetrics(60);
      setMetrics(data);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const timer = setInterval(fetchMetrics, CHAT_METRICS_POLL_MS);
    return () => clearInterval(timer);
  }, [fetchMetrics]);

  if (error && !metrics) {
    return (
      <Card>
        <p className="text-sm text-slate-500 dark:text-slate-400 py-2">
          Métricas de chat indisponíveis no momento.
        </p>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
          <Activity size={16} className="animate-pulse" />
          Carregando métricas de chat...
        </div>
      </Card>
    );
  }

  const statusStyle = STATUS_STYLES[metrics.status];

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare size={20} className="text-slate-600 dark:text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Performance do Chat
          </h2>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyle.cls}`}>
            {statusStyle.label}
          </span>
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          Última {metrics.windowMinutes}min · cache 30s
        </span>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.messages.sent}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Msgs enviadas</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
          <div className="flex items-center gap-1">
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.messages.readEvents}</p>
            <CheckCheck size={16} className="text-slate-400 mt-1" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Leituras</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.unread.total}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Não lidas (total)</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.threads.total}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Threads ({metrics.threads.direct}d / {metrics.threads.subtask}s)
          </p>
        </div>
      </div>

      {/* Top tenants */}
      {metrics.topTenants.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Top empresas por mensagens (últimos {metrics.windowMinutes}min)
          </p>
          <div className="space-y-1.5">
            {metrics.topTenants.map((t, i) => {
              const maxCount = metrics.topTenants[0]?.messageCount || 1;
              const pct = Math.round((t.messageCount / maxCount) * 100);
              return (
                <div key={t.tenantSlug} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-4 text-right">{i + 1}</span>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-28 truncate">{t.tenantSlug}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-brand-500 dark:bg-brand-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 w-8 text-right">{t.messageCount}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {metrics.topTenants.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-1">
          <Inbox size={16} />
          Nenhuma mensagem enviada na última hora.
        </div>
      )}
    </Card>
  );
}

export default function SystemDashboardPage() {
  const { toast } = useToast();
  const [stats, setStats] = useState<{
    tenantsCount: number;
    usersCount: number;
    tasksCount: number;
    recentLogins: { loggedAt: string; tenantSlug: string; tenantName: string; userEmail: string; userName: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await systemApi.stats();
      setStats(data);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao carregar visão geral", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner text="Carregando visão geral..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Visão geral do sistema</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Resumo de uso e últimos acessos ao sistema.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={load}>
          <RefreshCw size={16} />
          Atualizar
        </Button>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-brand-100 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-500/40">
                <Building2 size={28} className="text-brand-700 dark:text-brand-300" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.tenantsCount}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Empresas ativas</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-500/40">
                <Users size={28} className="text-emerald-700 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.usersCount}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Usuários</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-500/40">
                <ListTodo size={28} className="text-amber-700 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.tasksCount}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Tarefas (total)</p>
              </div>
            </Card>
          </div>

          {/* Chat metrics — auto-atualiza a cada 30s */}
          <ChatMetricsSection />

          <Card>
            <div className="flex items-center gap-2 mb-4">
              <LogIn size={20} className="text-slate-600 dark:text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Últimos acessos</h2>
            </div>
            {stats.recentLogins.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4">Nenhum registro de acesso no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-600/80 bg-slate-50/90 dark:bg-slate-700/80">
                      <th className="pl-5 pr-4 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap">Data e hora</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Empresa</th>
                      <th className="px-4 py-3.5 pr-5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Usuário</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-600/60">
                    {stats.recentLogins.map((log, i) => (
                      <tr key={`${log.loggedAt}-${log.userEmail}-${i}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/60 transition-colors">
                        <td className="pl-5 pr-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatDateTime(log.loggedAt)}</td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-800 dark:text-slate-100">{log.tenantName}</span>
                          <span className="text-slate-500 dark:text-slate-400 text-xs ml-1">({log.tenantSlug})</span>
                        </td>
                        <td className="px-4 pr-5 py-3 text-slate-700 dark:text-slate-300">{log.userName} ({log.userEmail})</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
