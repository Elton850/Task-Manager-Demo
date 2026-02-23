import React, { createContext, useContext, useEffect } from "react";
import { useLocation, Outlet } from "react-router-dom";
import { setTenantSlug } from "@/services/api";
import { getTenantFromPath, getBasePath } from "@/utils/tenantPath";

const BasePathContext = createContext<string>("");

export function useBasePath(): string {
  const ctx = useContext(BasePathContext);
  return ctx ?? "";
}

/**
 * Detecta se estamos em modo subdomínio (produção ou staging com hostname real).
 * Produção: fluxiva.com.br (raiz) → system; demo.fluxiva.com.br → demo; sistema.fluxiva.com.br → system.
 * Staging: staging.fluxiva.com.br → system; demo.staging.fluxiva.com.br → demo; sistema.staging.fluxiva.com.br → system.
 */
function getSubdomainSlug(): string | null {
  if (typeof window === "undefined") return null;
  const h = window.location.hostname;
  if (!h || h === "localhost" || h === "127.0.0.1") return null;
  const parts = h.split(".");
  if (parts.length < 3) return null;
  const sub = parts[0].toLowerCase();
  // Staging: demo.staging.fluxiva.com.br (5 partes) ou staging.fluxiva.com.br (4 partes)
  if (parts.length >= 5 && parts[1] === "staging") return sub === "sistema" ? "system" : sub;
  if (parts.length === 4 && parts[0] === "staging") return "system";
  // Produção: domínio raiz (3 partes) → system
  if (parts.length === 3) return "system";
  return sub === "sistema" ? "system" : sub;
}

/**
 * Sincroniza o tenant (por subdomínio em produção ou por path em dev)
 * e fornece basePath para links internos.
 *
 * Em produção/staging (hostname real com 3+ partes):
 *   - tenant = subdomínio (ex.: "empresa1", "system")
 *   - basePath = "" (não há prefixo no path — o slug está no hostname)
 *
 * Em desenvolvimento (localhost):
 *   - tenant e basePath derivados do path como antes (/empresax/login → "empresax")
 */
export function SyncTenantAndBasePath() {
  const location = useLocation();
  const pathname = location.pathname;

  const subdomainSlug = getSubdomainSlug();
  const isSubdomainMode = subdomainSlug !== null;

  const tenant = isSubdomainMode ? subdomainSlug : getTenantFromPath(pathname);
  const basePath = isSubdomainMode ? "" : getBasePath(pathname);

  useEffect(() => {
    setTenantSlug(tenant);
    if (tenant !== "system") {
      localStorage.setItem("tenantSlug", tenant);
    }
  }, [tenant]);

  return (
    <BasePathContext.Provider value={basePath}>
      <Outlet />
    </BasePathContext.Provider>
  );
}
