import React from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AlertCircle, Home, Building2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { useBasePath } from "@/contexts/BasePathContext";

const APP_DOMAIN = (import.meta.env.VITE_APP_DOMAIN as string | undefined) || "";

/** URL do "início" para o link Voltar: raiz do sistema em produção (subdomínio), ou origem atual em staging/local. */
function getHomeUrl(): string {
  if (typeof window === "undefined") return "/";
  const origin = window.location.origin;
  const h = window.location.hostname;
  const parts = h.split(".");
  if (parts.length === 4 && parts[0].toLowerCase() === "staging") return origin;
  if (APP_DOMAIN && parts.length >= 3 && h !== "localhost" && h !== "127.0.0.1") {
    const isRoot = parts.length === 3;
    if (!isRoot) return `https://${APP_DOMAIN}`;
  }
  return origin;
}

type ErrorTipo = "pagina" | "empresa";

export default function ErrorPage() {
  const [search] = useSearchParams();
  const basePath = useBasePath();
  const navigate = useNavigate();
  const tipo = (search.get("tipo") || "pagina") as ErrorTipo;

  const isEmpresa = tipo === "empresa";
  const title = isEmpresa ? "Empresa não encontrada" : "Página não encontrada";
  const message = isEmpresa
    ? "A empresa que você está tentando acessar não existe ou está inativa. Verifique o link ou volte ao início para acessar o sistema."
    : "A página que você procura não existe ou foi movida. Use o link abaixo para voltar ao início.";

  const homeUrl = getHomeUrl();
  const isSameOrigin = typeof window !== "undefined" && homeUrl === window.location.origin;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-amber-100 dark:bg-amber-900/40 p-4">
            <AlertCircle className="w-12 h-12 text-amber-600 dark:text-amber-500" />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{message}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {isSameOrigin ? (
            <Button variant="primary" icon={<Home size={18} />} onClick={() => navigate(basePath || "/")}>
              Ir para o início
            </Button>
          ) : (
            <a
              href={homeUrl}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            >
              <Building2 size={18} />
              Ir para o início
            </a>
          )}
          {basePath && (
            <Button variant="outline" icon={<Home size={18} />} onClick={() => navigate(`${basePath}/login`)}>
              Fazer login
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
