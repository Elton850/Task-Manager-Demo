/**
 * Copia a base de dados de PRODUÇÃO para STAGING (Supabase → Supabase).
 *
 * Uso:
 *   1. Defina no .env (ou .env.staging):
 *      SUPABASE_DB_URL            = connection string do STAGING (destino)
 *      SUPABASE_DB_URL_PRODUCTION = connection string da PRODUÇÃO (origem)
 *   2. Execute: npm run copy:prod-to-staging -- --confirm
 *
 * O script:
 *   - Limpa todas as tabelas do destino (staging)
 *   - Copia todos os dados da origem (produção) para o destino, na ordem das FKs
 *
 * SEGURANÇA: exige --confirm. Use apenas para copiar produção → base de teste.
 */

import "dotenv/config";
import { Pool } from "pg";

const SOURCE_URL = process.env.SUPABASE_DB_URL_PRODUCTION || "";
const TARGET_URL = process.env.SUPABASE_DB_URL || "";

const TABLES: Array<{ name: string; columns: string[]; orderBy?: string }> = [
  { name: "tenants", columns: ["id", "slug", "name", "active", "created_at", "logo_path", "logo_updated_at"] },
  {
    name: "users",
    columns: [
      "id", "tenant_id", "email", "nome", "role", "area",
      "active", "can_delete", "password_hash", "must_change_password",
      "reset_code_hash", "reset_code_expires_at", "created_at",
      "last_login_at", "last_logout_at",
    ],
  },
  { name: "lookups", columns: ["id", "tenant_id", "category", "value", "order_index", "created_at"] },
  {
    name: "rules",
    columns: [
      "id", "tenant_id", "area", "allowed_recorrencias", "allowed_tipos", "custom_tipos", "default_tipos",
      "updated_at", "updated_by",
    ],
  },
  { name: "login_events", columns: ["id", "tenant_id", "user_id", "logged_at"] },
  {
    name: "tasks",
    columns: [
      "id", "tenant_id", "competencia_ym", "recorrencia", "tipo", "atividade",
      "responsavel_email", "responsavel_nome", "area", "prazo", "realizado",
      "status", "observacoes", "created_at", "created_by", "updated_at", "updated_by",
      "deleted_at", "deleted_by", "prazo_modified_by", "realizado_por",
      "parent_task_id", "justification_blocked", "justification_blocked_at",
      "justification_blocked_by",
    ],
    orderBy: "parent_task_id NULLS FIRST", // pais antes de subtarefas
  },
  {
    name: "task_evidences",
    columns: [
      "id", "tenant_id", "task_id", "file_name", "file_path",
      "mime_type", "file_size", "uploaded_at", "uploaded_by",
    ],
  },
  {
    name: "task_justifications",
    columns: [
      "id", "tenant_id", "task_id", "description", "status",
      "created_at", "created_by", "reviewed_at", "reviewed_by", "review_comment",
    ],
  },
  {
    name: "justification_evidences",
    columns: [
      "id", "tenant_id", "justification_id", "file_name", "file_path",
      "mime_type", "file_size", "uploaded_at", "uploaded_by",
    ],
  },
];

function hasConfirm(): boolean {
  return process.argv.includes("--confirm");
}

function maskUrl(url: string): string {
  return url.replace(/:[^:@]+@/, ":***@");
}

function coerce(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  return val;
}

async function main(): Promise<void> {
  if (!hasConfirm()) {
    console.error("❌ Use --confirm para confirmar (ex.: npm run copy:prod-to-staging -- --confirm)");
    process.exit(1);
  }
  if (!SOURCE_URL) {
    console.error("❌ SUPABASE_DB_URL_PRODUCTION não definida. Defina a connection string da base de produção.");
    process.exit(1);
  }
  if (!TARGET_URL) {
    console.error("❌ SUPABASE_DB_URL não definida. Defina a connection string da base de destino (staging).");
    process.exit(1);
  }

  const ssl = process.env.SUPABASE_DB_SSL === "false" ? false : { rejectUnauthorized: false };
  const sourcePool = new Pool({ connectionString: SOURCE_URL, ssl });
  const targetPool = new Pool({ connectionString: TARGET_URL, ssl });

  console.log("=".repeat(60));
  console.log("Task Manager — Copiar produção → staging (Supabase → Supabase)");
  console.log("=".repeat(60));
  console.log("Origem (produção):", maskUrl(SOURCE_URL));
  console.log("Destino (staging): ", maskUrl(TARGET_URL));
  console.log("");

  const targetClient = await targetPool.connect();
  const sourceClient = await sourcePool.connect();

  try {
    console.log("🧹 Limpando base de destino (staging)...");
    await targetClient.query("BEGIN");
    await targetClient.query("DELETE FROM justification_evidences");
    await targetClient.query("DELETE FROM task_justifications");
    await targetClient.query("DELETE FROM task_evidences");
    await targetClient.query("DELETE FROM tasks WHERE parent_task_id IS NOT NULL");
    await targetClient.query("DELETE FROM tasks");
    await targetClient.query("DELETE FROM rules");
    await targetClient.query("DELETE FROM lookups");
    await targetClient.query("DELETE FROM login_events");
    await targetClient.query("DELETE FROM users");
    await targetClient.query("DELETE FROM tenants");
    await targetClient.query("COMMIT");
    console.log("   Destino limpo.\n");

    const BATCH_SIZE = 100;
    let totalInserted = 0;

    for (const { name, columns, orderBy } of TABLES) {
      const orderClause = orderBy ? ` ORDER BY ${orderBy}` : "";
      const res = await sourceClient.query(`SELECT * FROM ${name}${orderClause}`);
      const rows = res.rows as Record<string, unknown>[];
      const count = rows.length;

      if (count === 0) {
        console.log(`  ${name}: 0 registros — pulando.`);
        continue;
      }

      const colList = columns.join(", ");
      let inserted = 0;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        for (const row of batch) {
          const values = columns.map(c => coerce(row[c]));
          const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(", ");
          const sql = `INSERT INTO ${name} (${colList}) VALUES (${placeholders})`;
          try {
            const result = await targetClient.query(sql, values);
            inserted += result.rowCount ?? 0;
          } catch (err) {
            console.error(`  [ERRO] ${name} id=${row.id}: ${(err as Error).message}`);
          }
        }
      }
      totalInserted += inserted;
      console.log(`  ${name}: ${inserted} registros copiados.`);
    }

    console.log("");
    console.log(`✅ Concluído. Total de linhas inseridas no destino: ${totalInserted}`);
  } catch (err) {
    await targetClient.query("ROLLBACK").catch(() => {});
    console.error(err);
    process.exit(1);
  } finally {
    sourceClient.release();
    targetClient.release();
    await sourcePool.end();
    await targetPool.end();
  }
}

main();
