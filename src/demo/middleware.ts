/**
 * Demo Middleware — versão simplificada do tenant/CSRF/auth para demo de portfólio.
 *
 * Diferenças da produção:
 * - Tenant resolvido pelo header X-Tenant-Slug ou query param ?tenant (sem validação de host)
 * - CSRF desabilitado (demo local, sem risco)
 * - Host validation desabilitado
 * - Rate limit desabilitado
 */
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { AuthUser } from "../types";
import { tenants } from "./repository";

const JWT_SECRET = process.env.JWT_SECRET || "demo-jwt-secret";

// ─── Auth ─────────────────────────────────────────────────────────────────────

export class AuthError extends Error {
  code: string;
  meta?: unknown;
  constructor(code: string, message: string, meta?: unknown) {
    super(message);
    this.code = code;
    this.meta = meta;
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user as object, JWT_SECRET, { expiresIn: "12h", algorithm: "HS256" });
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as AuthUser;
}

/** Injeta req.user a partir do cookie auth_token (sem lançar erro se ausente). */
export function apiAuthContext(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.["auth_token"];
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      // token inválido ou expirado: segue sem usuário
    }
  }
  next();
}

/** Exige autenticação; retorna 401 se não autenticado. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.["auth_token"];
  if (!token) {
    res.status(401).json({ error: "Não autenticado.", code: "UNAUTHORIZED" });
    return;
  }
  try {
    req.user = verifyToken(token);
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

// ─── Tenant ───────────────────────────────────────────────────────────────────

/**
 * Resolve o tenant da requisição.
 * Ordem de prioridade: header X-Tenant-Slug → query param ?tenant → "demo"
 */
export function demoTenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip para rotas públicas
  if (req.path === "/csrf" || req.path === "/health") {
    return next();
  }

  const headerSlug = req.headers["x-tenant-slug"];
  const querySlug = req.query["tenant"];

  let slug =
    (typeof headerSlug === "string" ? headerSlug.trim().toLowerCase() : null) ||
    (typeof querySlug === "string" ? querySlug.trim().toLowerCase() : null) ||
    "demo";

  // Sanitizar slug
  slug = slug.replace(/[^a-z0-9-]/g, "") || "demo";

  // Na demo não há acesso real ao tenant "system" — fallback para "demo"
  if (slug === "system") slug = "demo";

  const tenant = tenants.findBySlug(slug);
  if (!tenant) {
    res.status(404).json({ error: "Tenant não encontrado.", code: "TENANT_NOT_FOUND" });
    return;
  }

  req.tenant = {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    active: tenant.active,
    createdAt: tenant.created_at,
    logoUpdatedAt: null,
  };
  req.tenantId = tenant.id;
  next();
}

/** No-op: CSRF desabilitado na demo. */
export function noopCsrf(_req: Request, _res: Response, next: NextFunction): void {
  next();
}

/** Gera CSRF token (compatibilidade com frontend que chama /api/csrf). */
export function demoGetCsrfToken(_req: Request, res: Response): void {
  res.json({ csrfToken: "demo-csrf-disabled" });
}
