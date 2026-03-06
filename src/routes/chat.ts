/**
 * Rotas de chat interno entre usuários do mesmo tenant.
 *
 * Endpoints:
 *   GET  /api/chat/unread-count               — contagem global de não lidas
 *   GET  /api/chat/threads                    — lista threads do usuário autenticado
 *   POST /api/chat/threads/direct             — abre/obtém thread direta com outro usuário
 *   POST /api/chat/threads/subtask/:subtaskId — abre/obtém thread vinculada a subtarefa
 *   GET  /api/chat/threads/:threadId/messages — lista mensagens (cursor-based, max 50)
 *   POST /api/chat/threads/:threadId/messages — envia mensagem
 *   POST /api/chat/threads/:threadId/read     — marca thread como lida
 *
 * Regras de segurança:
 *   - requireAuth em todas as rotas
 *   - tenant_id obrigatório em todas as queries
 *   - Usuário só acessa threads onde é participante
 *   - Subtarefa: só acessa quem é responsável, criador da tarefa pai, LEADER da área ou ADMIN
 *   - ThreadId nunca exposto a não-participantes sem permissão
 *   - Thread direta usa chave canônica (participant_a < participant_b) para evitar duplicação
 *   - Mensagem deletada (deleted_at != null) aparece como "[mensagem removida]"
 *   - Conteúdo limitado a 4000 caracteres
 *   - Rate-limit de envio aplicado no server.ts
 */

import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import type { Server as SocketServer } from "socket.io";
import db from "../db";
import { requireAuth } from "../middleware/auth";
import { nowIso } from "../utils";
import { isOnline } from "../ws/chat-socket";

const router = Router();
router.use(requireAuth);

const MAX_CONTENT_LENGTH = 4000;
const DEFAULT_PAGE_SIZE = 50;

// ─── Interfaces internas ──────────────────────────────────────────────────────

interface ParticipantRow {
  id: string;
  thread_id: string;
  user_id: string;
  unread_count: number;
  last_read_at: string | null;
  joined_at: string;
}

interface MessageRow {
  id: string;
  tenant_id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  deleted_at: string | null;
}

interface SubtaskRow {
  id: string;
  responsavel_email: string;
  created_by: string;
  parent_task_id: string | null;
  area: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Verifica permissão de acesso à subtarefa espelhando canReadTask de tasks.ts:
 * ADMIN → sempre; LEADER → mesma área; USER → é responsável ou responsável da tarefa pai.
 */
async function canAccessSubtask(
  user: Request["user"],
  subtask: SubtaskRow,
  tenantId: string
): Promise<boolean> {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (user.role === "LEADER") return subtask.area === user.area;
  if (subtask.responsavel_email === user.email) return true;
  if (subtask.parent_task_id) {
    const parent = await db
      .prepare("SELECT responsavel_email FROM tasks WHERE id = ? AND tenant_id = ?")
      .get(subtask.parent_task_id, tenantId) as { responsavel_email: string } | undefined;
    if (parent && parent.responsavel_email === user.email) return true;
  }
  return false;
}

/** Verifica se o usuário é participante do thread e pertence ao mesmo tenant. */
async function assertParticipant(
  threadId: string,
  userId: string,
  tenantId: string
): Promise<ParticipantRow | null> {
  const thread = await db
    .prepare("SELECT id FROM chat_threads WHERE id = ? AND tenant_id = ?")
    .get(threadId, tenantId) as { id: string } | undefined;
  if (!thread) return null;

  const participant = await db
    .prepare("SELECT * FROM chat_thread_participants WHERE thread_id = ? AND user_id = ?")
    .get(threadId, userId) as ParticipantRow | undefined;

  return participant ?? null;
}

/** Registra evento de auditoria. Silencia erros para não bloquear fluxo principal. */
async function logEvent(
  tenantId: string,
  messageId: string,
  userId: string,
  eventType: "sent" | "delivered" | "read"
): Promise<void> {
  try {
    await db
      .prepare(
        "INSERT INTO chat_message_events (id, tenant_id, message_id, user_id, event_type, event_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(uuidv4(), tenantId, messageId, userId, eventType, nowIso());
  } catch {
    // não bloquear o fluxo por erro de auditoria
  }
}

/** Formata uma mensagem para o response, substituindo conteúdo deletado. */
function formatMessage(row: MessageRow, senderNome: string) {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderId: row.sender_id,
    senderNome,
    content: row.deleted_at ? "[mensagem removida]" : row.content,
    createdAt: row.created_at,
    deletedAt: row.deleted_at ?? null,
  };
}

/** Constrói placeholders para IN (?, ?, ...). */
function placeholders(n: number): string {
  return Array(n).fill("?").join(",");
}

// ─── GET /api/chat/unread-count ───────────────────────────────────────────────
router.get("/unread-count", async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userId = req.user!.id;
  try {
    const row = await db
      .prepare(
        `SELECT COALESCE(SUM(p.unread_count), 0) AS total
         FROM chat_thread_participants p
         JOIN chat_threads t ON t.id = p.thread_id
         WHERE p.user_id = ? AND t.tenant_id = ?`
      )
      .get(userId, tenantId) as { total: number } | undefined;
    res.json({ unread: row?.total ?? 0 });
  } catch {
    res.status(500).json({ error: "Erro ao buscar contagem.", code: "INTERNAL" });
  }
});

