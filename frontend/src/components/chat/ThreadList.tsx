import React from "react";
import { MessageCircle, Users } from "lucide-react";
import type { ChatThread } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

export type PresenceMap = Record<string, "online" | "offline">;

interface ThreadListProps {
  threads: ChatThread[];
  selectedThreadId: string | null;
  onSelect: (threadId: string) => void;
  loading: boolean;
  /** Status online/offline por userId (conversas diretas). */
  presenceByUserId?: PresenceMap;
  /** ID do usuário atual (para não exibir presença de si mesmo). */
  currentUserId?: string | null;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function ThreadList({
  threads,
  selectedThreadId,
  onSelect,
  loading,
  presenceByUserId = {},
  currentUserId,
}: ThreadListProps) {
  const { user } = useAuth();
  const uid = currentUserId ?? user?.id;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
        Carregando conversas...
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400 px-4 text-center">
        <MessageCircle size={32} className="opacity-40" />
        <p className="text-sm">Nenhuma conversa ainda.<br />Inicie uma clicando em um usuário ou via subtarefa.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-y-auto">
      {threads.map((thread) => {
        const isSelected = thread.id === selectedThreadId;
        const displayName = thread.participants.length > 0
          ? thread.participants.map(p => p.nome).join(", ")
          : "Conversa";
        const isSubtask = thread.type === "subtask";
        const lastMsg = thread.lastMessage;
        const isMyLastMsg = lastMsg?.senderId === user?.id;
        const isDirectWithOne = thread.type === "direct" && thread.participants.length === 1;
        const remoteParticipant = isDirectWithOne ? thread.participants[0] : null;
        const presenceStatus = remoteParticipant && uid && remoteParticipant.id !== uid
          ? (presenceByUserId[remoteParticipant.id] ?? "offline")
          : null;

        return (
          <button
            key={thread.id}
            type="button"
            onClick={() => onSelect(thread.id)}
            className={`
              w-full flex items-start gap-3 px-4 py-3 text-left transition-colors
              border-b border-slate-100 dark:border-slate-700/50
              ${isSelected
                ? "bg-brand-50 dark:bg-brand-900/20"
                : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }
            `}
          >
            {/* Avatar com indicador de presença (apenas conversa direta) */}
            <div className="relative flex-shrink-0">
              <div className={`
                w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold
                ${isSubtask
                  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                  : "bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300"
                }
              `}>
                {isSubtask
                  ? <Users size={16} />
                  : displayName.charAt(0).toUpperCase()
                }
              </div>
              {presenceStatus != null && (
                <span
                  className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                    presenceStatus === "online" ? "bg-green-500" : "bg-slate-300 dark:bg-slate-600"
                  }`}
                  title={presenceStatus === "online" ? "Online" : "Offline"}
                  aria-label={presenceStatus === "online" ? "Online" : "Offline"}
                />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className={`text-sm truncate ${thread.unreadCount > 0 ? "font-semibold text-slate-900 dark:text-slate-100" : "font-medium text-slate-700 dark:text-slate-300"}`}>
                  {isSubtask ? `Subtarefa: ${displayName}` : displayName}
                </span>
                {lastMsg && (
                  <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
                    {formatTime(lastMsg.createdAt)}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 mt-0.5">
                <span className={`text-xs truncate ${thread.unreadCount > 0 ? "text-slate-700 dark:text-slate-300" : "text-slate-500 dark:text-slate-400"}`}>
                  {lastMsg
                    ? `${isMyLastMsg ? "Você: " : ""}${lastMsg.content}`
                    : <span className="italic opacity-70">Sem mensagens</span>
                  }
                </span>
                {thread.unreadCount > 0 && (
                  <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-xs font-bold bg-brand-600 text-white">
                    {thread.unreadCount > 99 ? "99+" : thread.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
