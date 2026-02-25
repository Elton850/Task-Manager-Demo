import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db";
import { requireAuth } from "../middleware/auth";
import { nowIso } from "../utils";

const router = Router();
router.use(requireAuth);

const SYSTEM_TENANT_SLUG = "system";

function safeJsonParse<T>(str: string | null | undefined, fallback: T): unknown {
  if (str == null || str === "") return fallback;
  try {
    return JSON.parse(str) as unknown;
  } catch {
    return fallback;
  }
}

function isMissingColumnsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /custom_recorrencias|default_recorrencias|does not exist|column.*not exist/i.test(msg);
}

function isSystemAdmin(req: Request): boolean {
  return !!(req.user && req.tenant?.slug === SYSTEM_TENANT_SLUG && req.user.role === "ADMIN");
}

async function getTenantIdBySlug(slug: string): Promise<string | null> {
  const row = await db.prepare("SELECT id FROM tenants WHERE slug = ? AND active = 1").get(slug) as { id: string } | undefined;
  return row?.id ?? null;
}

interface RuleDbRow {
  id: string;
  tenant_id: string;
  area: string;
  allowed_recorrencias: string;
  allowed_tipos?: string | null;
  custom_tipos?: string | null;
  default_tipos?: string | null;
  custom_recorrencias?: string | null;
  default_recorrencias?: string | null;
  updated_at: string;
  updated_by: string;
}

