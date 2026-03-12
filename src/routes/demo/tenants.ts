/**
 * Demo: rotas de tenant simplificadas.
 * Apenas GET /current é necessário para o frontend funcionar.
 */
import { Router, Request, Response } from "express";
import { requireAuth } from "../../demo/middleware";

const router = Router();

// GET /api/tenants/current — retorna tenant atual (usado em AdminPage e configurações)
router.get("/current", requireAuth, (req: Request, res: Response): void => {
  res.json({ tenant: req.tenant });
});

// PATCH /api/tenants/current — atualiza nome do tenant (demo: aceita mas não persiste)
router.patch("/current", requireAuth, (req: Request, res: Response): void => {
  res.json({ tenant: req.tenant });
});

export default router;
