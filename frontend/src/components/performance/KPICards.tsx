import React from "react";
import { CheckCircle, Clock, AlertCircle, AlertTriangle, BarChart2 } from "lucide-react";
import type { PerformanceSummary } from "@/types";

interface KPICardsProps {
  data: PerformanceSummary;
}

interface KPICard {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
  pct?: number;
  /** Quando preenchido, exibe breakdown de justificativas (aprovada / pendente / sem) */
  breakdown?: { justificado: number; pendente: number; semJustificativa: number };
}

export default function KPICards({ data }: KPICardsProps) {
  const pct = (n: number) => data.total > 0 ? Math.round((n / data.total) * 100) : 0;

  const concluidoEmAtrasoBreakdown =
    (data.concluidoEmAtrasoJustificado ?? 0) + (data.concluidoEmAtrasoPendente ?? 0) + (data.concluidoEmAtrasoSemJustificativa ?? 0) > 0
      ? {
          justificado: data.concluidoEmAtrasoJustificado ?? 0,
          pendente: data.concluidoEmAtrasoPendente ?? 0,
          semJustificativa: data.concluidoEmAtrasoSemJustificativa ?? 0,
        }
      : undefined;

  const cards: KPICard[] = [
    {
      label: "Total",
      value: data.total,
      icon: <BarChart2 size={18} />,
      color: "text-slate-700",
      bg: "bg-slate-100",
      border: "border-slate-300",
    },
    {
      label: "Em Andamento",
      value: data.emAndamento,
      pct: pct(data.emAndamento),
      icon: <Clock size={18} />,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    {
      label: "Concluído",
      value: data.concluido,
      pct: pct(data.concluido),
      icon: <CheckCircle size={18} />,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      label: "Em Atraso",
      value: data.emAtraso,
      pct: pct(data.emAtraso),
      icon: <AlertCircle size={18} />,
      color: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
    },
    {
      label: "Concluído em Atraso",
      value: data.concluidoEmAtraso,
      pct: pct(data.concluidoEmAtraso),
      icon: <AlertTriangle size={18} />,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      breakdown: concluidoEmAtrasoBreakdown,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map(card => (
        <div
          key={card.label}
          className={`rounded-xl border p-4 transition-shadow hover:shadow-md ${card.bg} ${card.border} dark:bg-slate-800/80 dark:border-slate-600/80`}
        >
          <div className={`mb-2 ${card.color} dark:opacity-95`}>{card.icon}</div>
          <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{card.value}</div>
          <div className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-0.5">{card.label}</div>
          {card.breakdown && (
            <div className="mt-3 space-y-1.5 text-xs">
              {card.breakdown.justificado > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-300">Justificadas: <strong className="text-slate-800 dark:text-slate-100">{card.breakdown.justificado}</strong></span>
                </div>
              )}
              {card.breakdown.pendente > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-300">Pendentes: <strong className="text-slate-800 dark:text-slate-100">{card.breakdown.pendente}</strong></span>
                </div>
              )}
              {card.breakdown.semJustificativa > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-300">Sem justificativa: <strong className="text-slate-800 dark:text-slate-100">{card.breakdown.semJustificativa}</strong></span>
                </div>
              )}
            </div>
          )}
          {!card.breakdown && card.pct !== undefined && (
            <div className="mt-3">
              <div className="h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    card.label === "Concluído" ? "bg-emerald-500" :
                    card.label === "Em Atraso" ? "bg-rose-500" :
                    card.label === "Em Andamento" ? "bg-blue-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${card.pct}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 mt-1 block tabular-nums">{card.pct}%</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
