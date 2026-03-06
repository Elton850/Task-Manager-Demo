import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, CheckCheck, Check, Clock } from "lucide-react";
import { chatApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSocketChat } from "@/hooks/useSocketChat";
import type { ChatMessage, ChatReadStatus, ChatThread } from "@/types";
import Button from "@/components/ui/Button";

// Polling ativo apenas como fallback quando socket está desconectado
const POLL_INTERVAL_CONNECTED_MS = 30_000;
const POLL_INTERVAL_FALLBACK_MS = 5_000;

interface MessagePanelProps {
  thread: ChatThread;
  onRead: () => void;
}

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function MessageStatus({ messageId, readStatuses }: { messageId: string; readStatuses: Record<string, ChatReadStatus> }) {
  const status = readStatuses[messageId];
  if (!status) return <Clock size={12} className="opacity-60" />;
  if (status.readBy.length > 0) return <CheckCheck size={12} className="text-brand-400" />;
  if (status.deliveredTo.length > 0) return <CheckCheck size={12} className="opacity-60" />;
  return <Check size={12} className="opacity-60" />;
}

export default function MessagePanel({ thread, onRead }: MessagePanelProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [readStatuses, setReadStatuses] = useState<Record<string, ChatReadStatus>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [content, setContent] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  const displayName = thread.participants.map(p => p.nome).join(", ");

  const markRead = useCallback(async () => {
    try {
      await chatApi.markRead(thread.id);
      onRead();
    } catch {
      // silencioso
    }
  }, [thread.id, onRead]);

  const loadMessages = useCallback(async (scrollToBottom = false) => {
    try {
      const data = await chatApi.messages(thread.id);
      setMessages(data.messages);
      setReadStatuses(data.readStatuses);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
      if (scrollToBottom) {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
      if (data.messages.length > 0) {
        await markRead();
      }
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [thread.id, markRead]);

  // ── Socket realtime ──────────────────────────────────────────────────────────
  const { isConnected } = useSocketChat({
    threadId: thread.id,

    onNewMessage: useCallback(async (msg: ChatMessage) => {
      if (msg.threadId !== thread.id) return;
      setMessages(prev => {
        // Evitar duplicatas (mensagem já pode estar no estado por otimismo de envio)
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      lastMessageIdRef.current = msg.id;
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      // Marcar como lido automaticamente ao receber
      if (msg.senderId !== user?.id) {
        await markRead();
      }
    }, [thread.id, user?.id, markRead]),

    onMessageRead: useCallback(async (data: { threadId: string }) => {
      if (data.threadId !== thread.id) return;
      // Atualizar status de leitura recarregando do servidor
      try {
        const updated = await chatApi.messages(thread.id);
        setReadStatuses(updated.readStatuses);
      } catch {
        // silencioso
      }
    }, [thread.id]),
  });

  // ── Carga inicial e polling de fallback ──────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    loadMessages(true);

    const pollInterval = isConnected ? POLL_INTERVAL_CONNECTED_MS : POLL_INTERVAL_FALLBACK_MS;
    const timer = setInterval(async () => {
      try {
        const data = await chatApi.messages(thread.id);
        const lastId = data.messages.at(-1)?.id;
        const isNew = lastId && lastId !== lastMessageIdRef.current;
        setMessages(data.messages);
        setReadStatuses(data.readStatuses);
        if (isNew) {
          lastMessageIdRef.current = lastId ?? null;
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
          await markRead();
        }
      } catch {
        // silencioso
      }
    }, pollInterval);

    return () => clearInterval(timer);
  }, [thread.id, loadMessages, markRead, isConnected]);

  // Atualiza ref para detectar novas mensagens
  useEffect(() => {
    if (messages.length > 0) {
      lastMessageIdRef.current = messages.at(-1)?.id ?? null;
    }
  }, [messages]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await chatApi.messages(thread.id, { before: nextCursor });
      setMessages(prev => [...data.messages, ...prev]);
      setReadStatuses(prev => ({ ...prev, ...data.readStatuses }));
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch {
      // silencioso
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const data = await chatApi.sendMessage(thread.id, trimmed);
      setMessages(prev => [...prev, data.message]);
      setContent("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      textareaRef.current?.focus();
    } catch {
      // silencioso — usuário vê que não foi enviado
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Agrupar mensagens por data
  const groupedMessages: { date: string; messages: ChatMessage[] }[] = [];
  for (const msg of messages) {
    const date = new Date(msg.createdAt).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    const last = groupedMessages.at(-1);
    if (last && last.date === date) {
      last.messages.push(msg);
    } else {
      groupedMessages.push({ date, messages: [msg] });
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/95 flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-sm font-semibold text-brand-700 dark:text-brand-300 flex-shrink-0">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{displayName}</p>
          {thread.type === "subtask" && (
            <p className="text-xs text-slate-500 dark:text-slate-400">Conversa de subtarefa</p>
          )}
        </div>
        {/* Indicador de conexão realtime */}
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? "bg-green-400" : "bg-slate-300 dark:bg-slate-600"}`}
          title={isConnected ? "Tempo real ativo" : "Modo polling (sem conexão realtime)"}
        />
      </div>

      {/* Messages */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1 bg-slate-50 dark:bg-slate-950/30">
        {hasMore && (
          <div className="flex justify-center mb-2">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="text-xs text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-50"
            >
              {loadingMore ? "Carregando..." : "Carregar mensagens anteriores"}
            </button>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-8 text-slate-400 text-sm">Carregando...</div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex justify-center py-8 text-slate-400 text-sm">
            Nenhuma mensagem ainda. Diga olá!
          </div>
        )}

        {groupedMessages.map(({ date, messages: dayMessages }) => (
          <div key={date}>
            {/* Date separator */}
            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0 capitalize">{date}</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            </div>

            {dayMessages.map((msg) => {
              const isOwn = msg.senderId === user?.id;
              const isDeleted = !!msg.deletedAt;

              return (
                <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-1`}>
                  <div className={`max-w-[75%] group`}>
                    {/* Sender name for non-own messages in group chats */}
                    {!isOwn && thread.participants.length > 1 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 ml-1">{msg.senderNome}</p>
                    )}
                    <div className={`
                      relative rounded-2xl px-3 py-2 text-sm leading-snug
                      ${isOwn
                        ? "bg-brand-600 text-white rounded-br-sm"
                        : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm border border-slate-100 dark:border-slate-700/50 rounded-bl-sm"
                      }
                      ${isDeleted ? "opacity-60 italic" : ""}
                    `}>
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? "justify-end" : "justify-start"}`}>
                        <span className={`text-xs opacity-70 ${isOwn ? "text-white/80" : "text-slate-400"}`}>
                          {formatMessageTime(msg.createdAt)}
                        </span>
                        {isOwn && (
                          <span className="text-white/80">
                            <MessageStatus messageId={msg.id} readStatuses={readStatuses} />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-4 py-3 bg-white dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-700/80">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem... (Enter para enviar, Shift+Enter para nova linha)"
            maxLength={4000}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:focus:ring-brand-500 focus:border-transparent transition"
            style={{ minHeight: "38px", maxHeight: "120px" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
          <Button
            type="button"
            onClick={handleSend}
            loading={sending}
            disabled={!content.trim() || sending}
            icon={<Send size={16} />}
            className="flex-shrink-0"
            aria-label="Enviar mensagem"
          >
            Enviar
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {content.length > 0 ? `${content.length}/4000` : "Enter para enviar"}
        </p>
      </div>
    </div>
  );
}
