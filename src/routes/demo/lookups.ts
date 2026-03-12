/**
 * Demo: CRUD de lookups (áreas, recorrências, tipos).
 */
import { Router, Request, Response } from "express";
import { lookups } from "../../demo/repository";
import { requireAuth, requireRole } from "../../demo/middleware";

const router = Router();

// GET /api/lookups — lista todos agrupados por categoria
router.get("/", requireAuth, (req: Request, res: Response): void => {
  const all = lookups.list(req.tenantId!);

  const grouped: Record<string, string[]> = {};
  for (const l of all.sort((a, b) => a.order_index - b.order_index)) {
    if (!grouped[l.category]) grouped[l.category] = [];
    grouped[l.category].push(l.value);
  }

  res.json({ lookups: all, grouped });
});

// GET /api/lookups/:category
router.get("/:category", requireAuth, (req: Request, res: Response): void => {
  const items = lookups.byCategory(
    req.tenantId!,
    req.params.category.toUpperCase()
  );
  res.json({ lookups: items, values: items.map((l) => l.value) });
});

// POST /api/lookups — cria novo lookup
router.post("/", requireAuth, requireRole("ADMIN", "LEADER"), (req: Request, res: Response): void => {
  const { category, value } = req.body as Record<string, string | undefined>;

  if (!category || !value) {
    res.status(400).json({ error: "category e value são obrigatórios.", code: "MISSING_FIELDS" });
    return;
  }

  const existing = lookups
    .byCategory(req.tenantId!, category.toUpperCase())
    .find((l) => l.value.toLowerCase() === value.trim().toLowerCase());

  if (existing) {
    res.status(409).json({ error: "Valor já existe nesta categoria.", code: "DUPLICATE" });
    return;
  }

  const lookup = lookups.create(req.tenantId!, category.toUpperCase(), value.trim());
  res.status(201).json({ lookup });
});

// DELETE /api/lookups/:id
router.delete("/:id", requireAuth, requireRole("ADMIN"), (req: Request, res: Response): void => {
  const ok = lookups.delete(req.params.id, req.tenantId!);
  if (!ok) {
    res.status(404).json({ error: "Lookup não encontrado.", code: "NOT_FOUND" });
    return;
  }
  res.json({ ok: true });
});

export default router;
