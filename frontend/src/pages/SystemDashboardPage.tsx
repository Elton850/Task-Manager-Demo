import React, { useState, useEffect, useCallback } from "react";
import { LayoutDashboard, Building2, Users, ListTodo, LogIn, RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useToast } from "@/contexts/ToastContext";
import { systemApi } from "@/services/api";

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
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
                    <tr className="border-b border-slate-200 dark:border-slate-600/80 bg-slate-50/90 dark:bg-slate-700/80 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      <th className="pb-3 pr-4">Data e hora</th>
                      <th className="pb-3 pr-4">Empresa</th>
                      <th className="pb-3 pr-4">Usuário</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-600/60">
                    {stats.recentLogins.map((log, i) => (
                      <tr key={`${log.loggedAt}-${log.userEmail}-${i}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/60 transition-colors">
                        <td className="py-3 pr-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatDateTime(log.loggedAt)}</td>
                        <td className="py-3 pr-4">
                          <span className="font-medium text-slate-800 dark:text-slate-100">{log.tenantName}</span>
                          <span className="text-slate-500 dark:text-slate-400 text-xs ml-1">({log.tenantSlug})</span>
                        </td>
                        <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">{log.userName} ({log.userEmail})</td>
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
