/**
 * Wrapper para seedLocal: define o banco de destino conforme o argumento do comando.
 *
 * Uso:
 *   npm run seed:db              → popula banco LOCAL (SQLite em data/taskmanager.db)
 *   npm run seed:db -- local     → idem
 *   npm run seed:db -- staging   → popula Supabase STAGING (usa .env.staging)
 *   npm run seed:db -- staging -- --clean  → só limpa o banco staging (e recria tenant system)
 *
 * Requisitos:
 *   - local: nenhum (usa data/taskmanager.db)
 *   - staging: arquivo .env.staging com DB_PROVIDER=supabase, SUPABASE_DB_URL, etc.
 */
const { spawnSync } = require("child_process");
const path = require("path");

const target = (process.argv[2] || "local").toLowerCase().trim();
const extraArgs = process.argv.slice(3); // ex: --clean

const cwd = process.cwd();
const env = { ...process.env };

if (target === "staging") {
  env.DOTENV_CONFIG_PATH = path.resolve(cwd, ".env.staging");
  console.log("🎯 Alvo: Supabase STAGING (.env.staging)\n");
} else {
  if (target !== "local") {
    console.warn("⚠️ Alvo desconhecido '" + target + "', usando 'local'.\n");
  }
  env.SQLITE_DB_PATH = path.resolve(cwd, "data", "taskmanager.db");
  env.DB_PROVIDER = "sqlite";
  console.log("🎯 Alvo: banco LOCAL (SQLite em data/taskmanager.db)\n");
}

const result = spawnSync(
  "npx",
  ["ts-node", "-r", "dotenv/config", path.join(cwd, "src", "db", "seedLocal.ts"), ...extraArgs],
  { stdio: "inherit", env, cwd, shell: true }
);

process.exit(result.status ?? 1);
