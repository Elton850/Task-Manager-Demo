import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MessageCircle, ArrowLeft, Plus } from "lucide-react";
import { chatApi, usersApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useBasePath } from "@/contexts/BasePathContext";
import { useChatUnread } from "@/hooks/useChatUnread";
import { useSocketChat } from "@/hooks/useSocketChat";
import type { ChatThread, User } from "@/types";
import ThreadList from "@/components/chat/ThreadList";
import MessagePanel from "@/components/chat/MessagePanel";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

const POLL_INTERVAL_MS = 30_000;

export default function ChatPage() {
  const { user } = useAuth();
  const basePath = useBasePath();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refresh: refreshUnread } = useChatUnread();

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatTargetId, setNewChatTargetId] = useState("");
  const [creatingChat, setCreatingChat] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [isMobileView, setIsMobileView] = useState(false);
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, "online" | "offline">>({});

  useSocketChat({
    onPresenceUpdate: useCallback((data: { userId: string; status: "online" | "offline" }) => {
      setPresenceByUserId(prev => ({ ...prev, [data.userId]: data.status }));
    }, []),
  });

  // Detectar se está em mobile (ocultar thread list quando conversa aberta)
  useEffect(() => {
    const check = () => setIsMobileView(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const loadThreads = useCallback(async () => {
    try {
      const data = await chatApi.threads();
      setThreads(data.threads);
      if (user?.id) {
        const participantIds = new Set<string>();
        for (const t of data.threads) {
          for (const p of t.participants) {
            if (p.id !== user.id) participantIds.add(p.id);
          }
        }
        if (participantIds.size > 0) {
          const { presence } = await chatApi.presence([...participantIds]);
          setPresenceByUserId(prev => ({ ...prev, ...presence }));
        }
      }
    } catch {
      // silencioso
    } finally {
      setLoadingThreads(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadThreads();
    const timer = setInterval(loadThreads, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadThreads]);

  // Abrir thread a partir de query param ?thread=<threadId> ou ?subtask=<subtaskId>
  useEffect(() => {
    const threadId = searchParams.get("thread");
    const subtaskId = searchParams.get("subtask");

    if (threadId) {
      setSelectedThreadId(threadId);
      return;
    }

    if (subtaskId) {
      chatApi.openSubtask(subtaskId).then(data => {
        setSelectedThreadId(data.threadId);
        loadThreads();
      }).catch(() => {});
    }
  }, [searchParams, loadThreads]);

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
  };

  const handleRead = useCallback(() => {
    loadThreads();
    refreshUnread();
  }, [loadThreads, refreshUnread]);

  const handleOpenNewChat = async () => {
    try {
      const data = await usersApi.list();
      setUsers(data.users.filter(u => u.id !== user?.id && u.active));
    } catch {
      setUsers([]);
    }
    setNewChatTargetId("");
    setShowNewChat(true);
  };

  const handleCreateDirect = async () => {
    if (!newChatTargetId || creatingChat) return;
    setCreatingChat(true);
    try {
      const data = await chatApi.openDirect(newChatTargetId);
      setShowNewChat(false);
      setSelectedThreadId(data.threadId);
      await loadThreads();
    } catch {
      // silencioso
    } finally {
      setCreatingChat(false);
    }
  };

  const selectedThread = threads.find(t => t.id === selectedThreadId) ?? null;
  const showThreadList = !isMobileView || !selectedThreadId;
  const showPanel = !isMobileView || !!selectedThreadId;

  return (
    <div className="flex h-[calc(100vh-57px)] overflow-hidden">
      {/* Thread list */}
      {showThreadList && (
        <div className="w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/95">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700/80 flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} className="text-brand-600 dark:text-brand-400" />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Mensagens</h2>
            </div>
            <button
              type="button"
              onClick={handleOpenNewChat}
              title="Nova conversa"
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Nova conversa"
            >
              <Plus size={16} />
            </button>
          </div>
          <ThreadList
            threads={threads}
            selectedThreadId={selectedThreadId}
            onSelect={handleSelectThread}
            loading={loadingThreads}
            presenceByUserId={presenceByUserId}
            currentUserId={user?.id ?? null}
          />
        </div>
      )}

      {/* Message panel */}
      {showPanel && (
        <div className="flex-1 flex flex-col min-w-0">
          {selectedThread ? (
            <>
              {/* Back button on mobile */}
              {isMobileView && (
                <button
                  type="button"
                  onClick={() => setSelectedThreadId(null)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 border-b border-slate-200 dark:border-slate-700/80"
                >
                  <ArrowLeft size={16} />
                  Voltar
                </button>
              )}
              <MessagePanel
                thread={selectedThread}
                onRead={handleRead}
                presenceByUserId={presenceByUserId}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400 dark:text-slate-500">
              <MessageCircle size={48} className="opacity-30" />
              <p className="text-sm">Selecione uma conversa ou inicie uma nova</p>
              <Button
                type="button"
                variant="outline"
                icon={<Plus size={16} />}
                onClick={handleOpenNewChat}
              >
                Nova conversa
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Modal: nova conversa direta */}
      <Modal
        open={showNewChat}
        onClose={() => setShowNewChat(false)}
        title="Nova conversa"
      >
        <div className="space-y-4">
          <Select
            label="Conversar com"
            value={newChatTargetId}
            onChange={e => setNewChatTargetId(e.target.value)}
            options={users.map(u => ({ value: u.id, label: `${u.nome} (${u.email})` }))}
            placeholder="Selecione um usuário..."
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowNewChat(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreateDirect}
              loading={creatingChat}
              disabled={!newChatTargetId}
            >
              Abrir conversa
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
