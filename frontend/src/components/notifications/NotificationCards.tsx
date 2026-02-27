import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertCircle, Calendar, CalendarDays, FileText, X } from "lucide-react";
import { useBasePath } from "@/contexts/BasePathContext";
import { useNotificationData, type NotificationItem, type NotificationVariant } from "@/hooks/useNotificationData";

const AUTO_DISMISS_MS = 6000;

/**
 * Cores por variante alinhadas à paleta brand (índigo/azul):
 * - danger: urgente/atraso — rose mantido para convenção de alerta
 * - warning: atenção/hoje — brand-500
 * - info: informativo/amanhã — brand-600
 * - accent: ação (justificativas) — brand-700
 */
const variantBalloon: Record<NotificationVariant, { bg: string; bar: string; text: string }> = {
  danger: { bg: "bg-rose-600", bar: "bg-rose-400", text: "text-white" },
  warning: { bg: "bg-brand-500", bar: "bg-brand-300", text: "text-white" },
  info: { bg: "bg-brand-600", bar: "bg-brand-400", text: "text-white" },
  accent: { bg: "bg-brand-700", bar: "bg-brand-500", text: "text-white" },
};

const variantIcons: Record<NotificationVariant, React.ReactNode> = {
  danger: <AlertCircle size={18} className="flex-shrink-0 opacity-95" />,
  warning: <Calendar size={18} className="flex-shrink-0 opacity-95" />,
  info: <CalendarDays size={18} className="flex-shrink-0 opacity-95" />,
  accent: <FileText size={18} className="flex-shrink-0 opacity-95" />,
};

function NotificationBalloon({
  item,
  onDismiss,
  basePath,
}: {
  item: NotificationItem;
  onDismiss: (id: string) => void;
  basePath: string;
}) {
  const [visible, setVisible] = useState(true);
  const [startBar, setStartBar] = useState(false);
  const location = useLocation();
  const href = basePath ? basePath + item.link : item.link;
  const pathOnly = href.split("?")[0];
  const isActive = location.pathname === pathOnly;
  const style = variantBalloon[item.variant];

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(item.id), 280);
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [item.id, onDismiss]);

  useEffect(() => {
    const t = setTimeout(() => setStartBar(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setVisible(false);
      setTimeout(() => onDismiss(item.id), 280);
    },
    [item.id, onDismiss]
  );

  if (!visible) return null;

  return (
    <div
      className={`
        w-72 rounded-xl shadow-lg overflow-hidden
        border border-white/20
        flex flex-col
        transition-all duration-300 ease-out
        ${style.bg} ${style.text}
      `}
      style={{ boxShadow: "0 10px 40px -10px rgba(0,0,0,0.2)" }}
    >
      <div className="flex items-start gap-2.5 p-3.5 pb-2.5">
        <span className="mt-0.5" aria-hidden>{variantIcons[item.variant]}</span>
        <Link
          to={href}
          className={`flex-1 min-w-0 text-sm font-medium leading-snug hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent rounded ${isActive ? "opacity-90" : ""}`}
        >
          <span className="block truncate">{item.title}</span>
          <span className="block truncate opacity-95 font-normal">{item.summary}</span>
        </Link>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Fechar notificação"
          className="p-1 rounded-md hover:bg-white/20 transition-colors flex-shrink-0 opacity-90 hover:opacity-100"
        >
          <X size={16} strokeWidth={2.5} />
        </button>
      </div>
      <div className="h-1 bg-black/15 overflow-hidden" aria-hidden>
        <div
          className={`h-full ${style.bar} rounded-r-full`}
          style={
            startBar
              ? {
                  animation: `notification-countdown ${AUTO_DISMISS_MS}ms linear forwards`,
                }
              : { width: "100%" }
          }
        />
      </div>
    </div>
  );
}

export default function NotificationCards() {
  const basePath = useBasePath();
  const { items, loading } = useNotificationData(basePath);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visibleItems = items.filter(i => !dismissed.has(i.id));
  const handleDismiss = useCallback((id: string) => setDismissed(prev => new Set(prev).add(id)), []);

  if (loading || visibleItems.length === 0) return null;

  return (
    <div
      className="fixed right-4 top-24 z-40 flex flex-col gap-3 pointer-events-none"
      role="region"
      aria-label="Notificações rápidas"
    >
      <div className="flex flex-col gap-3 pointer-events-auto">
        {visibleItems.map(item => (
          <NotificationBalloon
            key={item.id}
            item={item}
            onDismiss={handleDismiss}
            basePath={basePath}
          />
        ))}
      </div>
    </div>
  );
}
