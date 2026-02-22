/**
 * Script de migração de dados: SQLite → Supabase (PostgreSQL)
 *
 * Uso:
 *   1. Certifique-se de que .env contém SUPABASE_DB_URL, SUPABASE_SERVICE_ROLE_KEY e SQLITE_DB_PATH.
 *   2. Execute o schema no Supabase ANTES (scripts/supabase-schema.sql).
 *   3. (Recomendado) Para incluir evidências e justificativas: npm run seed:local — depois migre.
 *   4. Rode: npm run migrate:supabase
 *      Ou: ts-node -r dotenv/config scripts/migrate-sqlite-to-supabase.ts
 *
 * Segurança:
 *   - Credenciais apenas via variáveis de ambiente; nunca em código.
 *   - Script é idempotente: usa ON CONFLICT (id) DO NOTHING para evitar duplicatas.
 *   - Ordem respeita FKs: tenants → users → tasks → task_evidences / lookups /
 *     rules / login_events → task_justifications → justification_evidences.
 *
 * AVISO: Execute em staging/local antes de rodar em produção.
 *        Faça backup do SQLite antes: cp data/taskmanager.db data/taskmanager.db.backup
 */

import "dotenv/config";
import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";
import path from "path";

// ─── Configuração ─────────────────────────────────────────────────────────────

const SQLITE_PATH = path.resolve(
  process.cwd(),
  process.env.SQLITE_DB_PATH || "data/taskmanager.db"
);

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL || "";

