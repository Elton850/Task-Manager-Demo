import path from "path";

/** Tamanho máximo de arquivo de evidência (10 MB). */
export const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024;

/** Diretório base de uploads locais em disco. */
export const uploadsBaseDir = path.resolve(process.cwd(), "data", "uploads");

/** MIME types permitidos para evidências. */
export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/octet-stream",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