// ─── GET /api/chat/threads ────────────────────────────────────────────────────
router.get("/threads", async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userId = req.user!.id;
  try {
    const threads = await db
      .prepare(
        `SELECT
           t.id, t.type, t.subtask_id, t.created_at, t.updated_at,
           p.unread_count, p.last_read_at,
           lm.content AS last_message_content,
           lm.sender_id AS last_message_sender_id,
           lm.created_at AS last_message_at,
           lm.deleted_at AS last_message_deleted_at,
           lu.nome AS last_message_sender_nome
         FROM chat_thread_participants p
         JOIN chat_threads t ON t.id = p.thread_id
         LEFT JOIN chat_messages lm ON lm.id = (
           SELECT id FROM chat_messages
           WHERE thread_id = t.id AND deleted_at IS NULL
           ORDER BY created_at DESC LIMIT 1
         )
         LEFT JOIN users lu ON lu.id = lm.sender_id
         WHERE p.user_id = ? AND t.tenant_id = ?
         ORDER BY t.updated_at DESC
         LIMIT 100`
      )
      .all(userId, tenantId) as Array<{
        id: string;
        type: string;
        subtask_id: string | null;
        created_at: string;
        updated_at: string;
        unread_count: number;
        last_read_at: string | null;
        last_message_content: string | null;
        last_message_sender_id: string | null;
        last_message_at: string | null;
        last_message_deleted_at: string | null;
        last_message_sender_nome: string | null;
      }>;

    if (threads.length === 0) {
      res.json({ threads: [] });
      return;
    }

    // Buscar todos os participantes em lote (elimina N+1)
    const threadIds = threads.map((t) => t.id);
    const participantRows = await db
      .prepare(
        `SELECT u.id, u.nome, u.email, p.thread_id
         FROM chat_thread_participants p
         JOIN users u ON u.id = p.user_id
         WHERE p.thread_id IN (${placeholders(threadIds.length)}) AND p.user_id != ?`
      )
      .all(...threadIds, userId) as Array<{
        id: string;
        nome: string;
        email: string;
        thread_id: string;
      }>;

    // Agrupar participantes por thread_id
    const participantsByThread = new Map<string, { id: string; nome: string; email: string }[]>();
    for (const row of participantRows) {
      const list = participantsByThread.get(row.thread_id) ?? [];
      list.push({ id: row.id, nome: row.nome, email: row.email });
      participantsByThread.set(row.thread_id, list);
    }

    const result = threads.map((t) => ({
      id: t.id,
      type: t.type,
      subtaskId: t.subtask_id,
      unreadCount: t.unread_count,
      lastReadAt: t.last_read_at,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      participants: participantsByThread.get(t.id) ?? [],
      lastMessage: t.last_message_at
        ? {
            content: t.last_message_deleted_at
              ? "[mensagem removida]"
              : (t.last_message_content ?? ""),
            senderId: t.last_message_sender_id,
            senderNome: t.last_message_sender_nome,
            createdAt: t.last_message_at,
          }
        : null,
    }));

    res.json({ threads: result });
  } catch {
    res.status(500).json({ error: "Erro ao listar conversas.", code: "INTERNAL" });
  }
});