if (!SUPABASE_DB_URL) {
  console.error(
    "[migrate] SUPABASE_DB_URL não está definida.\n" +
    "Obtenha a connection string em: Supabase Dashboard → Settings → Database → Connection string (Session mode).\n" +
    "Exemplo: postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
  );
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function coerce(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  return val;
}

function row2arr(
  row: Record<string, unknown>,
  cols: string[],
  opts?: { tenantIdMap?: Record<string, string>; userIdMap?: Record<string, string> }
): unknown[] {
  return cols.map(c => {
    if (c === "tenant_id" && opts?.tenantIdMap && typeof row[c] === "string")
      return opts.tenantIdMap[row[c] as string] ?? row[c];
    if (c === "user_id" && opts?.userIdMap && typeof row[c] === "string")
      return opts.userIdMap[row[c] as string] ?? row[c];
    return coerce(row[c]);
  });
}

/** Migra tabela tenants: ON CONFLICT (slug) DO NOTHING para não falhar quando o slug já existe no Supabase. */
async function migrateTenants(
  sqlite: DatabaseSync,
  pg: Pool,
  columns: string[]
): Promise<{ sqliteCount: number; pgCount: number; inserted: number; tenantIdMap: Record<string, string> }> {
  const rows = sqlite.prepare("SELECT * FROM tenants").all() as Record<string, unknown>[];
  const sqliteCount = rows.length;

  if (sqliteCount === 0) {
    const pgRes = await pg.query("SELECT COUNT(*) as c FROM tenants");
    const pgCount = parseInt(pgRes.rows[0].c, 10);
    console.log(`  tenants: 0 registros no SQLite (${pgCount} já no Supabase) — pulando.`);
    return { sqliteCount: 0, pgCount, inserted: 0, tenantIdMap: {} };
  }

  let inserted = 0;
  for (const row of rows) {
    const values = row2arr(row, columns, {});
    const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(", ");
    const colList = columns.join(", ");
    const sql = `INSERT INTO tenants (${colList}) VALUES (${placeholders}) ON CONFLICT (slug) DO NOTHING`;
    try {
      const result = await pg.query(sql, values);
      inserted += result.rowCount ?? 0;
    } catch (err) {
      console.error(`  [ERRO] tenants — row id=${row.id}: ${(err as Error).message}`);
    }
  }

  const pgRes = await pg.query("SELECT id, slug FROM tenants");
  const slugToPgId: Record<string, string> = {};
  for (const r of pgRes.rows) slugToPgId[r.slug as string] = r.id as string;

  const tenantIdMap: Record<string, string> = {};
  for (const row of rows) {
    const slug = row.slug as string;
    const pgId = slugToPgId[slug];
    if (pgId) tenantIdMap[row.id as string] = pgId;
  }

  const pgCountRes = await pg.query("SELECT COUNT(*) as c FROM tenants");
  const pgCount = parseInt(pgCountRes.rows[0].c, 10);
  return { sqliteCount, pgCount, inserted, tenantIdMap };
}

/** Migra users: ON CONFLICT (tenant_id, email) DO NOTHING e monta mapa user_id SQLite → Supabase. */
async function migrateUsers(
  sqlite: DatabaseSync,
  pg: Pool,
  columns: string[],
  tenantIdMap: Record<string, string>
): Promise<{ sqliteCount: number; pgCount: number; inserted: number; userIdMap: Record<string, string> }> {
  const rows = sqlite.prepare("SELECT * FROM users").all() as Record<string, unknown>[];
  const sqliteCount = rows.length;

  if (sqliteCount === 0) {
    const pgRes = await pg.query("SELECT COUNT(*) as c FROM users");
    const pgCount = parseInt(pgRes.rows[0].c, 10);
    return { sqliteCount: 0, pgCount, inserted: 0, userIdMap: {} };
  }

  let inserted = 0;
  for (const row of rows) {
    const tid = row.tenant_id as string;
    if (!(tid in tenantIdMap)) continue;
    const values = row2arr(row, columns, { tenantIdMap });
    const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(", ");
    const colList = columns.join(", ");
    const sql = `INSERT INTO users (${colList}) VALUES (${placeholders}) ON CONFLICT (tenant_id, email) DO NOTHING`;
    try {
      const result = await pg.query(sql, values);
      inserted += result.rowCount ?? 0;
    } catch (err) {
      console.error(`  [ERRO] users — row id=${row.id}: ${(err as Error).message}`);
    }
  }

  const userIdMap: Record<string, string> = {};
  for (const row of rows) {
    const pgTenantId = tenantIdMap[row.tenant_id as string];
    if (!pgTenantId) continue;
    const res = await pg.query("SELECT id FROM users WHERE tenant_id = $1 AND email = $2", [pgTenantId, row.email]);
    if (res.rows[0]) userIdMap[row.id as string] = res.rows[0].id as string;
  }

  const pgRes = await pg.query("SELECT COUNT(*) as c FROM users");
  const pgCount = parseInt(pgRes.rows[0].c, 10);
  return { sqliteCount, pgCount, inserted, userIdMap };
}

async function migrateTable(
  sqlite: DatabaseSync,
  pg: Pool,
  tableName: string,
  columns: string[],
  orderBy?: string,
  opts?: {
    tenantIdMap?: Record<string, string>;
    userIdMap?: Record<string, string>;
    conflictColumns?: string[];
  }
): Promise<{ sqliteCount: number; pgCount: number; inserted: number }> {
  const orderClause = orderBy ? ` ORDER BY ${orderBy}` : "";
  const rows = sqlite.prepare(`SELECT * FROM ${tableName}${orderClause}`).all() as Record<string, unknown>[];
  const sqliteCount = rows.length;

  if (sqliteCount === 0) {
    const pgRes = await pg.query(`SELECT COUNT(*) as c FROM ${tableName}`);
    const pgCount = parseInt(pgRes.rows[0].c, 10);
    console.log(`  ${tableName}: 0 registros no SQLite (${pgCount} já no Supabase) — pulando.`);
    return { sqliteCount: 0, pgCount, inserted: 0 };
  }

  const conflictCols = opts?.conflictColumns;
  const conflictClause = conflictCols?.length
    ? ` ON CONFLICT (${conflictCols.join(", ")}) DO NOTHING`
    : columns.includes("id")
      ? " ON CONFLICT (id) DO NOTHING"
      : "";
  const tenantIdMap = opts?.tenantIdMap && Object.keys(opts.tenantIdMap).length > 0 ? opts.tenantIdMap : undefined;
  const userIdMap = opts?.userIdMap;

  let inserted = 0;
  for (const row of rows) {
    if (tenantIdMap && columns.includes("tenant_id")) {
      const tid = row.tenant_id as string | undefined;
      if (tid && !(tid in tenantIdMap)) continue;
    }
    if (userIdMap && columns.includes("user_id")) {
      const uid = row.user_id as string | undefined;
      if (uid && !(uid in userIdMap)) continue;
    }
    const values = row2arr(row, columns, { tenantIdMap, userIdMap });
    const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(", ");
    const colList = columns.join(", ");
    const sql = `INSERT INTO ${tableName} (${colList}) VALUES (${placeholders})${conflictClause}`;
    try {
      const result = await pg.query(sql, values);
      inserted += result.rowCount ?? 0;
    } catch (err) {
      console.error(`  [ERRO] ${tableName} — row id=${row.id}: ${(err as Error).message}`);
    }
  }

  const pgRes = await pg.query(`SELECT COUNT(*) as c FROM ${tableName}`);
  const pgCount = parseInt(pgRes.rows[0].c, 10);
  return { sqliteCount, pgCount, inserted };
}

// ─── Tabelas e colunas (ordem respeita FKs) ───────────────────────────────────

const TABLES: Array<{ name: string; columns: string[]; orderBy?: string; conflictColumns?: string[] }> = [
  {
    name: "tenants",
    columns: ["id", "slug", "name", "active", "created_at", "logo_path", "logo_updated_at"],
  },
  {
    name: "users",
    columns: [
      "id", "tenant_id", "email", "nome", "role", "area",
      "active", "can_delete", "password_hash", "must_change_password",
      "reset_code_hash", "reset_code_expires_at", "created_at",
      "last_login_at", "last_logout_at",
    ],
  },
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
    orderBy: "parent_task_id ASC",
  },
  {
    name: "lookups",
    columns: ["id", "tenant_id", "category", "value", "order_index", "created_at"],
    conflictColumns: ["tenant_id", "category", "value"],
  },
  {
    name: "rules",
    columns: [
      "id", "tenant_id", "area", "allowed_recorrencias", "allowed_tipos", "custom_tipos", "default_tipos", "updated_at", "updated_by",
    ],
    conflictColumns: ["tenant_id", "area"],
  },
  {
    name: "task_evidences",
    columns: [
      "id", "tenant_id", "task_id", "file_name", "file_path",
      "mime_type", "file_size", "uploaded_at", "uploaded_by",
    ],
  },
  {
    name: "login_events",
    columns: ["id", "tenant_id", "user_id", "logged_at"],
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

// ─── Verificação de colunas no SQLite (tolerância a migrations) ───────────────

function getExistingColumns(sqlite: DatabaseSync, tableName: string): string[] {
  try {
    const cols = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
    return cols.map(c => c.name);
  } catch {
    return [];
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("Task Manager — Migração SQLite → Supabase");
  console.log("=".repeat(60));
  console.log(`SQLite:   ${SQLITE_PATH}`);
  console.log(`Supabase: ${SUPABASE_DB_URL.replace(/:[^:@]+@/, ":***@")}`);
  console.log("");

  // Abrir SQLite
  let sqlite: DatabaseSync;
  try {
    sqlite = new DatabaseSync(SQLITE_PATH, { readOnly: true });
    console.log("✓ SQLite aberto (leitura apenas)");
  } catch (err) {
    console.error(`[migrate] Não foi possível abrir o SQLite em ${SQLITE_PATH}:`, (err as Error).message);
    process.exit(1);
  }

  // Conectar ao Supabase PostgreSQL
  const pg = new Pool({
    connectionString: SUPABASE_DB_URL,
    ssl: process.env.SUPABASE_DB_SSL === "false" ? false : { rejectUnauthorized: false },
    max: 5,
    connectionTimeoutMillis: 15_000,
  });

  try {
    await pg.query("SELECT 1");
    console.log("✓ Conexão Supabase OK");
  } catch (err) {
    console.error("[migrate] Falha ao conectar ao Supabase:", (err as Error).message);
    await pg.end();
    process.exit(1);
  }

  console.log("");
  console.log("Migrando tabelas...");
  console.log("-".repeat(60));

  const results: Record<string, { sqliteCount: number; pgCount: number; inserted: number }> = {};
  const tablesWithZeroSource = new Set<string>();
  let tenantIdMap: Record<string, string> = {};
  let userIdMap: Record<string, string> = {};

  for (const table of TABLES) {
    process.stdout.write(`  ${table.name}... `);

    const existingCols = getExistingColumns(sqlite, table.name);
    const cols = table.columns.filter(c => existingCols.includes(c));

    if (cols.length === 0) {
      console.log("tabela não encontrada no SQLite — pulando.");
      continue;
    }

    let result: { sqliteCount: number; pgCount: number; inserted: number };
    if (table.name === "tenants") {
      const r = await migrateTenants(sqlite, pg, cols);
      tenantIdMap = r.tenantIdMap;
      result = { sqliteCount: r.sqliteCount, pgCount: r.pgCount, inserted: r.inserted };
    } else if (table.name === "users") {
      const r = await migrateUsers(sqlite, pg, cols, tenantIdMap);
      userIdMap = r.userIdMap;
      result = { sqliteCount: r.sqliteCount, pgCount: r.pgCount, inserted: r.inserted };
    } else {
      result = await migrateTable(sqlite, pg, table.name, cols, table.orderBy, {
        tenantIdMap: cols.includes("tenant_id") ? tenantIdMap : undefined,
        userIdMap: table.name === "login_events" ? userIdMap : undefined,
        conflictColumns: table.conflictColumns,
      });
    }

    results[table.name] = result;
    if (result.sqliteCount === 0) tablesWithZeroSource.add(table.name);

    const status = result.sqliteCount === result.pgCount ? "✓" : "⚠";
    console.log(
      `${status} SQLite=${result.sqliteCount} | Supabase=${result.pgCount} | inseridos=${result.inserted}`
    );
  }

  // ─── Relatório final ────────────────────────────────────────────────────────
  console.log("");
  console.log("=".repeat(60));
  console.log("Relatório de migração");
  console.log("=".repeat(60));

  // login_events é append-only: Supabase pode ter mais linhas que o SQLite (logins após migração)
  const APPEND_ONLY_TABLES = ["login_events"];

  let hasDiscrepancy = false;
  for (const [tableName, { sqliteCount, pgCount }] of Object.entries(results)) {
    const exactMatch = sqliteCount === pgCount;
    const ok = exactMatch || (APPEND_ONLY_TABLES.includes(tableName) && pgCount >= sqliteCount);
    if (!exactMatch && !ok) hasDiscrepancy = true;
    const marker = ok ? "✓" : "✗";
    console.log(
      `  ${marker} ${tableName.padEnd(28)} SQLite=${sqliteCount}  Supabase=${pgCount}`
    );
  }

  const evidenceTables = ["task_evidences", "task_justifications", "justification_evidences"];
  const emptyEvidenceTables = evidenceTables.filter(t => tablesWithZeroSource.has(t));
  if (emptyEvidenceTables.length > 0) {
    console.log("");
    console.log("ℹ  Tabelas sem dados no SQLite de origem: " + emptyEvidenceTables.join(", "));
    console.log("   Para migrar evidências e justificativas, repovoe o SQLite e rode a migração de novo:");
    console.log("      npm run seed:local");
    console.log("      npm run migrate:supabase");
  }

  if (hasDiscrepancy) {
    console.log("");
    console.log("⚠  Há divergências de contagem. Verifique os erros acima.");
    console.log("   Possíveis causas: conflitos de chave primária (dados já existiam),");
    console.log("   erros de FK, ou colunas ausentes no SQLite de origem.");
    console.log("   Re-execute o script para tentar novamente (é idempotente).");
  } else {
    console.log("");
    console.log("✓  Migração concluída sem divergências!");
  }

  console.log("");
  console.log("Próximos passos:");
  console.log("  1. Confira uma amostra de dados no Supabase Dashboard.");
  console.log("  2. Defina DB_PROVIDER=supabase e SUPABASE_DB_URL no .env.");
  console.log("  3. Execute: npm run dev — e teste login e listagem de tarefas.");
  console.log("  4. Se ok, atualize .env de staging/produção e faça deploy.");
  console.log("");

  await pg.end();
  sqlite.close?.();
}

main().catch((err) => {
  console.error("[migrate] Erro fatal:", err);
  process.exit(1);
});