function rowToRule(row: RuleDbRow) {
  const allowedTipos =
    row.allowed_tipos == null || row.allowed_tipos === ""
      ? undefined
      : safeJsonParse(row.allowed_tipos, []) as string[];
  const customTipos =
    row.custom_tipos == null || row.custom_tipos === ""
      ? undefined
      : (safeJsonParse(row.custom_tipos, []) as string[]);
  const defaultTipos =
    row.default_tipos == null || row.default_tipos === ""
      ? undefined
      : (safeJsonParse(row.default_tipos, []) as string[]);
  const customRecorrencias =
    row.custom_recorrencias == null || row.custom_recorrencias === ""
      ? undefined
      : (safeJsonParse(row.custom_recorrencias, []) as string[]);
  const defaultRecorrencias =
    row.default_recorrencias == null || row.default_recorrencias === ""
      ? undefined
      : (safeJsonParse(row.default_recorrencias, []) as string[]);
  return {
    id: row.id,
    tenantId: row.tenant_id,
    area: row.area,
    allowedRecorrencias: (safeJsonParse(row.allowed_recorrencias || "[]", []) as string[]),
    allowedTipos: allowedTipos ?? undefined,
    customTipos: customTipos ?? [],
    defaultTipos: defaultTipos ?? [],
    customRecorrencias: customRecorrencias ?? [],
    defaultRecorrencias: defaultRecorrencias ?? [],
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

// GET /api/rules/by-tenant/:tenantSlug — regras de uma empresa (só Admin Mestre)
router.get("/by-tenant/:tenantSlug", async (req: Request, res: Response): Promise<void> => {
  if (!isSystemAdmin(req)) {
    res.status(403).json({ error: "Apenas o Administrador Mestre pode ver regras de outra empresa.", code: "FORBIDDEN" });
    return;
  }
  try {
    const tenantId = await getTenantIdBySlug(req.params.tenantSlug);
    if (!tenantId) {
      res.status(404).json({ error: "Empresa não encontrada.", code: "NOT_FOUND" });
      return;
    }
    const rows = await db.prepare("SELECT * FROM rules WHERE tenant_id = ? ORDER BY area ASC").all(tenantId) as RuleDbRow[];
    res.json({ rules: rows.map(rowToRule) });
  } catch {
    res.status(500).json({ error: "Erro ao buscar regras.", code: "INTERNAL" });
  }
});

// PUT /api/rules/for-tenant — salvar regra de uma área para uma empresa (só Admin Mestre)
router.put("/for-tenant", async (req: Request, res: Response): Promise<void> => {
  if (!isSystemAdmin(req)) {
    res.status(403).json({ error: "Apenas o Administrador Mestre pode definir regras de outra empresa.", code: "FORBIDDEN" });
    return;
  }
  try {
    const { tenantSlug, area, allowedRecorrencias, allowedTipos, customTipos, defaultTipos, customRecorrencias, defaultRecorrencias } = req.body;
    if (!tenantSlug || !area) {
      res.status(400).json({ error: "tenantSlug e area são obrigatórios.", code: "MISSING_FIELDS" });
      return;
    }
    const tenantId = await getTenantIdBySlug(String(tenantSlug).trim().toLowerCase());
    if (!tenantId) {
      res.status(404).json({ error: "Empresa não encontrada.", code: "NOT_FOUND" });
      return;
    }
    if (!Array.isArray(allowedRecorrencias)) {
      res.status(400).json({ error: "allowedRecorrencias deve ser um array.", code: "VALIDATION" });
      return;
    }
    const existingRow = await db.prepare("SELECT * FROM rules WHERE tenant_id = ? AND area = ?")
      .get(tenantId, area) as RuleDbRow | undefined;
    const now = nowIso();
    const allowedJson = JSON.stringify(allowedRecorrencias);
    const allowedTiposJson =
      allowedTipos === undefined
        ? (existingRow?.allowed_tipos ?? null)
        : Array.isArray(allowedTipos)
          ? JSON.stringify(allowedTipos)
          : null;
    const customTiposJson =
      customTipos === undefined
        ? (existingRow?.custom_tipos ?? "[]")
        : Array.isArray(customTipos)
          ? JSON.stringify(customTipos)
          : "[]";
    const defaultTiposJson =
      defaultTipos === undefined
        ? (existingRow?.default_tipos ?? "[]")
        : Array.isArray(defaultTipos)
          ? JSON.stringify(defaultTipos)
          : "[]";
    const customRecorrenciasJson =
      customRecorrencias === undefined
        ? (existingRow?.custom_recorrencias ?? "[]")
        : Array.isArray(customRecorrencias)
          ? JSON.stringify(customRecorrencias)
          : "[]";
    const defaultRecorrenciasJson =
      defaultRecorrencias === undefined
        ? (existingRow?.default_recorrencias ?? "[]")
        : Array.isArray(defaultRecorrencias)
          ? JSON.stringify(defaultRecorrencias)
          : "[]";

    const runUpsert = (withRecorrenciasCols: boolean) => {
      if (existingRow) {
        if (withRecorrenciasCols) {
          return db.prepare(`
            UPDATE rules SET allowed_recorrencias = ?, allowed_tipos = ?, custom_tipos = ?, default_tipos = ?, custom_recorrencias = ?, default_recorrencias = ?, updated_at = ?, updated_by = ?
            WHERE tenant_id = ? AND area = ?
          `).run(allowedJson, allowedTiposJson, customTiposJson, defaultTiposJson, customRecorrenciasJson, defaultRecorrenciasJson, now, req.user!.email, tenantId, area);
        }
        return db.prepare(`
          UPDATE rules SET allowed_recorrencias = ?, allowed_tipos = ?, custom_tipos = ?, default_tipos = ?, updated_at = ?, updated_by = ?
          WHERE tenant_id = ? AND area = ?
        `).run(allowedJson, allowedTiposJson, customTiposJson, defaultTiposJson, now, req.user!.email, tenantId, area);
      }
      if (withRecorrenciasCols) {
        return db.prepare(`
          INSERT INTO rules (id, tenant_id, area, allowed_recorrencias, allowed_tipos, custom_tipos, default_tipos, custom_recorrencias, default_recorrencias, updated_at, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), tenantId, area, allowedJson, allowedTiposJson, customTiposJson, defaultTiposJson, customRecorrenciasJson, defaultRecorrenciasJson, now, req.user!.email);
      }
      return db.prepare(`
        INSERT INTO rules (id, tenant_id, area, allowed_recorrencias, allowed_tipos, custom_tipos, default_tipos, updated_at, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), tenantId, area, allowedJson, allowedTiposJson, customTiposJson, defaultTiposJson, now, req.user!.email);
    };

    try {
      await runUpsert(true);
    } catch (err) {
      if (isMissingColumnsError(err)) {
        await runUpsert(false);
      } else {
        throw err;
      }
    }

    const updated = await db.prepare("SELECT * FROM rules WHERE tenant_id = ? AND area = ?")
      .get(tenantId, area) as RuleDbRow | undefined;
    if (!updated) {
      res.status(500).json({ error: "Erro ao salvar regra.", code: "INTERNAL" });
      return;
    }
    res.json({ rule: rowToRule(updated) });
  } catch (err) {
    console.error("[rules] PUT /for-tenant:", err);
    res.status(500).json({ error: "Erro ao salvar regra.", code: "INTERNAL" });
  }
});

// GET /api/rules — rules for current user's area (or all areas for ADMIN)
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const tenantId = req.tenantId!;

    let rows: RuleDbRow[];

    if (user.role === "ADMIN") {
      rows = await db.prepare("SELECT * FROM rules WHERE tenant_id = ? ORDER BY area ASC").all(tenantId) as RuleDbRow[];
    } else {
      rows = await db.prepare("SELECT * FROM rules WHERE tenant_id = ? AND area = ?").all(tenantId, user.area) as RuleDbRow[];
    }

    res.json({ rules: rows.map(rowToRule) });
  } catch {
    res.status(500).json({ error: "Erro ao buscar regras.", code: "INTERNAL" });
  }
});

// GET /api/rules/by-area — get rules for a specific area
router.get("/by-area", async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const tenantId = req.tenantId!;
    const { area } = req.query;

    if (!area || typeof area !== "string") {
      res.status(400).json({ error: "Área é obrigatória.", code: "MISSING_AREA" });
      return;
    }

    // LEADER can only see their area
    if (user.role === "LEADER" && area !== user.area) {
      res.status(403).json({ error: "Sem permissão para ver regras desta área.", code: "FORBIDDEN" });
      return;
    }

    const row = await db.prepare("SELECT * FROM rules WHERE tenant_id = ? AND area = ?")
      .get(tenantId, area) as RuleDbRow | undefined;

    res.json({ rule: row ? rowToRule(row) : null });
  } catch {
    res.status(500).json({ error: "Erro ao buscar regra.", code: "INTERNAL" });
  }
});

