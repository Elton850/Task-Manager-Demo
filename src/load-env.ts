/**
 * Carrega variáveis de ambiente ANTES de qualquer outro módulo do app.
 * Deve ser o primeiro import em server.ts para garantir que DB, seed e rotas
 * usem sempre o env correto (staging não pode ver .env de produção).
 *
 * Staging: APENAS .env.staging, com override para sobrescrever qualquer variável
 *          já definida no processo (PM2/shell).
 * Produção: .env + .env.production (override).
 * Desenvolvimento: .env.
 */
import dotenv from "dotenv";
import path from "path";

const cwd = process.cwd();
const nodeEnv = process.env.NODE_ENV;

if (nodeEnv === "staging") {
  const stagingPath = path.resolve(cwd, ".env.staging");
  const envLoadResult = dotenv.config({ path: stagingPath, override: true });
  if (envLoadResult.error) {
    console.error("[load-env] .env.staging obrigatório em staging. Não encontrado:", stagingPath);
    process.exit(1);
  }
  console.log("[load-env] Staging: credenciais e DB carregados somente de .env.staging (override ativo)");
} else if (nodeEnv === "production") {
  dotenv.config();
  dotenv.config({ path: path.resolve(cwd, ".env.production"), override: true });
} else {
  dotenv.config();
}
