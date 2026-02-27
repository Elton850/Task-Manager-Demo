/**
 * Ilustração lateral para a tela de login — formas abstratas (tarefas/entregas).
 * Apenas SVG/CSS, sem assets externos. Suporta tema claro/escuro.
 * Container alinhado ao painel (rounded-2xl, borda suave).
 */
import React from "react";

export default function LoginIllustration() {
  return (
    <div className="relative w-full min-h-[280px] flex items-center justify-center p-6 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-600/60 bg-white/40 dark:bg-slate-800/30">
      {/* Fundo suave */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 via-brand-400/5 to-transparent dark:from-brand-500/20 dark:via-brand-600/10 dark:to-transparent rounded-2xl" />
      {/* Círculos decorativos */}
      <div className="absolute top-1/4 left-1/4 w-48 h-48 rounded-full bg-brand-400/20 dark:bg-brand-500/25 blur-2xl" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-brand-300/15 dark:bg-brand-600/20 blur-3xl" />
      {/* SVG: elementos de "tarefas" — calendário + check */}
      <svg
        className="relative w-full max-w-sm h-auto text-brand-500/90 dark:text-brand-400/90"
        viewBox="0 0 280 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        {/* Grid de "dias" (calendário abstrato) */}
        <g stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4">
          {[0, 1, 2, 3, 4].map(row =>
            [0, 1, 2, 3, 4, 6].map(col => (
              <rect
                key={`${row}-${col}`}
                x={24 + col * 36}
                y={20 + row * 28}
                width={28}
                height={22}
                rx={6}
                fill="currentColor"
                fillOpacity="0.08"
              />
            ))
          )}
        </g>
        {/* Checkmarks — conclusão de tarefas */}
        <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.7">
          <path d="M58 52l6 6 12-14" />
          <path d="M130 108l6 6 12-14" />
          <path d="M202 80l5 5 10-12" />
        </g>
        {/* Círculo central destacado */}
        <circle cx="140" cy="100" r="32" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" />
        <path d="M132 100l6 6 12-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      </svg>
    </div>
  );
}
