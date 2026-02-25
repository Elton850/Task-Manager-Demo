import type { Request } from "express";

/** True quando a requisição do usuário veio por HTTPS (direto ou via proxy). Usado para cookies Secure. */
export function isSecureRequest(req: Request): boolean {
  const proto = (req.get("X-Forwarded-Proto") || "").toLowerCase().split(",")[0].trim();
  return req.secure || proto === "https";
}

export function mustString(v: unknown, label: string): string {
  const s = String(v ?? "").trim();
  if (!s) throw new Error(`${label} é obrigatório.`);
  return s;
}

export function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  return String(v ?? "").toUpperCase() === "TRUE" || String(v ?? "") === "1";
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function safeLowerEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
}

export function calcStatus(prazo: string | null | undefined, realizado: string | null | undefined): string {
  const p = prazo?.trim() || "";
  const r = realizado?.trim() || "";

  if (r) {
    return !p || r <= p ? "Concluído" : "Concluído em Atraso";
  }
  if (!p) return "Em Andamento";

  const today = todayStr();
  return today > p ? "Em Atraso" : "Em Andamento";
}

export function optStr(v: unknown): string {
  return String(v ?? "").trim();
}

/**
 * Mensagem de erro segura para enviar ao cliente na resposta da API.
 * Em produção retorna apenas o fallback para não expor detalhes internos (BD, Storage, etc.).
 * Em desenvolvimento/staging retorna a mensagem real para facilitar debug.
 */
export function getClientErrorMessage(err: unknown, fallback: string): string {
  if (process.env.NODE_ENV === "production") {
    return fallback;
  }
  return err instanceof Error ? err.message : fallback;
}