// ─── POST /api/chat/threads/direct ───────────────────────────────────────────
router.post("/threads/direct", async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userId = req.user!.id;
  const { targetUserId } = req.body as { targetUserId?: string };

  if (!targetUserId || typeof targetUserId !== "string") {
    res.status(400).json({ error: "targetUserId é obrigatório.", code: "VALIDATION" });
    return;
  }
  if (targetUserId === userId) {
    res.status(400).json({ error: "Não é possível conversar consigo mesmo.", code: "VALIDATION" });
    return;
  }

  try {
    // Verificar que o alvo existe e pertence ao mesmo tenant
    const targetUser = await db
      .prepare("SELECT id FROM users WHERE id = ? AND tenant_id = ? AND active = 1")
      .get(targetUserId, tenantId) as { id: string } | undefined;

    if (!targetUser) {
      res.status(404).json({ error: "Usuário não encontrado neste tenant.", code: "NOT_FOUND" });
      return;
    }

    // Chave canônica para evitar duplicação por corrida
    const participantA = userId < targetUserId ? userId : targetUserId;
    const participantB = userId < targetUserId ? targetUserId : userId;

    // Buscar thread direta existente pela chave canônica (usa índice único)
    const existing = await db
      .prepare(
        `SELECT id FROM chat_threads
         WHERE tenant_id = ? AND type = 'direct'
           AND participant_a_user_id = ? AND participant_b_user_id = ?`
      )
      .get(tenantId, participantA, participantB) as { id: string } | undefined;

    if (existing) {
      res.json({ threadId: existing.id, created: false });
      return;
    }

    // Criar nova thread em transação para evitar race condition
    const threadId = uuidv4();
    const now = nowIso();

    await db.exec("BEGIN");
    try {
      // Re-verificar dentro da transação
      const doubleCheck = await db
        .prepare(
          `SELECT id FROM chat_threads
           WHERE tenant_id = ? AND type = 'direct'
             AND participant_a_user_id = ? AND participant_b_user_id = ?`
        )
        .get(tenantId, participantA, participantB) as { id: string } | undefined;

      if (doubleCheck) {
        await db.exec("ROLLBACK");
        res.json({ threadId: doubleCheck.id, created: false });
        return;
      }

      await db
        .prepare(
          `INSERT INTO chat_threads
             (id, tenant_id, type, subtask_id, participant_a_user_id, participant_b_user_id, created_at, updated_at)
           VALUES (?, ?, 'direct', NULL, ?, ?, ?, ?)`
        )
        .run(threadId, tenantId, participantA, participantB, now, now);

      await db
        .prepare(
          "INSERT INTO chat_thread_participants (id, thread_id, user_id, unread_count, joined_at) VALUES (?, ?, ?, 0, ?)"
        )
        .run(uuidv4(), threadId, userId, now);

      await db
        .prepare(
          "INSERT INTO chat_thread_participants (id, thread_id, user_id, unread_count, joined_at) VALUES (?, ?, ?, 0, ?)"
        )
        .run(uuidv4(), threadId, targetUserId, now);

      await db.exec("COMMIT");
    } catch (innerErr) {
      await db.exec("ROLLBACK");
      // Unique constraint violation — outro processo criou antes
      const race = await db
        .prepare(
          `SELECT id FROM chat_threads
           WHERE tenant_id = ? AND type = 'direct'
             AND participant_a_user_id = ? AND participant_b_user_id = ?`
        )
        .get(tenantId, participantA, participantB) as { id: string } | undefined;
      if (race) {
        res.json({ threadId: race.id, created: false });
        return;
      }
      throw innerErr;
    }

    res.status(201).json({ threadId, created: true });
  } catch {
    res.status(500).json({ error: "Erro ao criar conversa.", code: "INTERNAL" });
  }
});

