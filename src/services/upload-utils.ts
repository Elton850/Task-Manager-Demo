/**
 * Utilitários compartilhados para upload de evidências.
 * Usado por src/routes/tasks.ts e src/routes/justifications.ts.
 */

/** Remove caracteres inválidos de nome de arquivo e limita o comprimento. */
export function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-]/g, "_").slice(0, 120) || "arquivo";
}

/**
 * Extrai o payload base64 puro de uma data URL ou string base64 direta.
 * Ex.: "data:image/png;base64,iVBOR..." → "iVBOR..."
 */
export function parseBase64Payload(input: string): string {
  const trimmed = input.trim();
  const idx = trimmed.indexOf("base64,");
  if (idx >= 0) return trimmed.slice(idx + 7);
  return trimmed;
}
