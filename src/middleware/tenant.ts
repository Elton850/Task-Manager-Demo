import { Request, Response, NextFunction } from "express";
import db from "../db";
import type { Tenant } from "../types";

const IS_PROD = process.env.NODE_ENV === "production";

/** Cache em memória do tenant por slug (TTL 60s) para reduzir query por request. */
const TENANT_CACHE_TTL_MS = 60_000;
const tenantCache = new Map<string, { tenant: Tenant; tenantId: string; expiresAt: number }>();

function getCachedTenant(slug: string): { tenant: Tenant; tenantId: string } | null {
  const entry = tenantCache.get(slug);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return { tenant: entry.tenant, tenantId: entry.tenantId };
}

function setCachedTenant(slug: string, tenant: Tenant, tenantId: string): void {
  tenantCache.set(slug, {
    tenant,
    tenantId,
    expiresAt: Date.now() + TENANT_CACHE_TTL_MS,
  });
}
const ALLOWED_HOST_PATTERN = process.env.ALLOWED_HOST_PATTERN || ""; // e.g. "^[a-z0-9-]+\\.taskmanager\\.com$"

interface TenantDbRow {
  id: string;
  slug: string;
  name: string;
  active: number;
  created_at: string;
  logo_updated_at?: string | null;
}

/** Valida Host header para mitigar Host Header Attack. localhost/127.0.0.1 sempre válidos (testes locais). Em prod, se ALLOWED_HOST_PATTERN estiver definido, exige match para outros hosts. */
function validateHost(host: string): boolean {
  if (!host || typeof host !== "string") return false;
  const h = host.split(":")[0].toLowerCase().trim();
  if (h.length > 253 || /[^a-z0-9.-]/.test(h)) return false; // caracteres inválidos
  if (h === "localhost" || h === "127.0.0.1") return true; // sempre aceitar para testes locais (staging/prod no PC)
  if (process.env.NODE_ENV === "test") return false; // em teste só localhost/127.0.0.1 são válidos (já aceitos acima)
  if (IS_PROD && ALLOWED_HOST_PATTERN) {
    try {
      return new RegExp(ALLOWED_HOST_PATTERN).test(h);
    } catch {
      return false;
    }
  }
  return true; // prod sem pattern: manter compatibilidade (recomenda-se definir ALLOWED_HOST_PATTERN)
}

function resolveTenantSlug(req: Request): { slug: string | null; hostInvalid: boolean } {
  const host = (req.headers["host"] || "").trim();
  if (!validateHost(host)) return { slug: null, hostInvalid: true };

  // 1. Custom header (used by frontend SPA)
  const header = req.headers["x-tenant-slug"];
  if (header && typeof header === "string") {
    const slug = header.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (slug) return { slug, hostInvalid: false };
  }

  // 2. Subdomain from Host header (production: empresaX.fluxiva.com.br)
  const parts = host.split(".");
  if (parts.length >= 3 && !host.includes("localhost")) {
    const sub = parts[0].toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (sub) {
      // "sistema" é o subdomínio do admin do sistema; mapeia para o slug interno "system"
      const slug = sub === "sistema" ? "system" : sub;
      return { slug, hostInvalid: false };
    }
  }

  // 3. Query param (permite links "abrir em nova guia" / download enviarem o tenant; auth continua validando JWT)
  const qParam = req.query["tenant"];
  if (qParam && typeof qParam === "string") {
    const slug = qParam.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (slug) return { slug, hostInvalid: false };
  }

  return { slug: null, hostInvalid: false };
}

/** Middleware que rejeita Host inválido (400 NO_TENANT). Usar antes de rotas públicas para que /api/csrf e /api/health também exijam Host válido. */
export function rejectInvalidHost(req: Request, res: Response, next: NextFunction): void {
  const { hostInvalid } = resolveTenantSlug(req);
  if (hostInvalid) {
    res.status(400).json({ error: "Tenant não identificado (Host inválido).", code: "NO_TENANT" });
    return;
  }
  next();
}

export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  const p = (req.path || "").replace(/^\/api/, "") || "/";
  const { slug: resolvedSlug, hostInvalid } = resolveTenantSlug(req);

  if (hostInvalid) {
    res.status(400).json({ error: "Tenant não identificado (Host inválido).", code: "NO_TENANT" });
    return;
  }

  if (p === "/csrf" || p === "/health") return next();

  let slug = resolvedSlug;
  // Admin Mestre pode acessar sem tenant na URL: tratamos como tenant "system"
  if (!slug) slug = "system";

  const cached = getCachedTenant(slug);
  if (cached) {
    req.tenant = cached.tenant;
    req.tenantId = cached.tenantId;
    return next();
  }

  // Suporta providers síncronos (SQLite) e assíncronos (PostgreSQL) via Promise.resolve
  Promise.resolve(
    db.prepare("SELECT * FROM tenants WHERE slug = ? AND active = 1").get(slug)
  )
    .then((rawRow) => {
      const row = rawRow as TenantDbRow | undefined;
      if (!row) {
        res.status(404).json({ error: "Empresa não encontrada ou inativa.", code: "TENANT_NOT_FOUND" });
        return;
      }

      const tenant: Tenant = {
        id: row.id,
        slug: row.slug,
        name: row.name,
        active: row.active === 1,
        createdAt: row.created_at,
        logoUpdatedAt: row.logo_updated_at ?? null,
      };
      req.tenant = tenant;
      req.tenantId = row.id;
      setCachedTenant(slug, tenant, row.id);

      next();
    })
    .catch((err) => {
      console.error("[tenantMiddleware] Erro ao buscar tenant:", err);
      res.status(500).json({ error: "Erro interno ao verificar empresa.", code: "INTERNAL" });
    });
}
