/**
 * Demo: CRUD de tarefas sobre JSON store.
 * Upload de evidências desabilitado (retorna mensagem amigável).
 * Aceita tanto camelCase (frontend) quanto snake_case nos campos de entrada.
 */
import { Router, Request, Response } from "express";
import { tasks, users } from "../../demo/repository";
import { requireAuth } from "../../demo/middleware";
import { serializeTask } from "./serialize";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normaliza body recebido: aceita camelCase ou snake_case */
function normalizeBody(body: Record<string, unknown>) {
  return {
    competencia_ym: (body.competenciaYm || body.competencia_ym) as string | undefined,
    recorrencia: body.recorrencia as string | undefined,
    tipo: body.tipo as string | undefined,
    atividade: body.atividade as string | undefined,
    responsavel_email: (body.responsavelEmail || body.responsavel_email) as string | undefined,
    area: body.area as string | undefined,
    prazo: (body.prazo !== undefined ? body.prazo : undefined) as string | null | undefined,
    realizado: (body.realizado !== undefined ? body.realizado : undefined) as string | null | undefined,
    status: body.status as string | undefined,
    observacoes: (body.observacoes !== undefined ? body.observacoes : undefined) as string | null | undefined,
    parent_task_id: (body.parentTaskId || body.parent_task_id) as string | undefined,
  };
}

function validateNormalizedBody(b: ReturnType<typeof normalizeBody>): string | null {
  const required: (keyof typeof b)[] = ["competencia_ym", "recorrencia", "tipo", "atividade", "responsavel_email", "area"];
  for (const field of required) {
    if (!b[field] || typeof b[field] !== "string" || !(b[field] as string).trim()) {
      return `Campo obrigatório ausente: ${field}`;
    }
  }
  return null;
}

function resolveResponsavelNome(tenantId: string, email: string): string {
  const u = users.findByEmail(tenantId, email);
  return u?.nome ?? email;
}

// ─── Notificações ─────────────────────────────────────────────────────────────

// GET /api/tasks/notification-counts
router.get("/notification-counts", requireAuth, (req: Request, res: Response): void => {
  const tenantId = req.tenantId!;
  const all = tasks.list(tenantId).filter((t) => !t.parent_task_id);
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const done = ["Concluído", "Concluída", "Aprovado", "Aprovada"];
  const active = all.filter((t) => !done.includes(t.status));

  const overdue = active.filter((t) => t.prazo && t.prazo < today).length;
  const dueToday = active.filter((t) => t.prazo === today).length;
  const dueTomorrow = active.filter((t) => t.prazo === tomorrow).length;

  res.json({ overdue, dueToday, dueTomorrow });
});

// ─── Listagem ─────────────────────────────────────────────────────────────────