// ─── POST /api/chat/threads/subtask/:subtaskId ────────────────────────────────
router.post("/threads/subtask/:subtaskId", async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userId = req.user!.id;
  const user = req.user!;
  const { subtaskId } = req.params;

  try {
    // Verificar que a subtarefa existe no tenant
    const subtask = await db
      .prepare(
        "SELECT id, responsavel_email, created_by, parent_task_id, area FROM tasks WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL"
      )
      .get(subtaskId, tenantId) as SubtaskRow | undefined;

    if (!subtask) {
      res.status(404).json({ error: "Subtarefa não encontrada.", code: "NOT_FOUND" });
      return;
    }

    // Verificar permissão de acesso à subtarefa
    const hasAccess = await canAccessSubtask(user, subtask, tenantId);
    if (!hasAccess) {
      res.status(403).json({ error: "Sem permissão para acessar esta subtarefa.", code: "FORBIDDEN" });
      return;
    }

    // Buscar thread de subtarefa existente pela chave única (tenant_id, subtask_id)
    const existing = await db
      .prepare(
        "SELECT id FROM chat_threads WHERE tenant_id = ? AND type = 'subtask' AND subtask_id = ?"
      )
      .get(tenantId, subtaskId) as { id: string } | undefined;

    if (existing) {
      const isParticipant = await db
        .prepare("SELECT id FROM chat_thread_participants WHERE thread_id = ? AND user_id = ?")
        .get(existing.id, userId) as { id: string } | undefined;

      if (!isParticipant) {
        // Apenas ADMIN ou LEADER da área podem se auto-adicionar
        const canAutoJoin = user.role === "ADMIN" || (user.role === "LEADER" && subtask.area === user.area);
        if (!canAutoJoin) {
          // Não vazar o threadId para quem não tem permissão
          res.status(403).json({ error: "Sem permissão para acessar esta conversa.", code: "FORBIDDEN" });
          return;
        }
        await db
          .prepare(
            "INSERT OR IGNORE INTO chat_thread_participants (id, thread_id, user_id, unread_count, joined_at) VALUES (?, ?, ?, 0, ?)"
          )
          .run(uuidv4(), existing.id, userId, nowIso());
      }

      res.json({ threadId: existing.id, created: false });
      return;
    }

    // Criar nova thread de subtarefa em transação
    const threadId = uuidv4();
    const now = nowIso();

    // Coletar participantes: responsável, criador da tarefa e usuário atual
    const participantIds = new Set<string>();
    participantIds.add(userId);

    const responsavel = await db
      .prepare("SELECT id FROM users WHERE email = ? AND tenant_id = ? AND active = 1")
      .get(subtask.responsavel_email, tenantId) as { id: string } | undefined;
    if (responsavel) participantIds.add(responsavel.id);

    const creator = await db
      .prepare("SELECT id FROM users WHERE email = ? AND tenant_id = ? AND active = 1")
      .get(subtask.created_by, tenantId) as { id: string } | undefined;
    if (creator) participantIds.add(creator.id);

    await db.exec("BEGIN");
    try {
      // Re-verificar dentro da transação
      const doubleCheck = await db
        .prepare(
          "SELECT id FROM chat_threads WHERE tenant_id = ? AND type = 'subtask' AND subtask_id = ?"
        )
        .get(tenantId, subtaskId) as { id: string } | undefined;

      if (doubleCheck) {
        await db.exec("ROLLBACK");
        // Garantir participação
        await db
          .prepare(
            "INSERT OR IGNORE INTO chat_thread_participants (id, thread_id, user_id, unread_count, joined_at) VALUES (?, ?, ?, 0, ?)"
          )
          .run(uuidv4(), doubleCheck.id, userId, nowIso());
        res.json({ threadId: doubleCheck.id, created: false });
        return;
      }

      await db
        .prepare(
          `INSERT INTO chat_threads
             (id, tenant_id, type, subtask_id, participant_a_user_id, participant_b_user_id, created_at, updated_at)
           VALUES (?, ?, 'subtask', ?, NULL, NULL, ?, ?)`
        )
        .run(threadId, tenantId, subtaskId, now, now);

      for (const participantUserId of participantIds) {
        await db
          .prepare(
            "INSERT OR IGNORE INTO chat_thread_participants (id, thread_id, user_id, unread_count, joined_at) VALUES (?, ?, ?, 0, ?)"
          )
          .run(uuidv4(), threadId, participantUserId, now);
      }

      await db.exec("COMMIT");
    } catch (innerErr) {
      await db.exec("ROLLBACK");
      throw innerErr;
    }

    res.status(201).json({ threadId, created: true });
  } catch {
    res.status(500).json({ error: "Erro ao criar conversa de subtarefa.", code: "INTERNAL" });
  }
});

