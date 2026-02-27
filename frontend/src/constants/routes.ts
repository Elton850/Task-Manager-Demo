/**
 * Segmentos de rota que NÃO são slug de empresa.
 * Admin Mestre acessa sem prefixo de tenant.
 * Sincronizar com o backend (src/middleware/tenant.ts) ao adicionar novas rotas.
 */
export const RESERVED_SEGMENTS = new Set([
  "login",
  "calendar",
  "tasks",
  "performance",
  "users",
  "admin",
  "empresa",
  "empresas",
  "justificativas",
  "sistema",
  "logs-acesso",
  "erro",
]);
