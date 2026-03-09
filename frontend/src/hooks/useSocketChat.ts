/**
 * useSocketChat — gerencia a conexão Socket.IO para o chat realtime.
 *
 * Singleton por tab: uma única conexão compartilhada entre componentes.
 * Reconexão automática gerenciada pelo socket.io-client.
 * Fallback: quando socket está desconectado, o polling em MessagePanel/useChatUnread continua ativo.
 *
 * Uso:
 *   const { isConnected } = useSocketChat({
 *     threadId: thread.id,
 *     onNewMessage: (msg) => { ... },
 *     onMessageRead: ({ threadId, userId }) => { ... },
 *     onUnreadUpdate: ({ threadId, unreadCount }) => { ... },
 *   });
 *
 * Para assinar apenas unread_update (sem abrir uma thread específica), omitir threadId.
 */

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { ChatMessage } from "@/types";

// ─── Singleton ────────────────────────────────────────────────────────────────
// Uma única instância de socket por tab de navegador.
let _socket: Socket | null = null;
let _refCount = 0;

function acquireSocket(): Socket {
  _refCount++;
  if (!_socket) {
    _socket = io({
      path: "/ws-chat",
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
    });
  }
  return _socket;
}

function releaseSocket(): void {
  _refCount--;
  if (_refCount <= 0) {
    _refCount = 0;
    _socket?.disconnect();
    _socket = null;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export type PresenceStatus = "online" | "offline";

interface UseSocketChatOptions {
  /** ID da thread para entrar na sala e receber eventos de mensagem. Opcional. */
  threadId?: string | null;
  onNewMessage?: (msg: ChatMessage) => void;
  onMessageRead?: (data: { threadId: string; userId: string }) => void;
  onUnreadUpdate?: (data: { threadId: string; unreadCount: number }) => void;
  /** Atualização de presença (online/offline) de usuários do mesmo tenant. */
  onPresenceUpdate?: (data: { userId: string; status: PresenceStatus }) => void;
}

export function useSocketChat({
  threadId,
  onNewMessage,
  onMessageRead,
  onUnreadUpdate,
  onPresenceUpdate,
}: UseSocketChatOptions = {}): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const currentThreadRef = useRef<string | null | undefined>(null);

  // Refs para callbacks (evitar re-registrar listeners ao mudar callbacks)
  const onNewMessageRef = useRef(onNewMessage);
  const onMessageReadRef = useRef(onMessageRead);
  const onUnreadUpdateRef = useRef(onUnreadUpdate);
  const onPresenceUpdateRef = useRef(onPresenceUpdate);
  onNewMessageRef.current = onNewMessage;
  onMessageReadRef.current = onMessageRead;
  onUnreadUpdateRef.current = onUnreadUpdate;
  onPresenceUpdateRef.current = onPresenceUpdate;

  // Montar/desmontar socket
  useEffect(() => {
    const socket = acquireSocket();
    socketRef.current = socket;

    function handleConnect() {
      setIsConnected(true);
      // Re-entrar na thread se já tinha uma (após reconexão)
      if (currentThreadRef.current) {
        socket.emit("join_thread", { threadId: currentThreadRef.current });
      }
    }

    function handleDisconnect() {
      setIsConnected(false);
    }

    function handleNewMessage(data: { message: ChatMessage }) {
      onNewMessageRef.current?.(data.message);
    }

    function handleMessageRead(data: { threadId: string; userId: string }) {
      onMessageReadRef.current?.(data);
    }

    function handleUnreadUpdate(data: { threadId: string; unreadCount: number }) {
      onUnreadUpdateRef.current?.(data);
    }

    function handlePresenceUpdate(data: { userId: string; status: "online" | "offline" }) {
      onPresenceUpdateRef.current?.(data);
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("chat:new_message", handleNewMessage);
    socket.on("chat:message_read", handleMessageRead);
    socket.on("chat:thread_unread_update", handleUnreadUpdate);
    socket.on("chat:presence_update", handlePresenceUpdate);

    // Estado inicial da conexão
    setIsConnected(socket.connected);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("chat:new_message", handleNewMessage);
      socket.off("chat:message_read", handleMessageRead);
      socket.off("chat:thread_unread_update", handleUnreadUpdate);
      socket.off("chat:presence_update", handlePresenceUpdate);
      releaseSocket();
      socketRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Entrar/sair da sala da thread quando threadId muda
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    // Sair da thread anterior
    if (currentThreadRef.current && currentThreadRef.current !== threadId) {
      socket.emit("leave_thread", { threadId: currentThreadRef.current });
    }

    // Entrar na nova thread
    if (threadId) {
      socket.emit("join_thread", { threadId });
    }

    currentThreadRef.current = threadId;

    return () => {
      if (threadId && socketRef.current) {
        socketRef.current.emit("leave_thread", { threadId });
      }
    };
  }, [threadId]);

  return { isConnected };
}
