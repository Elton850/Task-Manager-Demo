/**
 * Demo: CRUD de regras por área (recorrências e tipos permitidos).
 */
import { Router, Request, Response } from "express";
import { rules } from "../../demo/repository";
import { requireAuth, requireRole } from "../../demo/middleware";

const router = Router();

// GET /api/rules
router.get("/", requireAuth, (req: Request, res: Response): void => {
  res.json({ rules: rules.list(req.tenantId!) });
});

// GET /api/rules/by-area?area=... — alias usado pelo frontend (rulesApi.byArea)
router.get("/by-area", requireAuth, (req: Request, res: Response): void => {
  const area = (req.query.area as string | undefined) || "";
  if (!area) {
    res.status(400).json({ error: "area é obrigatório.", code: "MISSING_FIELDS" });
    return;
  }
  const rule = rules.findByArea(req.tenantId!, area) ?? null;
  res.json({ rule });
});

// PUT /api/rules — upsert sem área no path (rulesApi.save: PUT /rules com area no body)
router.put("/", requireAuth, requireRole("ADMIN", "LEADER"), (req: Request, res: Response): void => {
  const body = req.body as Record<string, unknown>;
  const area = body.area as string | undefined;
  if (!area) {
    res.status(400).json({ error: "area é obrigatório.", code: "MISSING_FIELDS" });
    return;
  }
  const patch: Partial<Parameters<typeof rules.upsert>[2]> = {};

  if (Array.isArray(body.customTipos)) patch.custom_tipos = body.customTipos as string[];
  if (Array.isArray(body.defaultTipos)) patch.default_tipos = body.defaultTipos as string[];
  if (Array.isArray(body.customRecorrencias)) patch.custom_recorrencias = body.customRecorrencias as string[];
  if (Array.isArray(body.defaultRecorrencias)) patch.default_recorrencias = body.defaultRecorrencias as string[];
  if (Array.isArray(body.allowedRecorrencias)) patch.allowed_recorrencias = body.allowedRecorrencias as string[];
  if (Array.isArray(body.allowedTipos)) patch.custom_tipos = body.allowedTipos as string[];
  // snake_case fallbacks
  if (Array.isArray(body.custom_tipos)) patch.custom_tipos = body.custom_tipos as string[];
  if (Array.isArray(body.default_tipos)) patch.default_tipos = body.default_tipos as string[];
  if (Array.isArray(body.custom_recorrencias)) patch.custom_recorrencias = body.custom_recorrencias as string[];
  if (Array.isArray(body.default_recorrencias)) patch.default_recorrencias = body.default_recorrencias as string[];
  if (Array.isArray(body.allowed_recorrencias)) patch.allowed_recorrencias = body.allowed_recorrencias as string[];

  const rule = rules.upsert(req.tenantId!, area, patch, req.user!.email);
  res.json({ rule });
});

// GET /api/rules/:area
router.get("/:area", requireAuth, (req: Request, res: Response): void => {
  const rule = rules.findByArea(req.tenantId!, req.params.area);
  if (!rule) {
    res.status(404).json({ error: "Regra não encontrada.", code: "NOT_FOUND" });
    return;
  }
  res.json({ rule });
});

// PUT /api/rules/:area — upsert (cria ou atualiza)
router.put("/:area", requireAuth, requireRole("ADMIN", "LEADER"), (req: Request, res: Response): void => {
  const body = req.body as Record<string, unknown>;
  const patch: Partial<Parameters<typeof rules.upsert>[2]> = {};

  if (Array.isArray(body.custom_tipos)) patch.custom_tipos = body.custom_tipos as string[];
  if (Array.isArray(body.default_tipos)) patch.default_tipos = body.default_tipos as string[];
  if (Array.isArray(body.custom_recorrencias)) patch.custom_recorrencias = body.custom_recorrencias as string[];
  if (Array.isArray(body.default_recorrencias)) patch.default_recorrencias = body.default_recorrencias as string[];
  if (Array.isArray(body.allowed_recorrencias)) patch.allowed_recorrencias = body.allowed_recorrencias as string[];

  const rule = rules.upsert(req.tenantId!, req.params.area, patch, req.user!.email);
  res.json({ rule });
});

export default router;
