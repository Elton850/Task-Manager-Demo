import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { AuthUser } from "../types";

const JWT_SECRET = process.env.JWT_SECRET!;

export class AuthError extends Error {
  code: string;
  meta?: unknown;
  constructor(code: string, message: string, meta?: unknown) {
    super(message);
    this.code = code;
    this.meta = meta;
  }
}

const JWT_OPTIONS: jwt.SignOptions = {
  expiresIn: "12h",
  algorithm: "HS256",
};

export function signToken(user: AuthUser): string {
  if (!JWT_SECRET) throw new Error("JWT_SECRET não configurado.");
  return jwt.sign(user, JWT_SECRET, JWT_OPTIONS);
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as AuthUser;
}

const SKIP_AUTH_PATHS = new Set(["/auth/login", "/auth/reset", "/auth/request-reset", "/csrf", "/health"]);

/**
 * Tenta definir req.user e req.impersonating a partir do cookie auth_token.
 * Se o token for inválido, expirado ou pertencer a outro tenant, não define nada (sem lançar erro).
 */
function setUserFromToken(req: Request): void {
  const token = req.cookies?.["auth_token"];
  if (!token) return;
  try {
    const payload = verifyToken(token);
    if (req.tenantId && payload.tenantId !== req.tenantId) return;
    req.user = payload;
    req.impersonating = !!req.cookies?.["auth_real_token"];
  } catch {
    // token inválido: seguir sem user
  }
}

/** Preenche req.user e req.impersonating para rotas /api (exceto login/reset/csrf/health). */
export function apiAuthContext(req: Request, res: Response, next: NextFunction): void {
  const pathWithoutApi = (req.path || "").replace(/^\/api/, "") || "/";
  if (!SKIP_AUTH_PATHS.has(pathWithoutApi)) {
    setUserFromToken(req);
  }
  next();
}

/** Bloqueia métodos que não sejam GET quando em modo "visualizar como", exceto sair da impersonação. */
export function blockWritesWhenImpersonating(req: Request, res: Response, next: NextFunction): void {
  const pathWithoutApi = (req.path || "").replace(/^\/api/, "") || "/";
  const allowStop = pathWithoutApi === "/auth/impersonate/stop";
  if (
    req.impersonating &&
    req.method !== "GET" &&
    req.method !== "OPTIONS" &&
    !allowStop
  ) {
    res.status(403).json({
      error: "Modificações não permitidas ao visualizar como outro usuário.",
      code: "IMPERSONATION_READ_ONLY",
    });
    return;
  }
  next();
}

/** Define req.user se houver token válido; não exige autenticação. */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  setUserFromToken(req);
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.["auth_token"];
  if (!token) {
    res.status(401).json({ error: "Não autenticado.", code: "UNAUTHORIZED" });
    return;
  }

  try {
    const payload = verifyToken(token);

    // Ensure token belongs to this tenant
    if (req.tenantId && payload.tenantId !== req.tenantId) {
      res.status(403).json({ error: "Acesso negado a este tenant.", code: "TENANT_MISMATCH" });
      return;
    }

    req.user = payload;
    req.impersonating = !!req.cookies?.["auth_real_token"];
    next();
  } catch {
    res.clearCookie("auth_token");
    res.status(401).json({ error: "Sessão expirada. Faça login novamente.", code: "TOKEN_EXPIRED" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Não autenticado.", code: "UNAUTHORIZED" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Permissão insuficiente.", code: "FORBIDDEN" });
      return;
    }
    next();
  };
}
