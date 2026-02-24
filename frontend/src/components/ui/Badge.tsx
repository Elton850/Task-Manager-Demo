import React from "react";

type BadgeVariant = "blue" | "green" | "red" | "amber" | "slate" | "indigo" | "purple";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  blue: "bg-blue-50 dark:bg-blue-900/50 text-blue-800 dark:text-blue-100 border border-blue-200 dark:border-blue-600/80",
  green: "bg-emerald-50 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-100 border border-emerald-200 dark:border-emerald-600/80",
  red: "bg-rose-50 dark:bg-rose-900/50 text-rose-800 dark:text-rose-100 border border-rose-200 dark:border-rose-600/80",
  amber: "bg-amber-50 dark:bg-amber-900/50 text-amber-800 dark:text-amber-100 border border-amber-200 dark:border-amber-600/80",
  slate: "bg-slate-100 dark:bg-slate-700/90 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600/80",
  indigo: "bg-brand-50 dark:bg-brand-900/50 text-brand-800 dark:text-brand-100 border border-brand-200 dark:border-brand-600/80",
  purple: "bg-brand-50 dark:bg-brand-900/50 text-brand-800 dark:text-brand-100 border border-brand-200 dark:border-brand-600/80",
};

export function getStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "Em Andamento":
      return "blue";
    case "Concluído":
      return "green";
    case "Em Atraso":
      return "red";
    case "Concluído em Atraso":
      return "amber";
    case "Aguardando subtarefas":
      return "slate";
    default:
      return "slate";
  }
}

export function getRoleVariant(role: string): BadgeVariant {
  switch (role) {
    case "ADMIN":
      return "indigo";
    case "LEADER":
      return "indigo";
    default:
      return "slate";
  }
}

export default function Badge({ children, variant = "slate", size = "sm", className = "" }: BadgeProps) {
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";

  return <span className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${variants[variant]} ${className}`}>{children}</span>;
}