// ─── GET /api/chat/threads/:threadId/messages ─────────────────────────────────
router.get("/threads/:threadId/messages", async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userId = req.user!.id;
  const { threadId } = req.params;
  const { before, limit } = req.query;

  const pageSize = Math.min(Number(limit) || DEFAULT_PAGE_SIZE, 100);

  try {
    const participant = await assertParticipant(threadId, userId, tenantId);
    if (!participant) {
      res.status(403).json({ error: "Acesso negado a esta conversa.", code: "FORBIDDEN" });
      return;
    }

    let query: string;
    let params: unknown[];

    if (before && typeof before === "string") {
      query = `
        SELECT m.*, u.nome AS sender_nome
        FROM chat_messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.thread_id = ? AND m.created_at < ?
        ORDER BY m.created_at DESC
        LIMIT ?
      `;
      params = [threadId, before, pageSize];
    } else {
      query = `
        SELECT m.*, u.nome AS sender_nome
        FROM chat_messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.thread_id = ?
        ORDER BY m.created_at DESC
        LIMIT ?
      `;
      params = [threadId, pageSize];
    }

    const rows = await db.prepare(query).all(...params) as Array<MessageRow & { sender_nome: string }>;

    if (rows.length > 0) {
      // Registrar "delivered" em lote para mensagens recebidas ainda não marcadas (elimina N+1)
      const receivedIds = rows
        .filter((r) => r.sender_id !== userId && !r.deleted_at)
        .map((r) => r.id);

      if (receivedIds.length > 0) {
        const alreadyDelivered = await db
          .prepare(
            `SELECT message_id FROM chat_message_events
             WHERE message_id IN (${placeholders(receivedIds.length)})
               AND user_id = ? AND event_type = 'delivered'`
          )
          .all(...receivedIds, userId) as { message_id: string }[];

        const deliveredSet = new Set(alreadyDelivered.map((r) => r.message_id));
        for (const msgId of receivedIds) {
          if (!deliveredSet.has(msgId)) {
            await logEvent(tenantId, msgId, userId, "delivered");
          }
        }
      }
    }

    // Inverter para ordem cronológica
    const messages = rows.reverse().map((r) => formatMessage(r, r.sender_nome));
    const hasMore = rows.length === pageSize;
    const nextCursor = hasMore && rows.length > 0 ? rows[0].created_at : null;

    // Buscar status de leitura em lote para mensagens enviadas pelo usuário (elimina N+1)
    const sentIds = messages.filter((m) => m.senderId === userId).map((m) => m.id);
    const readStatuses: Record<string, { readBy: string[]; deliveredTo: string[] }> = {};

    if (sentIds.length > 0) {
      const receipts = await db
        .prepare(
          `SELECT message_id, user_id FROM chat_message_receipts
           WHERE message_id IN (${placeholders(sentIds.length)})`
        )
        .all(...sentIds) as { message_id: string; user_id: string }[];

      const deliveries = await db
        .prepare(
          `SELECT DISTINCT message_id, user_id FROM chat_message_events
           WHERE message_id IN (${placeholders(sentIds.length)}) AND event_type = 'delivered'`
        )
        .all(...sentIds) as { message_id: string; user_id: string }[];

      for (const id of sentIds) {
        readStatuses[id] = { readBy: [], deliveredTo: [] };
      }
      for (const r of receipts) {
        readStatuses[r.message_id]?.readBy.push(r.user_id);
      }
      for (const d of deliveries) {
        readStatuses[d.message_id]?.deliveredTo.push(d.user_id);
      }
    }

    res.json({ messages, readStatuses, nextCursor, hasMore });
  } catch {
    res.status(500).json({ error: "Erro ao listar mensagens.", code: "INTERNAL" });
  }
});

