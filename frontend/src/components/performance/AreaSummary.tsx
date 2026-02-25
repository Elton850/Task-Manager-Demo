import React from "react";
import type { AreaStats } from "@/types";

interface AreaSummaryProps {
  /** Uma área = Leader (card único "Sua área"); várias = Admin (grid de cards). */
  data: AreaStats[];
  /** Se true, título do card único será "Sua área" em vez do nome da área. */
  singleAreaForLeader?: boolean;
}

function AreaCard({ row, title, highlight }: { row: AreaStats; title: string; highlight?: boolean }) {
  const totalFinished = row.concluido + row.concluidoEmAtraso;
  const rate = row.total > 0 ? Math.round((totalFinished / row.total) * 100) : 0;
  const hasLate = row.concluidoEmAtraso > 0;

  return (
    <div
      className={`rounded-xl border p-4 transition-shadow hover:shadow-md ${
        highlight
          ? "border-brand-300 dark:border-brand-500/50 bg-brand-50/50 dark:bg-brand-900/20 shadow-sm"
          : "border-slate-200 dark:border-slate-600/80 bg-slate-50/50 dark:bg-slate-800/50"
      }`}
    >
      <h3 className={`font-semibold mb-3 ${highlight ? "text-base text-slate-900 dark:text-slate-100" : "text-sm text-slate-800 dark:text-slate-100"}`}>
        {title}
      </h3>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 mb-4">
        <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{row.total}</span>
        <span className="text-sm text-slate-500 dark:text-slate-400">tarefas</span>
        <div className="flex-1 min-w-[100px] max-w-[140px] ml-auto">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${rate >= 80 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                style={{ width: `${rate}%` }}
              />
            </div>
            <span className={`text-sm font-bold tabular-nums shrink-0 ${rate >= 80 ? "text-emerald-700 dark:text-emerald-400" : rate >= 50 ? "text-amber-700 dark:text-amber-400" : "text-rose-700 dark:text-rose-400"}`}>
              {rate}%
            </span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">taxa de conclusão</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {row.emAndamento > 0 && (
          <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-200 px-2.5 py-1 text-xs font-medium">
            Em andamento: {row.emAndamento}
          </span>
        )}
        {row.concluido > 0 && (
          <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 px-2.5 py-1 text-xs font-medium">
            Concluído: {row.concluido}
          </span>
        )}
        {row.emAtraso > 0 && (
          <span className="inline-flex items-center rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-200 px-2.5 py-1 text-xs font-medium">
            Em atraso: {row.emAtraso}
          </span>
        )}
        {row.concluidoEmAtraso > 0 && (
          <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200 px-2.5 py-1 text-xs font-medium">
            Concl. atraso: {row.concluidoEmAtraso}
          </span>
        )}
      </div>

      {hasLate && (row.concluidoEmAtrasoJustificado > 0 || row.concluidoEmAtrasoPendente > 0 || row.concluidoEmAtrasoSemJustificativa > 0) && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600/60">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Justificativas (concl. atraso)</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
            {row.concluidoEmAtrasoJustificado > 0 && (
              <span><strong className="text-emerald-700 dark:text-emerald-400">{row.concluidoEmAtrasoJustificado}</strong> aprovadas</span>
            )}
            {row.concluidoEmAtrasoPendente > 0 && (
              <span><strong className="text-slate-700 dark:text-slate-200">{row.concluidoEmAtrasoPendente}</strong> pendentes</span>
            )}
            {row.concluidoEmAtrasoSemJustificativa > 0 && (
              <span><strong className="text-rose-700 dark:text-rose-400">{row.concluidoEmAtrasoSemJustificativa}</strong> sem justificativa</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AreaSummary({ data, singleAreaForLeader = false }: AreaSummaryProps) {
  const sorted = [...data].sort((a, b) => b.total - a.total);

  if (!sorted.length) {
    return (
      <div className="text-center py-6 text-slate-600 dark:text-slate-400 text-sm">
        Nenhum dado disponível por área
      </div>
    );
  }

  // Leader: uma área → um único card em destaque
  if (sorted.length === 1) {
    return (
      <AreaCard
        row={sorted[0]}
        title={singleAreaForLeader ? "Sua área" : sorted[0].area}
        highlight={singleAreaForLeader}
      />
    );
  }

  // Admin: várias áreas → grid de cards
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {sorted.map(row => (
        <AreaCard key={row.area} row={row} title={row.area} />
      ))}
    </div>
  );
}
