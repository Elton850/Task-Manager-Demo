/**
 * Limpa todos os dados da base Supabase (staging/teste), na mesma ideia do seed:local:clean.
 *
 * Uso:
 *   npm run staging:clean   — usa .env.staging e limpa a base de staging
 *   npm run staging:clean -- --confirm  — obrigatório para executar (segurança)
 *
 * Ou com .env manual:
 *   npx dotenv -e .env.staging -- ts-node -r dotenv/config scripts/clean-supabase.ts --confirm
 *
 * Ordem: apaga tabelas na ordem das FKs, depois recria o tenant "system".
 * SEGURANÇA: só roda se --confirm for passado e NODE_ENV !== 'production' OU DB_PROVIDER=supabase com .env.staging.
 */
import "dotenv/config";
import { Pool } from "pg";

const SYSTEM_TENANT_ID = "00000000-0000-0000-0000-000000000001";

function hasConfirm(): boolean {
  return process.argv.includes("--confirm");
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error("❌ SUPABASE_DB_URL não definida. Use .env.staging ou defina a variável.");
    process.exit(1);
  }

  if (!hasConfirm()) {
    console.error("❌ Use --confirm para confirmar a limpeza da base (ex.: npm run staging:clean -- --confirm)");
    process.exit(1);
  }

  if (process.env.NODE_ENV === "production" && process.env.DB_PROVIDER !== "supabase") {
    console.error("❌ Limpeza de base Supabase só é permitida com DB_PROVIDER=supabase (ex.: ambiente staging).");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: url,
    ssl: process.env.SUPABASE_DB_SSL === "false" ? false : { rejectUnauthorized: false },
  });

  console.log("🧹 Limpando dados da base Supabase (staging/teste)...\n");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Ordem respeitando FKs (filhos antes dos pais)
    await client.query("DELETE FROM justification_evidences");
    await client.query("DELETE FROM task_justifications");
    await client.query("DELETE FROM task_evidences");
    await client.query("DELETE FROM tasks WHERE parent_task_id IS NOT NULL");
    await client.query("DELETE FROM tasks");
    await client.query("DELETE FROM rules");
    await client.query("DELETE FROM lookups");
    await client.query("DELETE FROM login_events");
    await client.query("DELETE FROM users");
    await client.query("DELETE FROM tenants");

    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO tenants (id, slug, name, active, created_at) VALUES ($1, 'system', 'Sistema', 1, $2) ON CONFLICT (id) DO NOTHING`,
      [SYSTEM_TENANT_ID, now]
    );

    await client.query("COMMIT");
    console.log("   Tabelas esvaziadas.");
    console.log("   Tenant 'system' recriado.");
    console.log("\n✅ Limpeza concluída. Rode o seed ou migrate se quiser repopular.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
