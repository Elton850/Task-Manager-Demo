/**
 * Demo: CRUD de tarefas sobre JSON store.
 * Upload de evidências desabilitado (retorna mensagem amigável).
 */
import { Router, Request, Response } from "express";
import { tasks, users, lookups } from "../../demo/repository";
import { requireAuth } from "../../demo/middleware";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validateTaskBody(body: Record<string, unknown>): string | null {
  const required = ["competencia_ym", "recorrencia", "tipo", "atividade", "responsavel_email", "area"];
  for (const field of required) {
    if (!body[field] || typeof body[field] !== "string" || !(body[field] as string).trim()) {
      return `Campo obrigatório ausente: ${field}`;
    }
  }
  return null;
}

function resolveResponsavelNome(tenantId: string, email: string): string {
  const u = users.findByEmail(tenantId, email);
  return u?.nome ?? email;
}

// ─── Listagem ─────────────────────────────────────────────────────────────────

// GET /api/tasks
router.get("/", requireAuth, (req: Request, res: Response): void => {
  const tenantId = req.tenantId!;
  let list = tasks.list(tenantId);

  // Filtros opcionais
  const { competencia_ym, status, area, responsavel_email, tipo, recorrencia, q } = req.query as Record<string, string | undefined>;

  if (competencia_ym) list = list.filter((t) => t.competencia_ym === competencia_ym);
  if (status) list = list.filter((t) => t.status === status);
  if (area) list = list.filter((t) => t.area === area);
  if (responsavel_email) list = list.filter((t) => t.responsavel_email === responsavel_email);
  if (tipo) list = list.filter((t) => t.tipo === tipo);
  if (recorrencia) list = list.filter((t) => t.recorrencia === recorrencia);
  if (q) {
    const lq = q.toLowerCase();
    list = list.filter(
      (t) =>
        t.atividade.toLowerCase().includes(lq) ||
        t.responsavel_nome.toLowerCase().includes(lq) ||
        t.area.toLowerCase().includes(lq)
    );
  }

  // Apenas tarefas raiz (sem parent) a menos que seja solicitado subtarefas
  const includeSubtasks = req.query["include_subtasks"] === "true";
  if (!includeSubtasks) {
    list = list.filter((t) => !t.parent_task_id);
  }

  res.json({ tasks: list, total: list.length });
});

// GET /api/tasks/competencias — lista de competências disponíveis
router.get("/competencias", requireAuth, (req: Request, res: Response): void => {
  const tenantId = req.tenantId!;
  const all = tasks.list(tenantId);
  const yms = [...new Set(all.map((t) => t.competencia_ym))].sort().reverse();
  res.json({ competencias: yms });
});

// GET /api/tasks/:id
router.get("/:id", requireAuth, (req: Request, res: Response): void => {
  const task = tasks.findById(req.params.id, req.tenantId!);
  if (!task) {
    res.status(404).json({ error: "Tarefa não encontrada.", code: "NOT_FOUND" });
    return;
  }
  res.json({ task });
});

// GET /api/tasks/:id/subtasks
router.get("/:id/subtasks", requireAuth, (req: Request, res: Response): void => {
  const tenantId = req.tenantId!;
  const parent = tasks.findById(req.params.id, tenantId);
  if (!parent) {
    res.status(404).json({ error: "Tarefa não encontrada.", code: "NOT_FOUND" });
    return;
  }
  const subs = tasks.subtasksOf(req.params.id, tenantId);
  res.json({ subtasks: subs });
});

// ─── Criação ──────────────────────────────────────────────────────────────────

// POST /api/tasks
router.post("/", requireAuth, (req: Request, res: Response): void => {
  const tenantId = req.tenantId!;
  const body = req.body as Record<string, unknown>;

  const validErr = validateTaskBody(body);
  if (validErr) {
    res.status(400).json({ error: validErr, code: "VALIDATION_ERROR" });
    return;
  }

  const task = tasks.create({
    tenant_id: tenantId,
    competencia_ym: String(body.competencia_ym).trim(),
    recorrencia: String(body.recorrencia).trim(),
    tipo: String(body.tipo).trim(),
    atividade: String(body.atividade).trim(),
    responsavel_email: String(body.responsavel_email).trim().toLowerCase(),
    responsavel_nome: resolveResponsavelNome(tenantId, String(body.responsavel_email).trim().toLowerCase()),
    area: String(body.area).trim(),
    prazo: body.prazo ? String(body.prazo).trim() : null,
    realizado: body.realizado ? String(body.realizado).trim() : null,
    status: String(body.status || "Em Andamento").trim(),
    observacoes: body.observacoes ? String(body.observacoes).trim() : null,
    parent_task_id: body.parent_task_id ? String(body.parent_task_id).trim() : null,
    justification_blocked: false,
    created_by: req.user!.email,
    updated_by: req.user!.email,
    deleted_at: null,
    deleted_by: null,
  });

  res.status(201).json({ task });
});