// ─── POST /api/chat/threads/:threadId/messages ────────────────────────────────
router.post("/threads/:threadId/messages", async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userId = req.user!.id;
  const { threadId } = req.params;
  const { content } = req.body as { content?: string };

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "Conteúdo da mensagem é obrigatório.", code: "VALIDATION" });
    return;
  }

  const sanitizedContent = content.trim().slice(0, MAX_CONTENT_LENGTH);

  try {
    const participant = await assertParticipant(threadId, userId, tenantId);
    if (!participant) {
      res.status(403).json({ error: "Acesso negado a esta conversa.", code: "FORBIDDEN" });
      return;
    }

    const messageId = uuidv4();
    const now = nowIso();

    await db
      .prepare(
        "INSERT INTO chat_messages (id, tenant_id, thread_id, sender_id, content, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(messageId, tenantId, threadId, userId, sanitizedContent, now);

    await db
      .prepare("UPDATE chat_threads SET updated_at = ? WHERE id = ?")
      .run(now, threadId);

    await db
      .prepare(
        `UPDATE chat_thread_participants
         SET unread_count = unread_count + 1
         WHERE thread_id = ? AND user_id != ?`
      )
      .run(threadId, userId);

    await logEvent(tenantId, messageId, userId, "sent");

    const sender = await db
      .prepare("SELECT nome FROM users WHERE id = ?")
      .get(userId) as { nome: string } | undefined;

    const messagePayload = {
      id: messageId,
      threadId,
      senderId: userId,
      senderNome: sender?.nome ?? "",
      content: sanitizedContent,
      createdAt: now,
      deletedAt: null,
    };

    // Emitir eventos Socket.IO para participantes da thread
    const io = req.app.locals.io as SocketServer | undefined;
    if (io) {
      io.to(threadId).emit("chat:new_message", { message: messagePayload });

      // Notificar cada participante (exceto o remetente) sobre contagem de não lidas
      const others = await db
        .prepare(
          "SELECT user_id, unread_count FROM chat_thread_participants WHERE thread_id = ? AND user_id != ?"
        )
        .all(threadId, userId) as { user_id: string; unread_count: number }[];
      for (const p of others) {
        io.to(`user:${p.user_id}`).emit("chat:thread_unread_update", {
          threadId,
          unreadCount: p.unread_count,
        });
      }
    }

    res.status(201).json({ message: messagePayload });
  } catch {
    res.status(500).json({ error: "Erro ao enviar mensagem.", code: "INTERNAL" });
  }
});

// ─── POST /api/chat/threads/:threadId/read ────────────────────────────────────
router.post("/threads/:threadId/read", async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userId = req.user!.id;
  const { threadId } = req.params;

  try {
    const participant = await assertParticipant(threadId, userId, tenantId);
    if (!participant) {
      res.status(403).json({ error: "Acesso negado a esta conversa.", code: "FORBIDDEN" });
      return;
    }

    const now = nowIso();

    await db
      .prepare(
        `UPDATE chat_thread_participants
         SET unread_count = 0, last_read_at = ?
         WHERE thread_id = ? AND user_id = ?`
      )
      .run(now, threadId, userId);

    const unreadMessages = await db
      .prepare(
        `SELECT id FROM chat_messages
         WHERE thread_id = ? AND sender_id != ? AND deleted_at IS NULL
           AND id NOT IN (SELECT message_id FROM chat_message_receipts WHERE user_id = ?)`
      )
      .all(threadId, userId, userId) as { id: string }[];

    for (const msg of unreadMessages) {
      await db
        .prepare(
          "INSERT OR IGNORE INTO chat_message_receipts (id, tenant_id, message_id, user_id, read_at) VALUES (?, ?, ?, ?, ?)"
        )
        .run(uuidv4(), tenantId, msg.id, userId, now);
      await logEvent(tenantId, msg.id, userId, "read");
    }

    // Emitir eventos Socket.IO
    const io = req.app.locals.io as SocketServer | undefined;
    if (io) {
      if (unreadMessages.length > 0) {
        io.to(threadId).emit("chat:message_read", { threadId, userId });
      }
      io.to(`user:${userId}`).emit("chat:thread_unread_update", { threadId, unreadCount: 0 });
    }

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro ao marcar como lido.", code: "INTERNAL" });
  }
});

// ─── GET /api/chat/presence ───────────────────────────────────────────────────
// Retorna status online/offline para uma lista de userIds do mesmo tenant.
// Presença é efêmera em memória — não persiste entre reinicializações.
// Limitação: em múltiplas instâncias PM2 sem Redis adapter, a presença não é globalmente consistente.
router.get("/presence", (req: Request, res: Response): void => {
  const tenantId = req.tenantId!;
  const { userIds } = req.query;

  if (!userIds || typeof userIds !== "string") {
    res.status(400).json({ error: "userIds é obrigatório.", code: "VALIDATION" });
    return;
  }

  const ids = userIds.split(",").map((id) => id.trim()).filter(Boolean).slice(0, 50);
  const result: Record<string, "online" | "offline"> = {};
  for (const id of ids) {
    result[id] = isOnline(tenantId, id) ? "online" : "offline";
  }

  res.json({ presence: result });
});

export default router;
