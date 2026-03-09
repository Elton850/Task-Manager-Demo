/**
 * Socket.IO — namespace /ws-chat
 *
 * Fluxo:
 *   1. Cliente conecta com cookie auth_token.
 *   2. Middleware valida JWT → socket.data.user + socket.data.tenantId.
 *   3. Socket entra automaticamente em room `user:{userId}` (notificações pessoais).
 *   4. Cliente emite `join_thread` com { threadId } → servidor valida participação → socket.join(threadId).
 *   5. Backend HTTP emite `chat:new_message` / `chat:message_read` / `chat:thread_unread_update` para as rooms.
 *
 * Segurança:
 *   - Escrita continua via HTTP (auth/CSRF/rate-limit preservados).
 *   - Socket usado apenas para push de atualizações.
 *   - threadId nunca confiado sem verificar participação.
 *   - Tenant validado no handshake via JWT.
 *
 * Presença (efêmera em memória):
 *   - Limitação: não funciona com múltiplas instâncias PM2 sem Redis adapter.
 *   - Para escalar horizontalmente: adicionar socket.io-redis-adapter.
 */

import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import db from "../db";
import { verifyToken } from "../middleware/auth";
import type { AuthUser } from "../types";

// ─── Presence ─────────────────────────────────────────────────────────────────
// Mapa em memória: "tenantId:userId" → conjunto de socketIds ativos
const presenceMap = new Map<string, Set<string>>();

function presenceKey(tenantId: string, userId: string): string {
  return `${tenantId}:${userId}`;
}

export function isOnline(tenantId: string, userId: string): boolean {
  const set = presenceMap.get(presenceKey(tenantId, userId));
  return !!set && set.size > 0;
}

// ─── Cookie parser simples (para o handshake) ─────────────────────────────────
function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export function initChatSocket(
  httpServer: HttpServer,
  corsOriginFn: (origin: string) => boolean
): SocketServer {
  const io = new SocketServer(httpServer, {
    path: "/ws-chat",
    cors: {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin || corsOriginFn(origin)) {
          callback(null, true);
        } else {
          callback(new Error("CORS_DENIED"));
        }
      },
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // ── Middleware de autenticação no handshake ──
  io.use((socket: Socket, next: (err?: Error) => void) => {
    try {
      const cookieHeader = socket.request.headers.cookie ?? "";
      const cookies = parseCookies(cookieHeader);
      const token = cookies["auth_token"];
      if (!token) return next(new Error("UNAUTHORIZED"));

      const user = verifyToken(token);
      socket.data.user = user;
      socket.data.tenantId = user.tenantId;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user as AuthUser;
    const tenantId = socket.data.tenantId as string;

    // Room pessoal para notificações diretas ao usuário
    socket.join(`user:${user.id}`);
    // Room por tenant: presença e eventos só para usuários do mesmo tenant
    socket.join(`tenant:${tenantId}`);

    // ── Presença: marcar online ──
    const key = presenceKey(tenantId, user.id);
    const wasOffline = !presenceMap.has(key) || presenceMap.get(key)!.size === 0;
    if (!presenceMap.has(key)) presenceMap.set(key, new Set());
    presenceMap.get(key)!.add(socket.id);

    if (wasOffline) {
      // Notificar apenas usuários do mesmo tenant (exclui este socket)
      socket.to(`tenant:${tenantId}`).emit("chat:presence_update", { userId: user.id, status: "online" });
    }

    // ── join_thread: entrar na sala de uma thread após verificar participação ──
    socket.on("join_thread", async (data: unknown) => {
      try {
        const threadId = (data as { threadId?: string })?.threadId;
        if (!threadId || typeof threadId !== "string") return;

        const participant = await db
          .prepare(
            `SELECT p.id FROM chat_thread_participants p
             JOIN chat_threads t ON t.id = p.thread_id
             WHERE p.thread_id = ? AND p.user_id = ? AND t.tenant_id = ?`
          )
          .get(threadId, user.id, tenantId);

        if (!participant) return; // não autorizado — ignorar silenciosamente

        socket.join(threadId);
      } catch {
        // não propagar erros de socket para o cliente
      }
    });

    // ── leave_thread: sair da sala de uma thread ──
    socket.on("leave_thread", (data: unknown) => {
      const threadId = (data as { threadId?: string })?.threadId;
      if (threadId && typeof threadId === "string") {
        socket.leave(threadId);
      }
    });

    // ── disconnect: atualizar presença ──
    socket.on("disconnect", () => {
      const set = presenceMap.get(key);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) {
          presenceMap.delete(key);
          // Notificar apenas usuários do mesmo tenant (usar io para não depender do socket já desconectado)
          io.to(`tenant:${tenantId}`).emit("chat:presence_update", { userId: user.id, status: "offline" });
        }
      }
    });
  });

  return io;
}
