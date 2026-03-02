/**
 * Ilustração lateral da tela de login (desktop).
 * Formas abstratas de tarefas/entregas; apenas SVG/CSS. Suporta tema claro/escuro.
 */
import React from "react";

export default function LoginIllustration() {
  return (
    <div className="login-illustration">
      <div className="login-illustration-bg" aria-hidden />
      <div className="login-illustration-blur login-illustration-blur--1" aria-hidden />
      <div className="login-illustration-blur login-illustration-blur--2" aria-hidden />
      <svg
        className="login-illustration-svg"
        viewBox="0 0 280 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <g stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4">
          {[0, 1, 2, 3, 4].map((row) =>
            [0, 1, 2, 3, 4, 6].map((col) => (
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
        <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.7">
          <path d="M58 52l6 6 12-14" />
          <path d="M130 108l6 6 12-14" />
          <path d="M202 80l5 5 10-12" />
        </g>
        <circle cx="140" cy="100" r="32" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" />
        <path d="M132 100l6 6 12-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      </svg>
    </div>
  );
}
