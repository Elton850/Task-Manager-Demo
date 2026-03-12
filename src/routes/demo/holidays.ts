/**
 * Demo: feriados simplificados.
 * Persistência em holidays.json.
 * Sem integração com APIs externas — apenas CRUD manual.
 */
import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { readJson, writeJson } from "../../demo/json-store";
import { requireAuth, requireRole } from "../../demo/middleware";

interface Holiday {
  id: string;
  tenant_id: string;
  date: string;   // YYYY-MM-DD
  name: string;
  type: string;   // "nacional" | "estadual" | "municipal" | "facultativo"
  created_at: string;
}

const FILE = "holidays.json";

function listAll(tenantId: string): Holiday[] {
  return readJson<Holiday[]>(FILE, []).filter((h) => h.tenant_id === tenantId);
}

const router = Router();

// GET /api/holidays?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/", requireAuth, (req: Request, res: Response): void => {
  const { from, to } = req.query as Record<string, string | undefined>;
  let items = listAll(req.tenantId!);
  if (from) items = items.filter((h) => h.date >= from);
  if (to) items = items.filter((h) => h.date <= to);
  res.json({ holidays: items });
});

// POST /api/holidays
router.post("/", requireAuth, requireRole("ADMIN"), (req: Request, res: Response): void => {
  const { date, name, type } = req.body as Record<string, string | undefined>;
  if (!date || !name?.trim()) {
    res.status(400).json({ error: "date e name são obrigatórios.", code: "MISSING_FIELDS" });
    return;
  }

  const all = readJson<Holiday[]>(FILE, []);
  const holiday: Holiday = {
    id: uuidv4(),
    tenant_id: req.tenantId!,
    date,
    name: name.trim(),
    type: type || "nacional",
    created_at: new Date().toISOString(),
  };
  writeJson(FILE, [...all, holiday]);
  res.status(201).json({ holiday });
});

// PUT /api/holidays/:id
router.put("/:id", requireAuth, requireRole("ADMIN"), (req: Request, res: Response): void => {
  const all = readJson<Holiday[]>(FILE, []);
  const idx = all.findIndex((h) => h.id === req.params.id && h.tenant_id === req.tenantId);
  if (idx === -1) {
    res.status(404).json({ error: "Feriado não encontrado.", code: "NOT_FOUND" });
    return;
  }
  const { date, name, type } = req.body as Record<string, string | undefined>;
  if (date) all[idx].date = date;
  if (name) all[idx].name = name.trim();
  if (type) all[idx].type = type;
  writeJson(FILE, all);
  res.json({ holiday: all[idx] });
});

// DELETE /api/holidays/:id
router.delete("/:id", requireAuth, requireRole("ADMIN"), (req: Request, res: Response): void => {
  const all = readJson<Holiday[]>(FILE, []);
  const next = all.filter((h) => !(h.id === req.params.id && h.tenant_id === req.tenantId));
  if (next.length === all.length) {
    res.status(404).json({ error: "Feriado não encontrado.", code: "NOT_FOUND" });
    return;
  }
  writeJson(FILE, next);
  res.json({ ok: true });
});

// POST /api/holidays/sync — demo: retorna ok sem chamar API externa
router.post("/sync", requireAuth, requireRole("ADMIN"), (req: Request, res: Response): void => {
  const year = Number(req.body?.year) || new Date().getFullYear();
  res.json({
    ok: true,
    year,
    provider: "demo",
    inserted: 0,
    updated: 0,
    demo_note: "Sincronização de feriados não disponível na versão demo.",
  });
});

export default router;
