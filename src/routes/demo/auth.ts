/**
 * Demo: rota de autenticação simplificada.
 * Login com bcrypt, sem reset de senha por e-mail, sem impersonação.
 */
import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { users } from "../../demo/repository";
import { signToken, requireAuth, AuthError } from "../../demo/middleware";
import type { AuthUser } from "../../types";

const router = Router();

function toAuthUser(u: ReturnType<typeof users.findByEmail>): AuthUser {
  if (!u) throw new Error("user not found");
  return {
    id: u.id,
    email: u.email,
    nome: u.nome,
    role: u.role as AuthUser["role"],
    area: u.area,
    canDelete: u.can_delete,
    tenantId: u.tenant_id,
  };
}

function cookieOpts() {
  return { httpOnly: true, sameSite: "lax" as const, maxAge: 12 * 60 * 60 * 1000 };
}

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { email: emailRaw, password } = req.body;
  if (!emailRaw || !password) {
    res.status(400).json({ error: "Email e senha são obrigatórios.", code: "MISSING_FIELDS" });
    return;
  }

  const tenantId = req.tenantId!;
  const email = String(emailRaw).trim().toLowerCase();

  try {
    const row = users.findByEmail(tenantId, email);
    if (!row) throw new AuthError("NO_USER", "Usuário não cadastrado.");
    if (!row.active) throw new AuthError("INACTIVE", "Usuário inativo.");

    const ok = await bcrypt.compare(String(password).trim(), row.password_hash);
    if (!ok) throw new AuthError("BAD_CREDENTIALS", "Credenciais inválidas.");

    users.updateLoginAt(row.id);

    const user = toAuthUser(row);
    const token = signToken(user);
    res.cookie("auth_token", token, cookieOpts());
    res.json({ user });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(401).json({ error: err.message, code: err.code });
    } else {
      res.status(500).json({ error: "Erro interno.", code: "INTERNAL" });
    }
  }
});

// POST /api/auth/logout
router.post("/logout", (_req: Request, res: Response): void => {
  res.clearCookie("auth_token", { httpOnly: true, sameSite: "lax" });
  res.json({ ok: true });
});

// GET /api/auth/me
router.get("/me", requireAuth, (req: Request, res: Response): void => {
  res.json({
    user: req.user,
    tenant: req.tenant,
    isImpersonating: false,
    lastLoginAt: null,
    lastLogoutAt: null,
  });
});

// POST /api/auth/request-reset — desabilitado na demo
router.post("/request-reset", (_req: Request, res: Response): void => {
  res.json({
    message: "Redefinição de senha por e-mail não disponível na versão demo. Use admin@demo.com / 123456.",
  });
});

// POST /api/auth/reset — desabilitado na demo
router.post("/reset", (_req: Request, res: Response): void => {
  res.status(503).json({
    error: "Reset de senha não disponível na demo.",
    code: "DEMO_UNAVAILABLE",
  });
});

export default router;
