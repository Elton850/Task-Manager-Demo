/**
 * Rotas de chat interno entre usuários do mesmo tenant.
 *
 * Endpoints:
 *   GET  /api/chat/threads                    — lista threads do usuário autenticado
 *   POST /api/chat/threads/direct             — abre/obtém thread direta com outro usuário
 *   POST /api/chat/threads/subtask/:subtaskId — abre/obtém thread vinculada a subtarefa
 *   GET  /api/chat/threads/:threadId/messages — lista mensagens (cursor-based, max 50)
 *   POST /api/chat/threads/:threadId/messages — envia mensagem
 *   POST /api/chat/threads/:threadId/read     — marca thread como lida
 *   GET  /api/chat/unread-count               — contagem global de não lidas
 *
 * Regras de segurança:
 *   - requireAuth em todas as rotas
 *   - tenant_id obrigatório em todas as queries
 *   - Usuário só acessa threads onde é participante
 *   - Mensagem deletada (deleted_at != null) aparece como "[mensagem removida]"
 *   - Conteúdo limitado a 4000 caracteres
 *   - Rate-limit de envio aplicado no server.ts
 */

import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db";
import { requireAuth } from "../middleware/auth";
import { nowIso } from "../utils";

const router = Router();
router.use(requireAuth);

const MAX_CONTENT_LENGTH = 4000;
const DEFAULT_PAGE_SIZE = 50;

// ─── Interfaces internas ──────────────────────────────────────────────────────

interface ThreadRow {
  id: string;
  tenant_id: string;
  type: string;
  subtask_id: string | null;
  created_at: string;
  updated_at: string;
}

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