// GET /api/tasks
router.get("/", requireAuth, (req: Request, res: Response): void => {
  const tenantId = req.tenantId!;
  let list = tasks.list(tenantId);

  // Filtros opcionais — aceita tanto camelCase (frontend) quanto snake_case
  const q = req.query as Record<string, string | undefined>;
  const competencia_ym = q.competenciaYm || q.competencia_ym;
  const { status, area, tipo, recorrencia } = q;
  const responsavel_email = q.responsavel || q.responsavelEmail || q.responsavel_email;
  const search = q.search || q.q;

  if (competencia_ym) list = list.filter((t) => t.competencia_ym === competencia_ym);
  if (status) list = list.filter((t) => t.status === status);
  if (area) list = list.filter((t) => t.area === area);
  if (responsavel_email) list = list.filter((t) => t.responsavel_email === responsavel_email);
  if (tipo) list = list.filter((t) => t.tipo === tipo);
  if (recorrencia) list = list.filter((t) => t.recorrencia === recorrencia);
  if (search) {
    const lq = search.toLowerCase();
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

  res.json({ tasks: list.map(serializeTask), total: list.length });
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
  res.json({ task: serializeTask(task) });
});

// GET /api/tasks/:id/subtasks
router.get("/:id/subtasks", requireAuth, (req: Request, res: Response): void => {
  const tenantId = req.tenantId!;
  const parent = tasks.findById(req.params.id, tenantId);
  if (!parent) {
    res.status(404).json({ error: "Tarefa não encontrada.", code: "NOT_FOUND" });
    return;
  }
  const subs = tasks.subtasksOf(req.params.id, tenantId).map(serializeTask);
  res.json({ tasks: subs, subtasks: subs });
});

// ─── Criação ──────────────────────────────────────────────────────────────────

// POST /api/tasks
router.post("/", requireAuth, (req: Request, res: Response): void => {
  const tenantId = req.tenantId!;
  const body = normalizeBody(req.body as Record<string, unknown>);

  const validErr = validateNormalizedBody(body);
  if (validErr) {
    res.status(400).json({ error: validErr, code: "VALIDATION_ERROR" });
    return;
  }

  const email = body.responsavel_email!.trim().toLowerCase();
  const task = tasks.create({
    tenant_id: tenantId,
    competencia_ym: body.competencia_ym!.trim(),
    recorrencia: body.recorrencia!.trim(),
    tipo: body.tipo!.trim(),
    atividade: body.atividade!.trim(),
    responsavel_email: email,
    responsavel_nome: resolveResponsavelNome(tenantId, email),
    area: body.area!.trim(),
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

  res.status(201).json({ task: serializeTask(task) });
});

// POST /api/tasks/:id/subtasks
router.post("/:id/subtasks", requireAuth, (req: Request, res: Response): void => {
  const tenantId = req.tenantId!;
  const parent = tasks.findById(req.params.id, tenantId);
  if (!parent) {
    res.status(404).json({ error: "Tarefa pai não encontrada.", code: "NOT_FOUND" });
    return;
  }

  const body = normalizeBody(req.body as Record<string, unknown>);
  if (!body.atividade?.trim() || !body.responsavel_email?.trim()) {
    res.status(400).json({ error: "atividade e responsavelEmail são obrigatórios.", code: "VALIDATION_ERROR" });
    return;
  }

  const email = body.responsavel_email.trim().toLowerCase();
  const task = tasks.create({
    tenant_id: tenantId,
    competencia_ym: parent.competencia_ym,
    recorrencia: body.recorrencia?.trim() || parent.recorrencia,
    tipo: body.tipo?.trim() || parent.tipo,
    atividade: body.atividade.trim(),
    responsavel_email: email,
    responsavel_nome: resolveResponsavelNome(tenantId, email),
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

  res.status(201).json({ task: serializeTask(task) });
});

// ─── Atualização ──────────────────────────────────────────────────────────────

// PUT /api/tasks/:id
router.put("/:id", requireAuth, (req: Request, res: Response): void => {
  const tenantId = req.tenantId!;
  const body = normalizeBody(req.body as Record<string, unknown>);

  const patch: Record<string, unknown> = { updated_by: req.user!.email };
  if (body.competencia_ym) patch.competencia_ym = body.competencia_ym;
  if (body.recorrencia) patch.recorrencia = body.recorrencia;
  if (body.tipo) patch.tipo = body.tipo;
  if (body.atividade) patch.atividade = body.atividade;
  if (body.responsavel_email) {
    const email = body.responsavel_email.toLowerCase();
    patch.responsavel_email = email;
    patch.responsavel_nome = resolveResponsavelNome(tenantId, email);
  }
  if (body.area) patch.area = body.area;
  if (body.prazo !== undefined) patch.prazo = body.prazo ? String(body.prazo) : null;
  if (body.realizado !== undefined) patch.realizado = body.realizado ? String(body.realizado) : null;
  if (body.status) patch.status = body.status;
  if (body.observacoes !== undefined) patch.observacoes = body.observacoes ? String(body.observacoes) : null;

  const updated = tasks.update(req.params.id, tenantId, patch);
  if (!updated) {
    res.status(404).json({ error: "Tarefa não encontrada.", code: "NOT_FOUND" });
    return;
  }
  res.json({ task: serializeTask(updated) });
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
  res.json({ task: serializeTask(updated) });
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

// ─── Duplicação ───────────────────────────────────────────────────────────────

// POST /api/tasks/:id/duplicate
router.post("/:id/duplicate", requireAuth, (req: Request, res: Response): void => {
  const tenantId = req.tenantId!;
  const original = tasks.findById(req.params.id, tenantId);
  if (!original) {
    res.status(404).json({ error: "Tarefa não encontrada.", code: "NOT_FOUND" });
    return;
  }

  const body = req.body as Record<string, string | undefined>;
  const competencia_ym = body.competenciaYm || body.competencia_ym;
  const task = tasks.create({
    tenant_id: tenantId,
    competencia_ym: competencia_ym || original.competencia_ym,
    recorrencia: original.recorrencia,
    tipo: original.tipo,
    atividade: original.atividade,
    responsavel_email: original.responsavel_email,
    responsavel_nome: original.responsavel_nome,
    area: original.area,
    prazo: body.prazo || original.prazo,
    realizado: null,
    status: "Em Andamento",
    observacoes: original.observacoes,
    parent_task_id: null,
    justification_blocked: false,
    created_by: req.user!.email,
    updated_by: req.user!.email,
    deleted_at: null,
    deleted_by: null,
  });

  res.status(201).json({ task: serializeTask(task) });
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

// GET /api/tasks/stats/summary — estatísticas simplificadas
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