// POST /api/tasks/:id/subtasks
router.post("/:id/subtasks", requireAuth, (req: Request, res: Response): void => {
  const tenantId = req.tenantId!;
  const parent = tasks.findById(req.params.id, tenantId);
  if (!parent) {
    res.status(404).json({ error: "Tarefa pai não encontrada.", code: "NOT_FOUND" });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const validErr = validateTaskBody(body);
  if (validErr) {
    res.status(400).json({ error: validErr, code: "VALIDATION_ERROR" });
    return;
  }

  const task = tasks.create({
    tenant_id: tenantId,
    competencia_ym: parent.competencia_ym,
    recorrencia: String(body.recorrencia || parent.recorrencia).trim(),
    tipo: String(body.tipo || parent.tipo).trim(),
    atividade: String(body.atividade).trim(),
    responsavel_email: String(body.responsavel_email).trim().toLowerCase(),
    responsavel_nome: resolveResponsavelNome(tenantId, String(body.responsavel_email).trim().toLowerCase()),
    area: parent.area,
    prazo: body.prazo ? String(body.prazo).trim() : null,
    realizado: null,
    status: "Em Andamento",
    observacoes: body.observacoes ? String(body.observacoes).trim() : null,
    parent_task_id: parent.id,
    justification_blocked: false,
    created_by: req.user!.email,
    updated_by: req.user!.email,
    deleted_at: null,
    deleted_by: null,
  });

  res.status(201).json({ task });
});

// ─── Atualização ──────────────────────────────────────────────────────────────

// PUT /api/tasks/:id
router.put("/:id", requireAuth, (req: Request, res: Response): void => {
  const tenantId = req.tenantId!;
  const body = req.body as Record<string, unknown>;

  const updated = tasks.update(req.params.id, tenantId, {
    ...(body.competencia_ym && { competencia_ym: String(body.competencia_ym) }),
    ...(body.recorrencia && { recorrencia: String(body.recorrencia) }),
    ...(body.tipo && { tipo: String(body.tipo) }),
    ...(body.atividade && { atividade: String(body.atividade) }),
    ...(body.responsavel_email && {
      responsavel_email: String(body.responsavel_email).toLowerCase(),
      responsavel_nome: resolveResponsavelNome(tenantId, String(body.responsavel_email).toLowerCase()),
    }),
    ...(body.area && { area: String(body.area) }),
    ...(body.prazo !== undefined && { prazo: body.prazo ? String(body.prazo) : null }),
    ...(body.realizado !== undefined && { realizado: body.realizado ? String(body.realizado) : null }),
    ...(body.status && { status: String(body.status) }),
    ...(body.observacoes !== undefined && { observacoes: body.observacoes ? String(body.observacoes) : null }),
    updated_by: req.user!.email,
  });

  if (!updated) {
    res.status(404).json({ error: "Tarefa não encontrada.", code: "NOT_FOUND" });
    return;
  }
  res.json({ task: updated });
});

// PATCH /api/tasks/:id/status
router.patch("/:id/status", requireAuth, (req: Request, res: Response): void => {
  const { status, realizado } = req.body as Record<string, string | undefined>;
  if (!status) {
    res.status(400).json({ error: "status é obrigatório.", code: "MISSING_FIELDS" });
    return;
  }

  const updated = tasks.update(req.params.id, req.tenantId!, {
    status,
    realizado: realizado ?? null,
    updated_by: req.user!.email,
  });

  if (!updated) {
    res.status(404).json({ error: "Tarefa não encontrada.", code: "NOT_FOUND" });
    return;
  }
  res.json({ task: updated });
});

// ─── Deleção ──────────────────────────────────────────────────────────────────

// DELETE /api/tasks/:id
router.delete("/:id", requireAuth, (req: Request, res: Response): void => {
  const ok = tasks.softDelete(req.params.id, req.tenantId!, req.user!.email);
  if (!ok) {
    res.status(404).json({ error: "Tarefa não encontrada.", code: "NOT_FOUND" });
    return;
  }
  res.json({ ok: true });
});

// ─── Evidências (desabilitado na demo) ───────────────────────────────────────

router.get("/:id/evidences", requireAuth, (_req: Request, res: Response): void => {
  res.json({ evidences: [], demo_note: "Upload de evidências não disponível na versão demo." });
});

router.post("/:id/evidences", requireAuth, (_req: Request, res: Response): void => {
  res.status(503).json({
    error: "Upload de evidências não disponível na versão demo.",
    code: "DEMO_UNAVAILABLE",
  });
});

// GET /api/tasks — estatísticas/performance (simplificado)
router.get("/stats/summary", requireAuth, (req: Request, res: Response): void => {
  const tenantId = req.tenantId!;
  const all = tasks.list(tenantId);

  const byStatus: Record<string, number> = {};
  const byArea: Record<string, number> = {};
  for (const t of all) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    byArea[t.area] = (byArea[t.area] || 0) + 1;
  }

  res.json({ total: all.length, byStatus, byArea });
});

export default router;
