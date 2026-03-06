import { Router, Request, Response } from "express";
import db from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const SYSTEM_TENANT_SLUG = "system";

// ─── Cache em memória para chat-metrics (TTL 30s) ─────────────────────────────
interface ChatMetricsCache {
  data: ChatMetricsPayload;
  expiresAt: number;
}
interface ChatMetricsPayload {
  status: "healthy" | "warning" | "critical";
  windowMinutes: number;
  messages: { sent: number; readEvents: number };
  threads: { total: number; direct: number; subtask: number };
  unread: { total: number };
  topTenants: { tenantSlug: string; messageCount: number }[];
  cachedAt: string;
}
let chatMetricsCache: ChatMetricsCache | null = null;

function isSystemAdmin(req: Request): boolean {
  return !!(req.user && req.tenant?.slug === SYSTEM_TENANT_SLUG && req.user.role === "ADMIN");
}

/** GET /api/system/stats — visão geral (apenas admin do sistema) */
router.get("/stats", async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isSystemAdmin(req)) {
      res.status(403).json({ error: "Acesso apenas para administrador do sistema.", code: "FORBIDDEN" });
      return;
    }
    const tenantsCount = await db.prepare(
      "SELECT COUNT(*) as c FROM tenants WHERE slug != ? AND active = 1"
    ).get(SYSTEM_TENANT_SLUG) as { c: number };
    const usersCount = await db.prepare(
      "SELECT COUNT(*) as c FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE t.slug != ? AND u.tenant_id IS NOT NULL"
    ).get(SYSTEM_TENANT_SLUG) as { c: number };
    const tasksCount = await db.prepare(
      "SELECT COUNT(*) as c FROM tasks WHERE deleted_at IS NULL"
    ).get() as { c: number };
    const recentLogins = await db.prepare(`
      SELECT le.logged_at, le.tenant_id, le.user_id,
             t.slug as tenant_slug, t.name as tenant_name,
             u.email as user_email, u.nome as user_nome
      FROM login_events le
      JOIN tenants t ON t.id = le.tenant_id
      JOIN users u ON u.id = le.user_id
      WHERE t.slug != ?
      ORDER BY le.logged_at DESC
      LIMIT 30
    `).all(SYSTEM_TENANT_SLUG) as {
      logged_at: string;
      tenant_id: string;
      user_id: string;
      tenant_slug: string;
      tenant_name: string;
      user_email: string;
      user_nome: string;
    }[];
    res.json({
      tenantsCount: tenantsCount?.c ?? 0,
      usersCount: usersCount?.c ?? 0,
      tasksCount: tasksCount?.c ?? 0,
      recentLogins: recentLogins.map(r => ({
        loggedAt: r.logged_at,
        tenantSlug: r.tenant_slug,
        tenantName: r.tenant_name,
        userEmail: r.user_email,
        userName: r.user_nome,
      })),
    });
  } catch {
    res.status(500).json({ error: "Erro ao buscar estatísticas.", code: "INTERNAL" });
  }
});

/** GET /api/system/login-logs — log de acessos (apenas admin do sistema) */
router.get("/login-logs", async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isSystemAdmin(req)) {
      res.status(403).json({ error: "Acesso apenas para administrador do sistema.", code: "FORBIDDEN" });
      return;
    }
    const fromYm = (req.query.from as string) || "";
    const toYm = (req.query.to as string) || "";
    const tenantSlug = (req.query.tenant as string) || "";
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || "100"), 10) || 100, 10), 500);

    let where = "t.slug != ?";
    const params: (string | number)[] = [SYSTEM_TENANT_SLUG];
    if (tenantSlug) {
      where += " AND t.slug = ?";
      params.push(tenantSlug);
    }
    if (fromYm) {
      where += " AND le.logged_at >= ?";
      params.push(`${fromYm}-01T00:00:00.000Z`);
    }
    if (toYm) {
      const [y, m] = toYm.split("-").map(Number);
      const lastDay = new Date(Date.UTC(y, m, 0));
      const toDate = `${toYm}-${String(lastDay.getUTCDate()).padStart(2, "0")}T23:59:59.999Z`;
      where += " AND le.logged_at <= ?";
      params.push(toDate);
    }
    params.push(limit);

    const rows = await db.prepare(`
      SELECT le.logged_at, le.tenant_id, le.user_id,
             t.slug as tenant_slug, t.name as tenant_name,
             u.email as user_email, u.nome as user_nome
      FROM login_events le
      JOIN tenants t ON t.id = le.tenant_id
      JOIN users u ON u.id = le.user_id
      WHERE ${where}
      ORDER BY le.logged_at DESC
      LIMIT ?
    `).all(...params) as {
      logged_at: string;
      tenant_slug: string;
      tenant_name: string;
      user_email: string;
      user_nome: string;
    }[];

    res.json({
      items: rows.map(r => ({
        loggedAt: r.logged_at,
        tenantSlug: r.tenant_slug,
        tenantName: r.tenant_name,
        userEmail: r.user_email,
        userName: r.user_nome,
      })),
    });
  } catch {
    res.status(500).json({ error: "Erro ao buscar logs de acesso.", code: "INTERNAL" });
  }
});

