/**
 * Validação e sanitização de dados de entrada para evitar informações sujas no banco.
 * Todas as rotas devem usar estas funções antes de persistir.
 * Nenhuma alteração de schema/banco — apenas validação em tempo de requisição.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_YYYY_MM_DD = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const COMPETENCIA_YM = /^\d{4}-(0[1-9]|1[0-2])$/;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESET_CODE_REGEX = /^[A-Za-z0-9]{4,8}$/;

/** Retorna true se o e-mail tem formato válido. */
export function isValidEmail(email: string): boolean {
  const s = String(email || "").trim();
  if (s.length > 254) return false;
  return EMAIL_REGEX.test(s);
}

/** Lança se o valor exceder o tamanho máximo. */
export function assertMaxLength(value: string, max: number, label: string): void {
  if (value.length > max) {
    throw new Error(`${label} deve ter no máximo ${max} caracteres.`);
  }
}

/** Valida formato de data YYYY-MM-DD. Lança se inválido. */
export function assertDateFormat(date: string, label: string): void {
  const s = String(date || "").trim();
  if (!s) return;
  if (!DATE_YYYY_MM_DD.test(s)) {
    throw new Error(`${label} inválida. Use o formato YYYY-MM-DD.`);
  }
}

/** Valida competência YYYY-MM. Lança se inválido. */
export function assertCompetenciaYm(ym: string, label: string): void {
  const s = String(ym || "").trim();
  if (!s) throw new Error(`${label} é obrigatória.`);
  if (!COMPETENCIA_YM.test(s)) {
    throw new Error(`${label} inválida. Use o formato YYYY-MM (ex.: 2026-01).`);
  }
}

/** Valida slug de tenant (minúsculas, hífens, números). Lança se inválido. */
export function assertSlug(slug: string, maxLength = 80): void {
  const s = String(slug || "").trim().toLowerCase();
  if (!s) throw new Error("Slug é obrigatório.");
  assertMaxLength(s, maxLength, "Slug");
  if (!SLUG_REGEX.test(s)) {
    throw new Error("Slug deve conter apenas letras minúsculas, números e hífens (ex.: minha-empresa).");
  }
}

/** Valida código de reset (alfanumérico 4–8 caracteres). */
export function assertResetCode(code: string): void {
  const s = String(code || "").trim();
  if (!s) throw new Error("Código é obrigatório.");
  if (!RESET_CODE_REGEX.test(s)) {
    throw new Error("Código deve ter entre 4 e 8 caracteres (letras e números).");
  }
}

/** Valida senha mínima (apenas tamanho). */
export function assertPasswordMinLength(password: string, min = 6): void {
  const s = String(password ?? "").trim();
  if (s.length < min) {
    throw new Error(`Senha deve ter no mínimo ${min} caracteres.`);
  }
}