// PUT /api/rules — upsert rules for an area (LEADER manages own area, ADMIN manages all)
router.put("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const tenantId = req.tenantId!;
    const { area, allowedRecorrencias, allowedTipos, customTipos, defaultTipos, customRecorrencias, defaultRecorrencias } = req.body;

    if (user.role === "USER") {
      res.status(403).json({ error: "Sem permissão.", code: "FORBIDDEN" });
      return;
    }

    if (!area) {
      res.status(400).json({ error: "Área é obrigatória.", code: "MISSING_AREA" });
      return;
    }

    // LEADER can only manage their area
    if (user.role === "LEADER" && area !== user.area) {
      res.status(403).json({ error: "LEADER só pode gerenciar regras da sua própria área.", code: "FORBIDDEN" });
      return;
    }

    if (!Array.isArray(allowedRecorrencias)) {
      res.status(400).json({ error: "allowedRecorrencias deve ser um array.", code: "VALIDATION" });
      return;
    }

    const existing = await db.prepare("SELECT * FROM rules WHERE tenant_id = ? AND area = ?")
      .get(tenantId, area) as RuleDbRow | undefined;

    const now = nowIso();
    const allowedJson = JSON.stringify(allowedRecorrencias);
    const allowedTiposJson =
      allowedTipos === undefined
        ? (existing?.allowed_tipos ?? null)
        : Array.isArray(allowedTipos)
          ? JSON.stringify(allowedTipos)
          : null;
    const customTiposJson =
      customTipos === undefined
        ? (existing?.custom_tipos ?? "[]")
        : Array.isArray(customTipos)
          ? JSON.stringify(customTipos)
          : "[]";
    const defaultTiposJson =
      defaultTipos === undefined
        ? (existing?.default_tipos ?? "[]")
        : Array.isArray(defaultTipos)
          ? JSON.stringify(defaultTipos)
          : "[]";
    const customRecorrenciasJson =
      customRecorrencias === undefined
        ? (existing?.custom_recorrencias ?? "[]")
        : Array.isArray(customRecorrencias)
          ? JSON.stringify(customRecorrencias)
          : "[]";
    const defaultRecorrenciasJson =
      defaultRecorrencias === undefined
        ? (existing?.default_recorrencias ?? "[]")
        : Array.isArray(defaultRecorrencias)
          ? JSON.stringify(defaultRecorrencias)
          : "[]";

    const runUpsert = (withRecorrenciasCols: boolean) => {
      if (existing) {
        if (withRecorrenciasCols) {
          return db.prepare(`
            UPDATE rules SET allowed_recorrencias = ?, allowed_tipos = ?, custom_tipos = ?, default_tipos = ?, custom_recorrencias = ?, default_recorrencias = ?, updated_at = ?, updated_by = ?
            WHERE tenant_id = ? AND area = ?
          `).run(allowedJson, allowedTiposJson, customTiposJson, defaultTiposJson, customRecorrenciasJson, defaultRecorrenciasJson, now, user.email, tenantId, area);
        }
        return db.prepare(`
          UPDATE rules SET allowed_recorrencias = ?, allowed_tipos = ?, custom_tipos = ?, default_tipos = ?, updated_at = ?, updated_by = ?
          WHERE tenant_id = ? AND area = ?
        `).run(allowedJson, allowedTiposJson, customTiposJson, defaultTiposJson, now, user.email, tenantId, area);
      }
      if (withRecorrenciasCols) {
        return db.prepare(`
          INSERT INTO rules (id, tenant_id, area, allowed_recorrencias, allowed_tipos, custom_tipos, default_tipos, custom_recorrencias, default_recorrencias, updated_at, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), tenantId, area, allowedJson, allowedTiposJson, customTiposJson, defaultTiposJson, customRecorrenciasJson, defaultRecorrenciasJson, now, user.email);
      }
      return db.prepare(`
        INSERT INTO rules (id, tenant_id, area, allowed_recorrencias, allowed_tipos, custom_tipos, default_tipos, updated_at, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), tenantId, area, allowedJson, allowedTiposJson, customTiposJson, defaultTiposJson, now, user.email);
    };

    try {
      await runUpsert(true);
    } catch (err) {
      if (isMissingColumnsError(err)) {
        await runUpsert(false);
      } else {
        throw err;
      }
    }

    const updated = await db.prepare("SELECT * FROM rules WHERE tenant_id = ? AND area = ?")
      .get(tenantId, area) as RuleDbRow | undefined;
    if (!updated) {
      res.status(500).json({ error: "Erro ao salvar regra.", code: "INTERNAL" });
      return;
    }
    res.json({ rule: rowToRule(updated) });
  } catch (err) {
    console.error("[rules] PUT /:", err);
    res.status(500).json({ error: "Erro ao salvar regra.", code: "INTERNAL" });
  }
});

export default router;