/** GET /api/system/chat-metrics — métricas agregadas de chat (apenas admin do sistema) */
router.get("/chat-metrics", async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isSystemAdmin(req)) {
      res.status(403).json({ error: "Acesso apenas para administrador do sistema.", code: "FORBIDDEN" });
      return;
    }

    // Servir do cache se ainda válido
    const now = Date.now();
    if (chatMetricsCache && chatMetricsCache.expiresAt > now) {
      res.json(chatMetricsCache.data);
      return;
    }

    const windowMinutes = Math.min(
      Math.max(parseInt(String(req.query.window || "60"), 10) || 60, 5),
      1440
    );
    const windowStart = new Date(now - windowMinutes * 60 * 1000).toISOString();

    // Mensagens enviadas na janela
    const sentRow = await db
      .prepare("SELECT COUNT(*) as c FROM chat_messages WHERE created_at >= ?")
      .get(windowStart) as { c: number };

    // Eventos de leitura na janela
    const readRow = await db
      .prepare("SELECT COUNT(*) as c FROM chat_message_events WHERE event_type = 'read' AND event_at >= ?")
      .get(windowStart) as { c: number };

    // Threads por tipo (totais)
    const threadRows = await db
      .prepare("SELECT type, COUNT(*) as c FROM chat_threads GROUP BY type")
      .all() as { type: string; c: number }[];
    const threadByType = Object.fromEntries(threadRows.map(r => [r.type, r.c]));

    // Total de não lidas (global)
    const unreadRow = await db
      .prepare("SELECT COALESCE(SUM(unread_count), 0) as total FROM chat_thread_participants")
      .get() as { total: number };

    // Top 5 tenants por mensagens na janela
    const topRows = await db
      .prepare(`
        SELECT t.slug, COUNT(m.id) as msg_count
        FROM chat_messages m
        JOIN tenants t ON t.id = m.tenant_id
        WHERE m.created_at >= ?
        GROUP BY m.tenant_id
        ORDER BY msg_count DESC
        LIMIT 5
      `)
      .all(windowStart) as { slug: string; msg_count: number }[];

    const unreadTotal = unreadRow?.total ?? 0;
    const status: ChatMetricsPayload["status"] =
      unreadTotal > 500 ? "warning" : "healthy";

    const payload: ChatMetricsPayload = {
      status,
      windowMinutes,
      messages: {
        sent: sentRow?.c ?? 0,
        readEvents: readRow?.c ?? 0,
      },
      threads: {
        total: threadRows.reduce((acc, r) => acc + r.c, 0),
        direct: threadByType["direct"] ?? 0,
        subtask: threadByType["subtask"] ?? 0,
      },
      unread: { total: unreadTotal },
      topTenants: topRows.map(r => ({ tenantSlug: r.slug, messageCount: r.msg_count })),
      cachedAt: new Date(now).toISOString(),
    };

    chatMetricsCache = { data: payload, expiresAt: now + 30_000 };
    res.json(payload);
  } catch (err) {
    console.error("[system] chat-metrics error:", err);
    res.status(500).json({ error: "Erro ao buscar métricas de chat.", code: "INTERNAL" });
  }
});

export default router;
