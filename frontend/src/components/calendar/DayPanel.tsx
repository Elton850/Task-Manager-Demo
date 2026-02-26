import React, { useState } from "react";
import { X, Clock, CheckCircle, AlertCircle, AlertTriangle, Plus, Lock, CalendarDays, Pencil, Trash2 } from "lucide-react";
import Badge, { getStatusVariant } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { Task, Holiday } from "@/types";

interface DayPanelProps {
  day: number;
  month: number;
  year: number;
  tasks: Task[];
  holidays?: Holiday[];
  isAdmin?: boolean;
  canCreateTask: boolean;
  createBlockedReason?: string;
  onClose: () => void;
  onCreateTask: () => void;
  onEditTask: (task: Task) => void;
  onMarkComplete?: (task: Task) => void;
  canMarkComplete?: (task: Task) => boolean;
  onAddHoliday?: () => void;
  onEditHoliday?: (holiday: Holiday) => void;
  onDeleteHoliday?: (id: string) => void;
}

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function DayPanel({
  day,
  month,
  year,
  tasks,
  holidays = [],
  isAdmin = false,
  canCreateTask,
  createBlockedReason,
  onClose,
  onCreateTask,
  onEditTask,
  onMarkComplete,
  canMarkComplete,
  onAddHoliday,
  onEditHoliday,
  onDeleteHoliday,
}: DayPanelProps) {
  const [holidayToDelete, setHolidayToDelete] = useState<Holiday | null>(null);
  const dateStr = `${String(day).padStart(2, "0")} de ${MONTHS_PT[month]} de ${year}`;

  const grouped = tasks.reduce<Record<string, Task[]>>((acc, t) => {
    if (!acc[t.status]) acc[t.status] = [];
    acc[t.status].push(t);
    return acc;
  }, {});

  const statusOrder = ["Em Atraso", "Em Andamento", "Concluído em Atraso", "Concluído"];

  return (
    <div className="bg-white dark:bg-slate-800/95 border border-slate-200 dark:border-slate-600/80 rounded-xl overflow-hidden flex flex-col h-full min-h-[420px]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-600/80">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{dateStr}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {tasks.length} tarefa{tasks.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCreateTask}
            disabled={!canCreateTask}
            title={!canCreateTask ? createBlockedReason : "Nova atividade neste dia"}
          >
            {canCreateTask ? <Plus size={16} /> : <Lock size={16} />}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>
      </div>

      {!canCreateTask && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/25 border-b border-amber-200 dark:border-amber-700/50 text-xs text-amber-800 dark:text-amber-200">
          {createBlockedReason || "Criação de tarefas desabilitada para sua área."}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {holidays.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarDays size={12} className="text-amber-600 dark:text-amber-400" />
                Feriados ({holidays.length})
              </span>
              {isAdmin && onAddHoliday && (
                <Button variant="ghost" size="sm" onClick={onAddHoliday} title="Adicionar feriado">
                  <Plus size={14} />
                </Button>
              )}
            </div>
            <ul className="space-y-1.5">
              {holidays.map(h => (
                <li
                  key={h.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50"
                >
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{h.name}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isAdmin && h.source === "manual" && onEditHoliday && (
                      <Button variant="ghost" size="sm" onClick={() => onEditHoliday(h)} title="Editar feriado">
                        <Pencil size={12} />
                      </Button>
                    )}
                    {isAdmin && onDeleteHoliday && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setHolidayToDelete(h)}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                        title="Excluir feriado"
                      >
                        <Trash2 size={12} />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isAdmin && onAddHoliday && holidays.length === 0 && (
          <div className="mb-4">
            <Button variant="outline" size="sm" onClick={onAddHoliday} icon={<Plus size={14} />}>
              Adicionar feriado neste dia
            </Button>
          </div>
        )}

        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
            <CheckCircle size={32} className="mb-3 opacity-30 dark:opacity-50" />
            <p className="text-sm">Nenhuma tarefa com prazo neste dia</p>
            <Button className="mt-4" size="sm" onClick={onCreateTask} icon={<Plus size={14} />} disabled={!canCreateTask}>
              Criar atividade
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {statusOrder.map(status => {
              const items = grouped[status];
              if (!items?.length) return null;

              const icons: Record<string, React.ReactNode> = {
                "Em Atraso": <AlertCircle size={14} className="text-rose-600 dark:text-rose-400" />,
                "Em Andamento": <Clock size={14} className="text-blue-600 dark:text-blue-400" />,
                "Concluído em Atraso": <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400" />,
                "Concluído": <CheckCircle size={14} className="text-emerald-600 dark:text-emerald-400" />,
              };

              return (
                <div key={status}>
                  <div className="flex items-center gap-2 mb-2">
                    {icons[status]}
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      {status} ({items.length})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {items.map(task => (
                      <div
                        key={task.id}
                        className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600/80 hover:border-slate-300 dark:hover:border-slate-500/60 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => onEditTask(task)}
                          className="flex-1 text-left min-w-0"
                        >
                          <p className="text-sm text-slate-800 dark:text-slate-100">{task.atividade}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <span>{task.responsavelNome}</span>
                            <span>·</span>
                            <span>{task.area}</span>
                            {task.realizado && (
                              <>
                                <span>·</span>
                                <span className="text-emerald-700 dark:text-emerald-400">
                                  Realizado: {new Date(task.realizado + "T00:00:00").toLocaleDateString("pt-BR")}
                                </span>
                              </>
                            )}
                          </div>
                        </button>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Badge variant={getStatusVariant(task.status)} size="sm">
                            {task.tipo}
                          </Badge>
                          {onMarkComplete && canMarkComplete?.(task) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onMarkComplete(task)}
                              className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                              title="Marcar como concluída"
                            >
                              <CheckCircle size={14} />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!holidayToDelete}
        title="Excluir feriado"
        message={holidayToDelete ? `Excluir o feriado "${holidayToDelete.name}"?` : ""}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={() => {
          if (holidayToDelete) {
            onDeleteHoliday?.(holidayToDelete.id);
            setHolidayToDelete(null);
          }
        }}
        onCancel={() => setHolidayToDelete(null)}
      />
    </div>
  );
}