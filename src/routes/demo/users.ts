/**
 * Demo: CRUD de usuários sobre JSON store.
 */
import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { users } from "../../demo/repository";
import { requireAuth, requireRole } from "../../demo/middleware";
import { serializeUser } from "./serialize";

const router = Router();

// GET /api/users
router.get("/", requireAuth, (req: Request, res: Response): void => {
  const list = users.list(req.tenantId!);
  res.json({ users: list.map(serializeUser) });
});

// GET /api/users/all — lista completa (usersApi.listAll, usado em AdminPage)
router.get("/all", requireAuth, requireRole("ADMIN"), (req: Request, res: Response): void => {
  const list = users.list(req.tenantId!);
  res.json({ users: list.map(serializeUser) });
});

// GET /api/users/login-counts — contagem de logins por período
router.get("/login-counts", requireAuth, requireRole("ADMIN"), (req: Request, res: Response): void => {
  const list = users.list(req.tenantId!);
  const counts: Record<string, number> = {};
  for (const u of list) {
    if (u.last_login_at) counts[u.id] = 1;
  }
  res.json({ counts });
});

// PATCH /api/users/bulk-toggle-active — ativa/desativa múltiplos usuários
router.patch("/bulk-toggle-active", requireAuth, requireRole("ADMIN"), (req: Request, res: Response): void => {
  const { ids, active } = req.body as { ids?: string[]; active?: boolean };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids é obrigatório.", code: "MISSING_FIELDS" });
    return;
  }
  let updated = 0;
  for (const id of ids) {
    const u = users.findById(id);
    if (u && u.tenant_id === req.tenantId) {
      users.update(id, { active: active ?? !u.active });
      updated++;
    }
  }
  res.json({ updated });
});

// GET /api/users/:id
router.get("/:id", requireAuth, (req: Request, res: Response): void => {
  const u = users.findById(req.params.id);
  if (!u || u.tenant_id !== req.tenantId) {
    res.status(404).json({ error: "Usuário não encontrado.", code: "NOT_FOUND" });
    return;
  }
  res.json({ user: serializeUser(u) });
});

// POST /api/users
router.post("/", requireAuth, requireRole("ADMIN"), async (req: Request, res: Response): Promise<void> => {
  const { email: emailRaw, nome, role, area, password } = req.body as Record<string, string | undefined>;

  if (!emailRaw || !nome || !role || !area) {
    res.status(400).json({ error: "email, nome, role e area são obrigatórios.", code: "MISSING_FIELDS" });
    return;
  }

  const email = emailRaw.trim().toLowerCase();
  const tenantId = req.tenantId!;

  if (users.findByEmail(tenantId, email)) {
    res.status(409).json({ error: "E-mail já cadastrado nesta empresa.", code: "DUPLICATE_EMAIL" });
    return;
  }

  const pw = password?.trim() || "123456";
  const passwordHash = await bcrypt.hash(pw, 10);

  const user = users.create({
    tenant_id: tenantId,
    email,
    nome: nome.trim(),
    role: role as "USER" | "LEADER" | "ADMIN",
    area: area.trim(),
    active: true,
    can_delete: true,
    password_hash: passwordHash,
    must_change_password: false,
  });

  res.status(201).json({ user: serializeUser(user) });
});

// PUT /api/users/:id
router.put("/:id", requireAuth, requireRole("ADMIN", "LEADER"), async (req: Request, res: Response): Promise<void> => {
  const u = users.findById(req.params.id);
  if (!u || u.tenant_id !== req.tenantId) {
    res.status(404).json({ error: "Usuário não encontrado.", code: "NOT_FOUND" });
    return;
  }

  const { nome, role, area, active, password } = req.body as Record<string, unknown>;
  const patch: Partial<typeof u> = {};

  if (nome && typeof nome === "string") patch.nome = nome.trim();
  if (role && typeof role === "string") patch.role = role as "USER" | "LEADER" | "ADMIN";
  if (area && typeof area === "string") patch.area = area.trim();
  if (active !== undefined) patch.active = Boolean(active);
  if (password && typeof password === "string" && password.trim()) {
    patch.password_hash = await bcrypt.hash(password.trim(), 10);
  }

  const updated = users.update(req.params.id, patch);
  if (!updated) {
    res.status(404).json({ error: "Usuário não encontrado.", code: "NOT_FOUND" });
    return;
  }

  res.json({ user: serializeUser(updated) });
});

// DELETE /api/users/:id
router.delete("/:id", requireAuth, requireRole("ADMIN"), (req: Request, res: Response): void => {
  const u = users.findById(req.params.id);
  if (!u || u.tenant_id !== req.tenantId) {
    res.status(404).json({ error: "Usuário não encontrado.", code: "NOT_FOUND" });
    return;
  }

  // Impedir auto-deleção
  if (u.id === req.user!.id) {
    res.status(400).json({ error: "Não é possível deletar o próprio usuário.", code: "SELF_DELETE" });
    return;
  }

  users.delete(req.params.id);
  res.json({ ok: true });
});

function handleToggleActive(req: Request, res: Response): void {
  const u = users.findById(req.params.id);
  if (!u || u.tenant_id !== req.tenantId) {
    res.status(404).json({ error: "Usuário não encontrado.", code: "NOT_FOUND" });
    return;
  }
  const updated = users.update(req.params.id, { active: !u.active });
  if (updated) {
    res.json({ user: serializeUser(updated), active: updated.active });
  } else {
    res.json({ active: !u.active });
  }
}

// POST /api/users/:id/toggle-active
router.post("/:id/toggle-active", requireAuth, requireRole("ADMIN"), handleToggleActive);

// PATCH /api/users/:id/toggle-active — alias (frontend usa PATCH)
router.patch("/:id/toggle-active", requireAuth, requireRole("ADMIN"), handleToggleActive);

export default router;
