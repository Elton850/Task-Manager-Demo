import { Request, Response, NextFunction } from "express";
import db from "../db";
import type { Tenant } from "../types";

const IS_PROD = process.env.NODE_ENV === "production";
const IS_STAGING = process.env.NODE_ENV === "staging";

/**
 * Em staging (path-based), o host único de staging vem de APP_DOMAIN (.env.staging).
 * Ex.: APP_DOMAIN=staging.fluxiva.com.br → STAGING_HOST="staging.fluxiva.com.br".
 * Se APP_DOMAIN não estiver definido (dev local com NODE_ENV=staging), qualquer host é aceito.
 */
const STAGING_HOST = IS_STAGING
  ? (process.env.APP_DOMAIN || "").toLowerCase().trim()
  : "";

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

/** Verifica se o host (sem porta) é um IPv4 (ex.: 129.121.44.34). */
function isIPv4(hostWithoutPort: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostWithoutPort);
}

/** Valida Host header para mitigar Host Header Attack. localhost/127.0.0.1 sempre válidos (testes locais). Em prod, IPv4 é aceito (acesso por IP → tenant system). Se ALLOWED_HOST_PATTERN estiver definido, exige match para hosts que não sejam IP. */
function validateHost(host: string): boolean {
  if (!host || typeof host !== "string") return false;
  const hostWithoutPort = host.split(":")[0].toLowerCase().trim();
  if (hostWithoutPort.length > 253 || /[^a-z0-9.-]/.test(hostWithoutPort)) return false; // caracteres inválidos
  if (hostWithoutPort === "localhost" || hostWithoutPort === "127.0.0.1") return true; // sempre aceitar para testes locais (staging/prod no PC)
  if (isIPv4(hostWithoutPort)) return true; // acesso por IP (ex.: antes do DNS) → tratado como tenant system
  if (process.env.NODE_ENV === "test") return false; // em teste só localhost/127.0.0.1 são válidos (já aceitos acima)
  // Staging path-based: aceita APENAS o host exato (ex.: staging.fluxiva.com.br).
  // Sem curinga de subdomínio — staging agora usa um único host com path por empresa.
  if (IS_STAGING) {
    return !STAGING_HOST || hostWithoutPort === STAGING_HOST;
  }
  if (IS_PROD && ALLOWED_HOST_PATTERN) {
    try {
      return new RegExp(ALLOWED_HOST_PATTERN).test(hostWithoutPort);
    } catch {
      return false;
    }
  }
  return true; // prod sem pattern: manter compatibilidade (recomenda-se definir ALLOWED_HOST_PATTERN)
}

function resolveTenantSlug(req: Request): { slug: string | null; hostInvalid: boolean } {
  const host = (req.headers["host"] || "").trim();
  if (!validateHost(host)) return { slug: null, hostInvalid: true };

  const hostWithoutPort = host.split(":")[0].toLowerCase().trim();
  // Acesso por IP → tenant "system" (área do admin), sem interpretar número como subdomínio
  if (isIPv4(hostWithoutPort)) return { slug: null, hostInvalid: false };

  // 1. Custom header (enviado pelo frontend SPA — método primário em staging path-based)
  const header = req.headers["x-tenant-slug"];
  if (header && typeof header === "string") {
    const slug = header.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (slug) return { slug, hostInvalid: false };
  }

  // 2. Produção: empresaX.fluxiva.com.br (subdomínio) ou fluxiva.com.br (raiz → system)
  // Staging usa path-based (host único staging.fluxiva.com.br); tenant vem do header X-Tenant-Slug.
  // Sem header: cai no fallback "system" (linha 131 em tenantMiddleware). Não resolve por subdomínio em staging.
  const parts = host.split(".");
  if (!IS_STAGING && parts.length >= 3 && !host.includes("localhost")) {
    const sub = parts[0].toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (sub) {
      if (parts.length === 3) return { slug: "system", hostInvalid: false }; // domínio raiz
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
  const pathWithoutApi = (req.path || "").replace(/^\/api/, "") || "/";
  const { slug: resolvedSlug, hostInvalid } = resolveTenantSlug(req);

  if (hostInvalid) {
    res.status(400).json({ error: "Tenant não identificado (Host inválido).", code: "NO_TENANT" });
    return;
  }

  if (pathWithoutApi === "/csrf" || pathWithoutApi === "/health") return next();

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
    .catch((err: unknown) => {
      if (!IS_PROD) console.error("[tenantMiddleware] Erro ao buscar tenant:", err);
      else console.error("[tenantMiddleware] Erro ao buscar tenant:", err instanceof Error ? err.name : "Unknown");
      res.status(500).json({ error: "Erro interno ao verificar empresa.", code: "INTERNAL" });
    });
}
