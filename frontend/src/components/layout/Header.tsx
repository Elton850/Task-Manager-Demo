import React from "react";
import { useLocation, NavLink } from "react-router-dom";
import { Menu, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBasePath } from "@/contexts/BasePathContext";
import TenantLogo from "@/components/ui/TenantLogo";
import ThemeSwitch from "@/components/ui/ThemeSwitch";
import { useChatUnread } from "@/hooks/useChatUnread";

interface HeaderProps {
  onMenuToggle: () => void;
}

const PAGE_TITLES: Record<string, string> = {
  "/tasks": "Tarefas",
  "/justificativas": "Justificativas",
  "/calendar": "Calendário",
  "/performance": "Performance",
  "/users": "Usuários",
  "/admin": "Configurações",
  "/sistema": "Visão geral",
  "/logs-acesso": "Logs de acesso",
  "/empresas": "Cadastro de empresas",
  "/empresa": "Empresa",
  "/chat": "Mensagens",
};

export default function Header({ onMenuToggle }: HeaderProps) {
  const location = useLocation();
  const { user, tenant } = useAuth();
  const basePath = useBasePath();
  const { unread } = useChatUnread();
  const isMasterAdmin = tenant?.slug === "system" && user?.role === "ADMIN";
  const lastSegment = location.pathname.split("/").filter(Boolean).pop() || "";
  const title = PAGE_TITLES["/" + lastSegment] || "Task Manager";

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between px-4 lg:px-6 py-3 bg-white/95 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-700/80">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuToggle}
          className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </button>
        {!isMasterAdmin && (
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            <TenantLogo tenantSlug={tenant?.slug} logoVersion={tenant?.logoUpdatedAt} alt="Task Manager" size="h-8 w-8" />
          </div>
        )}
        <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100 truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        {!isMasterAdmin && (
          <NavLink
            to={`${basePath}/chat`}
            className={({ isActive }) => `
              relative p-1.5 rounded-lg transition-colors
              ${isActive
                ? "text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30"
                : "text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }
            `}
            title="Mensagens"
            aria-label="Mensagens"
          >
            <MessageCircle size={18} />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white leading-none">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </NavLink>
        )}
        <ThemeSwitch />
        <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
          {new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
        </div>
      </div>
    </header>
  );
}
