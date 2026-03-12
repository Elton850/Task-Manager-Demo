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

function list(tenantId: string): Justification[] {
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
  let items = list(req.tenantId!);
  if (task_id) items = items.filter((j) => j.task_id === task_id);
  if (status) items = items.filter((j) => j.status === status);
  res.json({ justifications: items });
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

// POST /api/justifications
router.post("/", requireAuth, (req: Request, res: Response): void => {
  const { task_id, description } = req.body as Record<string, string | undefined>;

  if (!task_id || !description?.trim()) {
    res.status(400).json({ error: "task_id e description são obrigatórios.", code: "MISSING_FIELDS" });
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

// PATCH /api/justifications/:id/review — ADMIN/LEADER: aprovar ou recusar
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

// Evidências da justificativa — desabilitado na demo
router.get("/:id/evidences", requireAuth, (_req: Request, res: Response): void => {
  res.json({ evidences: [], demo_note: "Upload não disponível na demo." });
});

router.post("/:id/evidences", requireAuth, (_req: Request, res: Response): void => {
  res.status(503).json({ error: "Upload não disponível na demo.", code: "DEMO_UNAVAILABLE" });
});

export default router;
