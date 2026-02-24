import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Button from "@/components/ui/Button";
import type { Task } from "@/types";

interface CalendarGridProps {
  year: number;
  month: number;
  tasks: Task[];
  selectedDay: number | null;
  canCreateTask: boolean;
  createBlockedReason?: string;
  onDayClick: (day: number) => void;
  onCreateInDay: (day: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function getStatusCount(tasks: Task[]) {
  return {
    andamento: tasks.filter(t => t.status === "Em Andamento").length,
    atraso: tasks.filter(t => t.status === "Em Atraso").length,
    concluido: tasks.filter(t => t.status === "Concluído" || t.status === "Concluido").length,
  };
}

export default function CalendarGrid({
  year,
  month,
  tasks,
  selectedDay,
  canCreateTask,
  createBlockedReason,
  onDayClick,
  onCreateInDay,
  onPrev,
  onNext,
  onToday,
}: CalendarGridProps) {
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const { tasksByDay, statusByDay } = useMemo(() => {
    const tasksByDay = new Map<number, Task[]>();
    const statusByDay = new Map<number, { andamento: number; atraso: number; concluido: number }>();
    const ymStr = `${year}-${String(month + 1).padStart(2, "0")}`;

    for (const task of tasks) {
      if (task.competenciaYm === ymStr && task.prazo) {
        const prazoDate = new Date(task.prazo + "T00:00:00");
        if (prazoDate.getFullYear() === year && prazoDate.getMonth() === month) {
          const d = prazoDate.getDate();
          if (!tasksByDay.has(d)) tasksByDay.set(d, []);
          tasksByDay.get(d)!.push(task);
        }
      }
    }
    tasksByDay.forEach((dayTasks, day) => {
      statusByDay.set(day, getStatusCount(dayTasks));
    });
    return { tasksByDay, statusByDay };
  }, [tasks, year, month]);

  const cells: Array<number | null> = useMemo(() => {
    const c: Array<number | null> = [
      ...Array(firstDayOfMonth).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (c.length % 7 !== 0) c.push(null);
    return c;
  }, [firstDayOfMonth, daysInMonth]);

  return (
    <div className="bg-gradient-to-b from-slate-50 to-white dark:from-slate-800/95 dark:to-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-600">
        <div>
          <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
            {MONTHS_PT[month]} {year}
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
            Visão de calendário das tarefas por prazo
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {!isCurrentMonth && (
            <Button variant="outline" size="sm" onClick={onToday}>
              Hoje
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onPrev} icon={<ChevronLeft size={16} />} />
          <Button variant="ghost" size="sm" onClick={onNext} icon={<ChevronRight size={16} />} />
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50">
        {WEEK_DAYS.map(d => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 bg-white dark:bg-slate-800/80">
        {cells.map((day, idx) => {
          if (!day) {
            return (
              <div
                key={`empty-${idx}`}
                className="h-20 sm:h-24 md:h-28 border-b border-r border-slate-100 dark:border-slate-600/80 bg-slate-50/40 dark:bg-slate-800/50"
              />
            );
          }

          const dayTasks = tasksByDay.get(day) || [];
          const isToday = isCurrentMonth && today.getDate() === day;
          const isSelected = selectedDay === day;
          const hasOverdue = dayTasks.some(t => t.status === "Em Atraso");
          const count = dayTasks.length;
          const stats = statusByDay.get(day) ?? { andamento: 0, atraso: 0, concluido: 0 };

          return (
            <div
              key={day}
              className={`
                group relative h-20 sm:h-24 md:h-28 p-1.5 border-b border-r border-slate-100 dark:border-slate-600/80
                hover:bg-brand-50/60 dark:hover:bg-slate-700/70 transition-colors
                ${isSelected ? "bg-brand-50 dark:bg-brand-500/20 border-brand-200 dark:border-brand-500/40 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.35)] dark:shadow-[inset_0_0_0_1px_rgba(96,165,250,0.4)]" : ""}
                ${isToday && !isSelected ? "bg-blue-50/40 dark:bg-blue-500/10" : ""}
              `}
            >
              <button onClick={() => onDayClick(day)} className="w-full h-full text-left flex flex-col">
                <div className="flex items-center justify-between">
                  <span
                    className={`
                      text-[11px] font-semibold inline-flex items-center justify-center w-7 h-7 rounded-full
                      ${isToday ? "bg-brand-600 text-white shadow-sm" : isSelected ? "bg-brand-100 dark:bg-brand-500/30 text-brand-800 dark:text-brand-200" : hasOverdue ? "text-rose-700 dark:text-rose-400" : "text-slate-700 dark:text-slate-200"}
                    `}
                  >
                    {day}
                  </span>
                  {count > 0 && <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{count}</span>}
                </div>

                <div className="mt-auto space-y-1.5">
                  {count > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {stats.andamento > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-500/40 px-1.5 py-0.5 text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          {stats.andamento}
                        </span>
                      )}
                      {stats.atraso > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-500/40 px-1.5 py-0.5 text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          {stats.atraso}
                        </span>
                      )}
                      {stats.concluido > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-500/40 px-1.5 py-0.5 text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {stats.concluido}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </button>

              {canCreateTask && (
                <button
                  onClick={() => onCreateInDay(day)}
                  className="absolute bottom-1 right-1 p-1 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:text-brand-700 dark:hover:text-brand-300 hover:border-brand-300 dark:hover:border-brand-500/60 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Criar atividade neste dia"
                >
                  <Plus size={11} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 px-4 py-2.5 border-t border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-xs text-slate-600 dark:text-slate-300">Andamento</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span className="text-xs text-slate-600 dark:text-slate-300">Atraso</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-slate-600 dark:text-slate-300">Concluído</span>
        </div>
        {!canCreateTask && (
          <span className="text-xs text-amber-700 dark:text-amber-400" title={createBlockedReason}>
            Criacao desabilitada pelas regras da area
          </span>
        )}
      </div>
    </div>
  );
}