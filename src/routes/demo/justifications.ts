/**
 * Demo: justificativas simplificadas (sem upload de evidências).
 * Persistência em justifications.json.
 */
import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { readJson, writeJson } from "../../demo/json-store";
import { tasks } from "../../demo/repository";
import { requireAuth, requireRole } from "../../demo/middleware";

interface Justification {
  id: string;
  tenant_id: string;
  task_id: string;
  description: string;
  status: "pending" | "approved" | "refused";
  created_at: string;
  created_by: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_comment: string | null;
}

const FILE = "justifications.json";

function listAll(tenantId: string): Justification[] {
  return readJson<Justification[]>(FILE, []).filter((j) => j.tenant_id === tenantId);
}

function findById(id: string, tenantId: string): Justification | undefined {
  return readJson<Justification[]>(FILE, []).find(
    (j) => j.id === id && j.tenant_id === tenantId
  );
}

function save(j: Justification): void {
  const all = readJson<Justification[]>(FILE, []);
  const idx = all.findIndex((x) => x.id === j.id);
  if (idx === -1) {
    writeJson(FILE, [...all, j]);
  } else {
    all[idx] = j;
    writeJson(FILE, all);
  }
}

const router = Router();

// GET /api/justifications
router.get("/", requireAuth, (req: Request, res: Response): void => {
  const { task_id, status } = req.query as Record<string, string | undefined>;
  let items = listAll(req.tenantId!);
  if (task_id) items = items.filter((j) => j.task_id === task_id);
  if (status) items = items.filter((j) => j.status === status);
  res.json({ justifications: items });
});

// GET /api/justifications/mine — justificativas criadas pelo usuário logado
router.get("/mine", requireAuth, (req: Request, res: Response): void => {
  const tenantId = req.tenantId!;
  const userEmail = req.user!.email;
  const { competenciaYm } = req.query as Record<string, string | undefined>;

  let items = listAll(tenantId).filter((j) => j.created_by === userEmail);

  const allTasks = tasks.list(tenantId);
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));

  if (competenciaYm) {
    items = items.filter((j) => {
      const t = taskMap.get(j.task_id);
      return t && t.competencia_ym === competenciaYm;
    });
  }

  const result = items.map((j) => {
    const t = taskMap.get(j.task_id);
    return {
      id: j.id,
      taskId: j.task_id,
      description: j.description,
      status: j.status,
      createdAt: j.created_at,
      reviewedAt: j.reviewed_at,
      reviewedBy: j.reviewed_by,
      reviewComment: j.review_comment,
      task: t
        ? {
            atividade: t.atividade,
            responsavelEmail: t.responsavel_email,
            responsavelNome: t.responsavel_nome,
            prazo: t.prazo,
            realizado: t.realizado,
            area: t.area,
          }
        : null,
    };
  });

  res.json({ items: result });
});

// GET /api/justifications/pending — aguardando revisão (ADMIN/LEADER)
router.get("/pending", requireAuth, requireRole("ADMIN", "LEADER"), (req: Request, res: Response): void => {
  const tenantId = req.tenantId!;
  const items = listAll(tenantId).filter((j) => j.status === "pending");
  const allTasks = tasks.list(tenantId);
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));

  const result = items.map((j) => {
    const t = taskMap.get(j.task_id);
    return {
      id: j.id,
      taskId: j.task_id,
      description: j.description,
      status: j.status,
      createdAt: j.created_at,
      createdBy: j.created_by,
      task: t
        ? {
            atividade: t.atividade,
            responsavelEmail: t.responsavel_email,
            responsavelNome: t.responsavel_nome,
            prazo: t.prazo,
            realizado: t.realizado,
            area: t.area,
          }
        : null,
    };
  });

  res.json({ items: result });
});

// GET /api/justifications/approved — aprovadas (ADMIN/LEADER)
router.get("/approved", requireAuth, requireRole("ADMIN", "LEADER"), (req: Request, res: Response): void => {
  const tenantId = req.tenantId!;
  const items = listAll(tenantId).filter((j) => j.status === "approved");
  const allTasks = tasks.list(tenantId);
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));

  const result = items.map((j) => {
    const t = taskMap.get(j.task_id);
    return {
      id: j.id,
      taskId: j.task_id,
      description: j.description,
      status: j.status,
      createdAt: j.created_at,
      createdBy: j.created_by,
      reviewedAt: j.reviewed_at,
      reviewedBy: j.reviewed_by,
      task: t
        ? {
            atividade: t.atividade,
            responsavelEmail: t.responsavel_email,
            responsavelNome: t.responsavel_nome,
            prazo: t.prazo,
            realizado: t.realizado,
            area: t.area,
          }
        : null,
    };
  });

  res.json({ items: result });
});

// GET /api/justifications/blocked — tarefas bloqueadas aguardando justificativa
router.get("/blocked", requireAuth, requireRole("ADMIN", "LEADER"), (req: Request, res: Response): void => {
  const tenantId = req.tenantId!;
  const blocked = tasks.list(tenantId).filter((t) => t.justification_blocked);

  const result = blocked.map((t) => ({
    taskId: t.id,
    atividade: t.atividade,
    responsavelNome: t.responsavel_nome,
    area: t.area,
    blockedAt: t.updated_at,
    blockedBy: t.updated_by,
  }));

  res.json({ items: result });
});

