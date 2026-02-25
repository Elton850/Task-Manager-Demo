import React from "react";
import Badge from "@/components/ui/Badge";
import type { ResponsavelStats } from "@/types";

interface ResponsibleTableProps {
  data: ResponsavelStats[];
}

export default function ResponsibleTable({ data }: ResponsibleTableProps) {
  const sorted = [...data].sort((a, b) => b.total - a.total);

  if (!sorted.length) {
    return (
      <div className="text-center py-8 text-slate-600 dark:text-slate-400 text-sm">
        Nenhum dado disponível
      </div>
    );
  }

  const headers = [
    { key: "responsavel", label: "Responsável", className: "pl-5 pr-4" },
    { key: "total", label: "Total", className: "px-4" },
    { key: "emAndamento", label: "Em andamento", className: "px-4" },
    { key: "concluido", label: "Concluído", className: "px-4" },
    { key: "emAtraso", label: "Em atraso", className: "px-4" },
    { key: "conclAtraso", label: "Concl. atraso", className: "px-4" },
    { key: "justif", label: "Justificativas", className: "px-4 hidden lg:table-cell" },
    { key: "taxa", label: "Taxa conclusão", className: "px-4 pr-5" },
  ];

  return (
    <div className="overflow-x-auto overflow-y-visible">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-600/80">
        <thead>
          <tr className="sticky top-0 z-10 border-b border-slate-200 dark:border-slate-600/80 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">
            {headers.map(({ key, label, className }) => (
              <th
                key={key}
                className={`py-3.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider whitespace-nowrap ${className}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-600/60 bg-white dark:bg-slate-800/30">
          {sorted.map(row => {
            const totalFinished = row.concluido + row.concluidoEmAtraso;
            const rate = row.total > 0 ? Math.round((totalFinished / row.total) * 100) : 0;
            const justificado = row.concluidoEmAtrasoJustificado ?? 0;
            const pendente = row.concluidoEmAtrasoPendente ?? 0;
            const sem = row.concluidoEmAtrasoSemJustificativa ?? 0;

            return (
              <tr key={row.email} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                <td className="pl-5 pr-4 py-3.5">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{row.nome}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[180px]">{row.email}</div>
                </td>
                <td className="px-4 py-3.5 text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">{row.total}</td>
                <td className="px-4 py-3.5">
                  <Badge variant="blue" size="sm">{row.emAndamento}</Badge>
                </td>
                <td className="px-4 py-3.5">
                  <Badge variant="green" size="sm">{row.concluido}</Badge>
                </td>
                <td className="px-4 py-3.5">
                  {row.emAtraso > 0 ? <Badge variant="red" size="sm">{row.emAtraso}</Badge> : <span className="text-slate-400 dark:text-slate-500 text-sm">—</span>}
                </td>
                <td className="px-4 py-3.5">
                  {row.concluidoEmAtraso > 0 ? <Badge variant="amber" size="sm">{row.concluidoEmAtraso}</Badge> : <span className="text-slate-400 dark:text-slate-500 text-sm">—</span>}
                </td>
                <td className="hidden lg:table-cell px-4 py-3.5">
                  <div className="flex flex-wrap gap-1 text-xs">
                    {justificado > 0 && <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 font-medium">✓ {justificado}</span>}
                    {pendente > 0 && <span className="inline-flex items-center rounded bg-slate-100 dark:bg-slate-600/80 text-slate-700 dark:text-slate-200 px-1.5 py-0.5 font-medium">⏳ {pendente}</span>}
                    {sem > 0 && <span className="inline-flex items-center rounded bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 font-medium">! {sem}</span>}
                    {justificado === 0 && pendente === 0 && sem === 0 && <span className="text-slate-400 dark:text-slate-500">—</span>}
                  </div>
                </td>
                <td className="px-4 pr-5 py-3.5">
                  <div className="flex items-center gap-2 min-w-[100px]">
                    <div className="flex-1 h-2.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden min-w-[52px]">
                      <div
                        className={`h-full rounded-full transition-all ${rate >= 80 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold tabular-nums shrink-0 ${rate >= 80 ? "text-emerald-700 dark:text-emerald-400" : rate >= 50 ? "text-amber-700 dark:text-amber-400" : "text-rose-700 dark:text-rose-400"}`}>
                      {rate}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
