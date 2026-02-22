/**
 * Valida variáveis de ambiente necessárias quando DB_PROVIDER=supabase.
 * Uso: npm run validate:supabase (ou node -r dotenv/config scripts/validate-env-supabase.js)
 * Não exibe valores das chaves no console (segurança).
 */
require("dotenv").config();

const provider = (process.env.DB_PROVIDER || "sqlite").toLowerCase().trim();
if (provider !== "supabase") {
  console.log("DB_PROVIDER não é 'supabase'. Nada a validar.");
  process.exit(0);
}

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL || "";

const errors = [];

if (!SUPABASE_URL || SUPABASE_URL.length < 10) {
  errors.push("SUPABASE_URL está vazia ou inválida.");
} else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co/i.test(SUPABASE_URL)) {
  errors.push("SUPABASE_URL não parece uma URL do Supabase (ex.: https://xxxx.supabase.co).");
}

if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.length < 20) {
  errors.push("SUPABASE_ANON_KEY está vazia ou muito curta.");
}

if (!SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY.length < 20) {
  errors.push("SUPABASE_SERVICE_ROLE_KEY está vazia ou muito curta (use apenas no backend, nunca no frontend).");
}

if (!SUPABASE_DB_URL || SUPABASE_DB_URL.length < 20) {
  errors.push("SUPABASE_DB_URL está vazia ou muito curta. Obtenha em: Supabase Dashboard → Settings → Database → Connection string (Session mode).");
} else if (!/^postgresql:\/\//i.test(SUPABASE_DB_URL)) {
  errors.push("SUPABASE_DB_URL não parece uma connection string PostgreSQL válida (deve começar com postgresql://).");
}

if (errors.length > 0) {
  console.error("Validação de env para Supabase falhou:");
  errors.forEach((e) => console.error("  -", e));
  process.exit(1);
}

console.log("Variáveis SUPABASE_* válidas (DB_PROVIDER=supabase).");
process.exit(0);