// GET /api/justifications/:id
router.get("/:id", requireAuth, (req: Request, res: Response): void => {
  const j = findById(req.params.id, req.tenantId!);
  if (!j) {
    res.status(404).json({ error: "Justificativa não encontrada.", code: "NOT_FOUND" });
    return;
  }
  res.json({ justification: j });
});

// POST /api/justifications — aceita taskId (camelCase) ou task_id (snake_case)
router.post("/", requireAuth, (req: Request, res: Response): void => {
  const body = req.body as Record<string, string | undefined>;
  const task_id = body.taskId || body.task_id;
  const description = body.description;

  if (!task_id || !description?.trim()) {
    res.status(400).json({ error: "taskId e description são obrigatórios.", code: "MISSING_FIELDS" });
    return;
  }

  const task = tasks.findById(task_id, req.tenantId!);
  if (!task) {
    res.status(404).json({ error: "Tarefa não encontrada.", code: "NOT_FOUND" });
    return;
  }

  const j: Justification = {
    id: uuidv4(),
    tenant_id: req.tenantId!,
    task_id,
    description: description.trim(),
    status: "pending",
    created_at: new Date().toISOString(),
    created_by: req.user!.email,
    reviewed_at: null,
    reviewed_by: null,
    review_comment: null,
  };

  save(j);
  res.status(201).json({ justification: j });
});

// PUT /api/justifications/:id/review — aceita { action, reviewComment } (frontend) ou { status, review_comment }
router.put("/:id/review", requireAuth, requireRole("ADMIN", "LEADER"), (req: Request, res: Response): void => {
  const j = findById(req.params.id, req.tenantId!);
  if (!j) {
    res.status(404).json({ error: "Justificativa não encontrada.", code: "NOT_FOUND" });
    return;
  }

  const { action, reviewComment, status: statusDirect, review_comment } = req.body as Record<string, string | undefined>;

  // Mapear action (frontend) para status
  let newStatus: "approved" | "refused" | undefined;
  if (action === "approve") newStatus = "approved";
  else if (action === "refuse" || action === "refuse_and_block") newStatus = "refused";
  else if (statusDirect === "approved" || statusDirect === "refused") newStatus = statusDirect as "approved" | "refused";

  if (!newStatus) {
    res.status(400).json({ error: "action deve ser 'approve', 'refuse' ou 'refuse_and_block'.", code: "VALIDATION_ERROR" });
    return;
  }

  j.status = newStatus;
  j.reviewed_at = new Date().toISOString();
  j.reviewed_by = req.user!.email;
  j.review_comment = (reviewComment || review_comment)?.trim() ?? null;

  save(j);

  // Se recusado com bloqueio, marca tarefa como bloqueada
  if (action === "refuse_and_block") {
    tasks.update(j.task_id, req.tenantId!, {
      justification_blocked: true,
      updated_by: req.user!.email,
    });
  }

  res.json({ justification: j });
});

// PATCH /api/justifications/:id/review — alias para compatibilidade
router.patch("/:id/review", requireAuth, requireRole("ADMIN", "LEADER"), (req: Request, res: Response): void => {
  const j = findById(req.params.id, req.tenantId!);
  if (!j) {
    res.status(404).json({ error: "Justificativa não encontrada.", code: "NOT_FOUND" });
    return;
  }

  const { status, review_comment } = req.body as Record<string, string | undefined>;
  if (!status || !["approved", "refused"].includes(status)) {
    res.status(400).json({ error: "status deve ser 'approved' ou 'refused'.", code: "VALIDATION_ERROR" });
    return;
  }

  j.status = status as "approved" | "refused";
  j.reviewed_at = new Date().toISOString();
  j.reviewed_by = req.user!.email;
  j.review_comment = review_comment?.trim() ?? null;

  save(j);
  res.json({ justification: j });
});

// PUT /api/justifications/task/:taskId/unblock — desbloqueia tarefa
router.put("/task/:taskId/unblock", requireAuth, requireRole("ADMIN", "LEADER"), (req: Request, res: Response): void => {
  const updated = tasks.update(req.params.taskId, req.tenantId!, {
    justification_blocked: false,
    updated_by: req.user!.email,
  });

  if (!updated) {
    res.status(404).json({ error: "Tarefa não encontrada.", code: "NOT_FOUND" });
    return;
  }

  res.json({ ok: true });
});

// Evidências da justificativa — desabilitado na demo
router.get("/:id/evidences", requireAuth, (_req: Request, res: Response): void => {
  res.json({ evidences: [], demo_note: "Upload não disponível na demo." });
});

router.post("/:id/evidences", requireAuth, (_req: Request, res: Response): void => {
  res.status(503).json({ error: "Upload não disponível na demo.", code: "DEMO_UNAVAILABLE" });
});

export default router;