interface UserRow {
  id: string;
  nome: string;
  email: string;
  role: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Verifica se o usuário é participante do thread e pertence ao mesmo tenant. */
async function assertParticipant(threadId: string, userId: string, tenantId: string): Promise<ParticipantRow | null> {
  const thread = await db.prepare(
    "SELECT id FROM chat_threads WHERE id = ? AND tenant_id = ?"
  ).get(threadId, tenantId) as { id: string } | undefined;
  if (!thread) return null;

  const participant = await db.prepare(
    "SELECT * FROM chat_thread_participants WHERE thread_id = ? AND user_id = ?"
  ).get(threadId, userId) as ParticipantRow | undefined;

  return participant ?? null;
}

/** Resolve o nome de cada participante de um thread (exceto o próprio usuário). */
async function getOtherParticipantNames(threadId: string, currentUserId: string): Promise<{ id: string; nome: string; email: string }[]> {
  const rows = await db.prepare(`
    SELECT u.id, u.nome, u.email
    FROM chat_thread_participants p
    JOIN users u ON u.id = p.user_id
    WHERE p.thread_id = ? AND p.user_id != ?
  `).all(threadId, currentUserId) as UserRow[];
  return rows.map(r => ({ id: r.id, nome: r.nome, email: r.email }));
}

/** Registra evento de auditoria (enviada/lida/entregue). Silencia erros para não bloquear fluxo principal. */
async function logEvent(tenantId: string, messageId: string, userId: string, eventType: "sent" | "delivered" | "read"): Promise<void> {
  try {
    await db.prepare(
      "INSERT INTO chat_message_events (id, tenant_id, message_id, user_id, event_type, event_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(uuidv4(), tenantId, messageId, userId, eventType, nowIso());
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

// ─── GET /api/chat/unread-count ───────────────────────────────────────────────
router.get("/unread-count", async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userId = req.user!.id;
  try {
    const row = await db.prepare(`
      SELECT COALESCE(SUM(p.unread_count), 0) AS total
      FROM chat_thread_participants p
      JOIN chat_threads t ON t.id = p.thread_id
      WHERE p.user_id = ? AND t.tenant_id = ?
    `).get(userId, tenantId) as { total: number } | undefined;
    res.json({ unread: row?.total ?? 0 });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar contagem.", code: "INTERNAL" });
  }
});

// ─── GET /api/chat/threads ────────────────────────────────────────────────────
router.get("/threads", async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userId = req.user!.id;
  try {
    // Lista threads onde o usuário é participante, ordenado pelo mais recente
    const threads = await db.prepare(`
      SELECT
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
      LIMIT 100
    `).all(userId, tenantId) as Array<{
      id: string; type: string; subtask_id: string | null; created_at: string; updated_at: string;
      unread_count: number; last_read_at: string | null;
      last_message_content: string | null; last_message_sender_id: string | null;
      last_message_at: string | null; last_message_deleted_at: string | null;
      last_message_sender_nome: string | null;
    }>;

    // Para cada thread, buscar outros participantes
    const result = await Promise.all(threads.map(async (t) => {
      const others = await getOtherParticipantNames(t.id, userId);
      const lastMsg = t.last_message_at ? {
        content: t.last_message_deleted_at ? "[mensagem removida]" : (t.last_message_content ?? ""),
        senderId: t.last_message_sender_id,
        senderNome: t.last_message_sender_nome,
        createdAt: t.last_message_at,
      } : null;
      return {
        id: t.id,
        type: t.type,
        subtaskId: t.subtask_id,
        unreadCount: t.unread_count,
        lastReadAt: t.last_read_at,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        participants: others,
        lastMessage: lastMsg,
      };
    }));

    res.json({ threads: result });
  } catch (err) {
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
    const targetUser = await db.prepare(
      "SELECT id, nome, email FROM users WHERE id = ? AND tenant_id = ? AND active = 1"
    ).get(targetUserId, tenantId) as UserRow | undefined;

    if (!targetUser) {
      res.status(404).json({ error: "Usuário não encontrado neste tenant.", code: "NOT_FOUND" });
      return;
    }

    // Buscar thread direta existente entre estes dois usuários neste tenant
    const existing = await db.prepare(`
      SELECT t.id FROM chat_threads t
      JOIN chat_thread_participants p1 ON p1.thread_id = t.id AND p1.user_id = ?
      JOIN chat_thread_participants p2 ON p2.thread_id = t.id AND p2.user_id = ?
      WHERE t.tenant_id = ? AND t.type = 'direct'
      LIMIT 1
    `).get(userId, targetUserId, tenantId) as { id: string } | undefined;

    if (existing) {
      res.json({ threadId: existing.id, created: false });
      return;
    }

    // Criar nova thread direta
    const threadId = uuidv4();
    const now = nowIso();
    await db.prepare(
      "INSERT INTO chat_threads (id, tenant_id, type, subtask_id, created_at, updated_at) VALUES (?, ?, 'direct', NULL, ?, ?)"
    ).run(threadId, tenantId, now, now);

    const p1Id = uuidv4();
    const p2Id = uuidv4();
    await db.prepare(
      "INSERT INTO chat_thread_participants (id, thread_id, user_id, unread_count, joined_at) VALUES (?, ?, ?, 0, ?)"
    ).run(p1Id, threadId, userId, now);
    await db.prepare(
      "INSERT INTO chat_thread_participants (id, thread_id, user_id, unread_count, joined_at) VALUES (?, ?, ?, 0, ?)"
    ).run(p2Id, threadId, targetUserId, now);

    res.status(201).json({ threadId, created: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao criar conversa.", code: "INTERNAL" });
  }
});

// ─── POST /api/chat/threads/subtask/:subtaskId ────────────────────────────────
router.post("/threads/subtask/:subtaskId", async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userId = req.user!.id;
  const { subtaskId } = req.params;

  try {
    // Verificar que a subtarefa existe no tenant
    const subtask = await db.prepare(
      "SELECT id, responsavel_email, created_by, parent_task_id FROM tasks WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL"
    ).get(subtaskId, tenantId) as { id: string; responsavel_email: string; created_by: string; parent_task_id: string | null } | undefined;

    if (!subtask) {
      res.status(404).json({ error: "Subtarefa não encontrada.", code: "NOT_FOUND" });
      return;
    }

    // Buscar thread de subtarefa existente
    const existing = await db.prepare(`
      SELECT t.id FROM chat_threads t
      WHERE t.tenant_id = ? AND t.type = 'subtask' AND t.subtask_id = ?
      LIMIT 1
    `).get(tenantId, subtaskId) as { id: string } | undefined;

    if (existing) {
      // Garantir que o usuário é participante (pode ser um admin que está acessando pela primeira vez)
      const isParticipant = await db.prepare(
        "SELECT id FROM chat_thread_participants WHERE thread_id = ? AND user_id = ?"
      ).get(existing.id, userId) as { id: string } | undefined;

      if (!isParticipant) {
        // Adicionar como participante se for ADMIN ou LEADER
        if (req.user!.role === "ADMIN" || req.user!.role === "LEADER") {
          const now = nowIso();
          await db.prepare(
            "INSERT OR IGNORE INTO chat_thread_participants (id, thread_id, user_id, unread_count, joined_at) VALUES (?, ?, ?, 0, ?)"
          ).run(uuidv4(), existing.id, userId, now);
        }
      }

      res.json({ threadId: existing.id, created: false });
      return;
    }

    // Criar nova thread de subtarefa
    // Participantes: responsável da subtarefa + quem criou (se diferente) + usuário atual
    const participantEmails = new Set<string>();

    // Buscar responsável pelo email
    const responsavel = await db.prepare(
      "SELECT id FROM users WHERE email = ? AND tenant_id = ? AND active = 1"
    ).get(subtask.responsavel_email, tenantId) as { id: string } | undefined;
    if (responsavel) participantEmails.add(responsavel.id);

    // Quem criou a tarefa
    const creator = await db.prepare(
      "SELECT id FROM users WHERE email = ? AND tenant_id = ? AND active = 1"
    ).get(subtask.created_by, tenantId) as { id: string } | undefined;
    if (creator) participantEmails.add(creator.id);

    // Usuário atual
    participantEmails.add(userId);

    const threadId = uuidv4();
    const now = nowIso();
    await db.prepare(
      "INSERT INTO chat_threads (id, tenant_id, type, subtask_id, created_at, updated_at) VALUES (?, ?, 'subtask', ?, ?, ?)"
    ).run(threadId, tenantId, subtaskId, now, now);

    for (const participantUserId of participantEmails) {
      await db.prepare(
        "INSERT OR IGNORE INTO chat_thread_participants (id, thread_id, user_id, unread_count, joined_at) VALUES (?, ?, ?, 0, ?)"
      ).run(uuidv4(), threadId, participantUserId, now);
    }

    res.status(201).json({ threadId, created: true });
  } catch (err) {
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

    // Registrar "delivered" para mensagens não lidas do remetente diferente
    const unreadMsgIds = rows
      .filter(r => r.sender_id !== userId && !r.deleted_at)
      .map(r => r.id);

    for (const msgId of unreadMsgIds) {
      const alreadyDelivered = await db.prepare(
        "SELECT id FROM chat_message_events WHERE message_id = ? AND user_id = ? AND event_type = 'delivered'"
      ).get(msgId, userId) as { id: string } | undefined;
      if (!alreadyDelivered) {
        await logEvent(tenantId, msgId, userId, "delivered");
      }
    }

    // Inverter para ordem cronológica
    const messages = rows.reverse().map(r => formatMessage(r, r.sender_nome));
    const hasMore = rows.length === pageSize;
    const nextCursor = hasMore && rows.length > 0 ? rows[0].created_at : null;

    // Buscar status de leitura da mensagem mais recente para o emissor
    const readStatuses: Record<string, { readBy: string[]; deliveredTo: string[] }> = {};
    for (const msg of messages) {
      if (msg.senderId === userId) {
        const receipts = await db.prepare(
          "SELECT user_id FROM chat_message_receipts WHERE message_id = ?"
        ).all(msg.id) as { user_id: string }[];
        const deliveries = await db.prepare(
          "SELECT DISTINCT user_id FROM chat_message_events WHERE message_id = ? AND event_type = 'delivered'"
        ).all(msg.id) as { user_id: string }[];
        readStatuses[msg.id] = {
          readBy: receipts.map(r => r.user_id),
          deliveredTo: deliveries.map(d => d.user_id),
        };
      }
    }

    res.json({ messages, readStatuses, nextCursor, hasMore });
  } catch (err) {
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

    // Inserir mensagem
    await db.prepare(
      "INSERT INTO chat_messages (id, tenant_id, thread_id, sender_id, content, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(messageId, tenantId, threadId, userId, sanitizedContent, now);

    // Atualizar updated_at do thread
    await db.prepare(
      "UPDATE chat_threads SET updated_at = ? WHERE id = ?"
    ).run(now, threadId);

    // Incrementar unread_count para todos os participantes exceto o remetente
    await db.prepare(`
      UPDATE chat_thread_participants
      SET unread_count = unread_count + 1
      WHERE thread_id = ? AND user_id != ?
    `).run(threadId, userId);

    // Registrar evento "sent"
    await logEvent(tenantId, messageId, userId, "sent");

    // Nome do remetente para o response
    const sender = await db.prepare(
      "SELECT nome FROM users WHERE id = ?"
    ).get(userId) as { nome: string } | undefined;

    res.status(201).json({
      message: {
        id: messageId,
        threadId,
        senderId: userId,
        senderNome: sender?.nome ?? "",
        content: sanitizedContent,
        createdAt: now,
        deletedAt: null,
      },
    });
  } catch (err) {
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

    // Zerar unread_count e atualizar last_read_at
    await db.prepare(`
      UPDATE chat_thread_participants
      SET unread_count = 0, last_read_at = ?
      WHERE thread_id = ? AND user_id = ?
    `).run(now, threadId, userId);

    // Marcar todas as mensagens não lidas do thread como lidas (upsert)
    const unreadMessages = await db.prepare(`
      SELECT id FROM chat_messages
      WHERE thread_id = ? AND sender_id != ? AND deleted_at IS NULL
        AND id NOT IN (SELECT message_id FROM chat_message_receipts WHERE user_id = ?)
    `).all(threadId, userId, userId) as { id: string }[];

    for (const msg of unreadMessages) {
      await db.prepare(
        "INSERT OR IGNORE INTO chat_message_receipts (id, tenant_id, message_id, user_id, read_at) VALUES (?, ?, ?, ?, ?)"
      ).run(uuidv4(), tenantId, msg.id, userId, now);
      await logEvent(tenantId, msg.id, userId, "read");
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao marcar como lido.", code: "INTERNAL" });
  }
});

export default router;
