import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { justificationsApi, tasksApi } from "@/services/api";

export type NotificationVariant = "danger" | "warning" | "info" | "accent";

export interface NotificationItem {
  id: string;
  variant: NotificationVariant;
  title: string;
  summary: string;
  link: string;
}


/**
 * Notificações exibidas:
 * - Atividade(s) em atraso
 * - Atividades a vencer hoje
 * - Atividades a vencer amanhã
 * - Justificativas pendentes (somente Leader/Admin)
 * Não busca para tenant "system" (admin do sistema).
 */
export function useNotificationData(basePath: string): { items: NotificationItem[]; loading: boolean } {
  const { user, tenant } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user || !tenant) {
      setItems([]);
      setLoading(false);
      return;
    }
    const isSystem = tenant.slug === "system";
    if (isSystem && user.role === "ADMIN") {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const list: NotificationItem[] = [];
    const tasksPath = basePath ? `${basePath}/tasks` : "/tasks";
    const justPath = basePath ? `${basePath}/justificativas` : "/justificativas";
    try {
      if (user.role === "USER") {
        const countsRes = await tasksApi.notificationCounts();
        const { overdue, dueToday, dueTomorrow } = countsRes;

        if (overdue > 0) {
          list.push({
            id: "tasks-overdue",
            variant: "danger",
            title: "Atividade em atraso",
            summary: overdue === 1 ? "1 atividade em atraso" : `${overdue} atividades em atraso`,
            link: tasksPath,
          });
        }
        if (dueToday > 0) {
          list.push({
            id: "tasks-due-today",
            variant: "warning",
            title: "Atividades a vencer hoje",
            summary: dueToday === 1 ? "1 atividade vence hoje" : `${dueToday} atividades vencem hoje`,
            link: tasksPath,
          });
        }
        if (dueTomorrow > 0) {
          list.push({
            id: "tasks-due-tomorrow",
            variant: "info",
            title: "Atividades a vencer amanhã",
            summary:
              dueTomorrow === 1 ? "1 atividade vence amanhã" : `${dueTomorrow} atividades vencem amanhã`,
            link: tasksPath,
          });
        }
      } else if (user.role === "LEADER" || user.role === "ADMIN") {
        const [pendingRes, countsRes] = await Promise.all([
          justificationsApi.pending(),
          tasksApi.notificationCounts(),
        ]);
        const { overdue, dueToday, dueTomorrow } = countsRes;

        if (overdue > 0) {
          list.push({
            id: "tasks-overdue-leader",
            variant: "danger",
            title: "Atividade em atraso",
            summary: overdue === 1 ? "1 atividade em atraso" : `${overdue} atividades em atraso`,
            link: tasksPath,
          });
        }
        if (dueToday > 0) {
          list.push({
            id: "tasks-due-today-leader",
            variant: "warning",
            title: "Atividades a vencer hoje",
            summary: dueToday === 1 ? "1 atividade vence hoje" : `${dueToday} atividades vencem hoje`,
            link: tasksPath,
          });
        }
        if (dueTomorrow > 0) {
          list.push({
            id: "tasks-due-tomorrow-leader",
            variant: "info",
            title: "Atividades a vencer amanhã",
            summary:
              dueTomorrow === 1
                ? "1 atividade vence amanhã"
                : `${dueTomorrow} atividades vencem amanhã`,
            link: tasksPath,
          });
        }
        const pendingCount = pendingRes.items.length;
        if (pendingCount > 0) {
          list.push({
            id: "justifications-pending",
            variant: "accent",
            title: "Justificativas pendentes",
            summary:
              pendingCount === 1
                ? "1 justificativa aguardando análise"
                : `${pendingCount} justificativas aguardando análise`,
            link: justPath,
          });
        }
      }
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user, tenant, basePath]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { items, loading };
}
