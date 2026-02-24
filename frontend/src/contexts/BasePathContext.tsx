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
 * Detecta se estamos em modo subdomínio (produção) ou modo path (localhost / staging).
 *
 * Produção (subdomain-based): empresaX.fluxiva.com.br → "empresaX"; fluxiva.com.br → "system".
 * Staging (path-based): staging.fluxiva.com.br → null → tenant e basePath vêm do path da URL.
 * Localhost (path-based): sempre null → tenant e basePath vêm do path da URL.
 *
 * Convenção: hostname iniciado por "staging." com 4 partes → modo path-based (não há subdomínios de staging).
 * Se a empresa se chamar "staging", deve usar um slug diferente (slug reservado).
 */
function getSubdomainSlug(): string | null {
  if (typeof window === "undefined") return null;
  const h = window.location.hostname;
  if (!h || h === "localhost" || h === "127.0.0.1") return null;
  // Desenvolvimento com subdomínios locais: sistema.localhost → system, empresa-alpha.localhost → empresa-alpha
  if (h.endsWith(".localhost") || h.endsWith(".127.0.0.1")) {
    const sub = h.split(".")[0]?.toLowerCase() || "";
    return sub === "sistema" ? "system" : sub;
  }
  const parts = h.split(".");
  if (parts.length < 3) return null;
  const sub = parts[0].toLowerCase();
  // Staging path-based: staging.fluxiva.com.br → modo path (retorna null para usar getTenantFromPath).
  // Não há mais empresa.staging.fluxiva.com.br — o tenant vem do path (/empresa1/login).
  if (parts.length === 4 && parts[0] === "staging") return null;
  // Produção: domínio raiz (3 partes) → system
  if (parts.length === 3) return "system";
  // Produção: subdomínio de empresa (ex.: empresa1.fluxiva.com.br, 4 partes)
  return sub === "sistema" ? "system" : sub;
}

/**
 * Sincroniza o tenant e fornece basePath para links internos.
 *
 * Modo subdomínio (produção): empresa1.fluxiva.com.br → tenant="empresa1", basePath=""
 *   O slug está no hostname; o path não precisa de prefixo.
 *
 * Modo path (staging e localhost):
 *   staging.fluxiva.com.br/empresa1/tasks → tenant="empresa1", basePath="/empresa1"
 *   localhost:5173/empresa1/tasks         → tenant="empresa1", basePath="/empresa1"
 *   staging.fluxiva.com.br/login          → tenant="system",   basePath=""
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
    } else {
      // Evitar que ao acessar a raiz do staging (staging.dominio/) o localStorage puxe tenant antigo
      localStorage.removeItem("tenantSlug");
    }
  }, [tenant]);

  return (
    <BasePathContext.Provider value={basePath}>
      <Outlet />
    </BasePathContext.Provider>
  );
}
