/**
 * Rotas de feriados: listagem por intervalo, CRUD (ADMIN), sync (ADMIN).
 */

import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAuth, requireRole } from "../middleware/auth";
import { mustString, optStr, getClientErrorMessage } from "../utils";
import * as holidaysService from "../services/holidays";
import * as holidaySync from "../services/holiday-sync";

const router = Router();
router.use(requireAuth);

const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const HOLIDAY_TYPES = ["national", "state", "municipal", "company"] as const;

// GET /api/holidays?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const from = optStr(req.query.from);
    const to = optStr(req.query.to);
    if (!from || !to || !DATE_REGEX.test(from) || !DATE_REGEX.test(to)) {
      res.status(400).json({ error: "Parâmetros from e to (YYYY-MM-DD) são obrigatórios.", code: "VALIDATION" });
      return;
    }
    if (from > to) {
      res.status(400).json({ error: "from deve ser menor ou igual a to.", code: "VALIDATION" });
      return;
    }
    const list = await holidaysService.listByRange(tenantId, from, to);
    res.json({ holidays: list });
  } catch (err) {
    const msg = getClientErrorMessage(err, "Erro ao listar feriados.");
    res.status(500).json({ error: msg, code: "INTERNAL" });
  }
});

// POST /api/holidays — criar feriado manual (ADMIN)
router.post("/", requireRole("ADMIN"), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const user = req.user!;
    const body = req.body || {};
    const date = mustString(body.date, "Data");
    const name = mustString(body.name, "Nome");
    const typeRaw = optStr(body.type) || "company";
    if (!DATE_REGEX.test(date)) {
      res.status(400).json({ error: "Data inválida. Use YYYY-MM-DD.", code: "VALIDATION" });
      return;
    }
    if (name.length > 200) {
      res.status(400).json({ error: "Nome do feriado muito longo.", code: "VALIDATION" });
      return;
    }
    if (!HOLIDAY_TYPES.includes(typeRaw as typeof HOLIDAY_TYPES[number])) {
      res.status(400).json({ error: "Tipo inválido. Use: national, state, municipal, company.", code: "VALIDATION" });
      return;
    }
    const type = typeRaw as holidaysService.HolidayType;
    const id = uuidv4();
    const created = await holidaysService.create(tenantId, {
      id,
      date,
      name,
      type,
      createdBy: user.email,
      updatedBy: user.email,
    });
    res.status(201).json({ holiday: created });
  } catch (err) {
    const msg = getClientErrorMessage(err, "Erro ao criar feriado.");
    res.status(400).json({ error: msg, code: "VALIDATION" });
  }
});

// PUT /api/holidays/:id — editar feriado manual (ADMIN)
router.put("/:id", requireRole("ADMIN"), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const user = req.user!;
    const { id } = req.params;
    const existing = await holidaysService.getById(tenantId, id);
    if (!existing) {
      res.status(404).json({ error: "Feriado não encontrado.", code: "NOT_FOUND" });
      return;
    }
    if (existing.source !== "manual") {
      res.status(400).json({ error: "Apenas feriados manuais podem ser editados.", code: "VALIDATION" });
      return;
    }
    const body = req.body || {};
    const name = optStr(body.name);
    const typeRaw = optStr(body.type);
    const date = optStr(body.date);
    if (name !== undefined && name.length > 200) {
      res.status(400).json({ error: "Nome do feriado muito longo.", code: "VALIDATION" });
      return;
    }
    if (date !== undefined && date !== "" && !DATE_REGEX.test(date)) {
      res.status(400).json({ error: "Data inválida. Use YYYY-MM-DD.", code: "VALIDATION" });
      return;
    }
    if (typeRaw !== undefined && typeRaw !== "" && !HOLIDAY_TYPES.includes(typeRaw as typeof HOLIDAY_TYPES[number])) {
      res.status(400).json({ error: "Tipo inválido.", code: "VALIDATION" });
      return;
    }
    const updated = await holidaysService.update(tenantId, id, {
      name: name || undefined,
      type: typeRaw ? (typeRaw as holidaysService.HolidayType) : undefined,
      date: date || undefined,
      updatedBy: user.email,
    });
    res.json({ holiday: updated });
  } catch (err) {
    const msg = getClientErrorMessage(err, "Erro ao atualizar feriado.");
    res.status(400).json({ error: msg, code: "VALIDATION" });
  }
});

// DELETE /api/holidays/:id (ADMIN)
router.delete("/:id", requireRole("ADMIN"), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const ok = await holidaysService.remove(tenantId, id);
    if (!ok) {
      res.status(404).json({ error: "Feriado não encontrado.", code: "NOT_FOUND" });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    const msg = getClientErrorMessage(err, "Erro ao excluir feriado.");
    res.status(500).json({ error: msg, code: "INTERNAL" });
  }
});

// POST /api/holidays/sync — sincronizar feriados da API (ADMIN)
router.post("/sync", requireRole("ADMIN"), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const user = req.user!;
    const body = (req.body || {}) as { year?: number; provider?: string };
    const year = typeof body.year === "number" ? body.year : new Date().getFullYear();
    if (year < 1900 || year > 2199) {
      res.status(400).json({ error: "Ano inválido.", code: "VALIDATION" });
      return;
    }
    const provider = (body.provider === "nager" ? "nager" : "brasilapi") as "brasilapi" | "nager";
    const result = await holidaySync.syncYearForTenant(tenantId, year, user.email, provider);
    res.json({
      ok: true,
      year,
      provider,
      inserted: result.inserted,
      updated: result.updated,
    });
  } catch (err) {
    const msg = getClientErrorMessage(err, "Erro ao sincronizar feriados.");
    res.status(500).json({ error: msg, code: "INTERNAL" });
  }
});

export default router;
