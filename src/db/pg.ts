/**
 * Provider PostgreSQL/Supabase — usa node-postgres (pg).
 * Implementa DbAdapter com suporte a transações via AsyncLocalStorage.
 *
 * Variáveis de ambiente necessárias (quando DB_PROVIDER=supabase):
 *   SUPABASE_DB_URL        — connection string PostgreSQL (Supabase Dashboard > Settings > Database)
 *   SUPABASE_SERVICE_ROLE_KEY — usada pelo servidor; NUNCA expor no frontend
 *
 * Transformações SQL (SQLite → PostgreSQL):
 *   ?                    → $1, $2, ... (placeholders posicionais)
 *   datetime('now')      → (NOW() AT TIME ZONE 'UTC')::TEXT
 *   INSERT OR IGNORE INTO → INSERT INTO ... ON CONFLICT DO NOTHING
 *   BEGIN TRANSACTION    → BEGIN
 */

import { Pool, PoolClient, types } from "pg";
import { AsyncLocalStorage } from "async_hooks";
import type { DbAdapter, MaybePromise, PreparedStatement, RunResult } from "./types";

// Parsear BIGINT (int8) como number — COUNT(*) retorna BIGINT no PostgreSQL
// e o pg retorna strings por padrão para BIGINT. Convertemos para number.
types.setTypeParser(20, (val: string) => parseInt(val, 10));

// ─── Contexto de transação por request ───────────────────────────────────────

interface TxContext {
  client: PoolClient | null;
}

/** AsyncLocalStorage para isolar o cliente de transação por async-context (request). */
export const txStorage = new AsyncLocalStorage<TxContext>();

// ─── Pool ─────────────────────────────────────────────────────────────────────

let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    const url = process.env.SUPABASE_DB_URL || "";
    if (!url) {
      throw new Error(
        "[pg] SUPABASE_DB_URL não está definida. " +
        "Obtenha a connection string em: Supabase Dashboard → Settings → Database → Connection string (Session mode). " +
        "Adicione ao .env como SUPABASE_DB_URL=postgresql://..."
      );
    }
    const max = Math.max(1, parseInt(process.env.PG_POOL_MAX ?? "10", 10) || 10);
    const idleTimeout = Math.max(5_000, parseInt(process.env.PG_IDLE_TIMEOUT_MS ?? "30000", 10) || 30_000);
    const connectTimeout = Math.max(2_000, parseInt(process.env.PG_CONNECT_TIMEOUT_MS ?? "10000", 10) || 10_000);
    _pool = new Pool({
      connectionString: url,
      // SSL obrigatório para conexões ao Supabase (desabilite apenas em ambientes locais com SUPABASE_DB_SSL=false)
      ssl: process.env.SUPABASE_DB_SSL === "false" ? false : { rejectUnauthorized: false },
      max,
      idleTimeoutMillis: idleTimeout,
      connectionTimeoutMillis: connectTimeout,
    });
    _pool.on("error", (err) => {
      console.error("[pg] Pool error:", err.message);
    });
  }
  return _pool;
}

// ─── Conversão SQL ────────────────────────────────────────────────────────────

/**
 * Converte SQL SQLite para PostgreSQL:
 * - ? → $1, $2, ... (em ordem de aparição)
 * - datetime('now') → (NOW() AT TIME ZONE 'UTC')::TEXT
 * - INSERT OR IGNORE INTO table → INSERT INTO table ... ON CONFLICT DO NOTHING
 */
function convertSql(sql: string): string {
  const hasInsertOrIgnore = /INSERT\s+OR\s+IGNORE\s+INTO/i.test(sql);

  let converted = sql
    .replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, "INSERT INTO")
    .replace(/datetime\s*\(\s*'now'\s*\)/gi, "(NOW() AT TIME ZONE 'UTC')::TEXT");

  // Substituir ? por $N na ordem de aparição
  let i = 0;
  converted = converted.replace(/\?/g, () => `$${++i}`);

  // Adicionar ON CONFLICT DO NOTHING para INSERT OR IGNORE
  if (hasInsertOrIgnore) {
    converted = converted.trimEnd().replace(/;\s*$/, "") + " ON CONFLICT DO NOTHING";
  }

  return converted;
}

// ─── Execução de query ────────────────────────────────────────────────────────

async function runQuery(
  sql: string,
  params: unknown[]
): Promise<{ rows: Record<string, unknown>[]; rowCount: number }> {
  const convertedSql = convertSql(sql);
  const ctx = txStorage.getStore();

  if (ctx?.client) {
    // Dentro de uma transação — usar o cliente da transação
    const result = await ctx.client.query(convertedSql, params);
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  } else {
    // Sem transação — usar o pool diretamente
    const result = await getPool().query(convertedSql, params);
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  }
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export const SYSTEM_TENANT_ID = "00000000-0000-0000-0000-000000000001";

const pgAdapter: DbAdapter = {
  prepare(sql: string): PreparedStatement {
    return {
      async get(...params: unknown[]): Promise<unknown> {
        const { rows } = await runQuery(sql, params);
        return rows[0] ?? undefined;
      },

      async all(...params: unknown[]): Promise<unknown[]> {
        const { rows } = await runQuery(sql, params);
        return rows;
      },

      async run(...params: unknown[]): Promise<RunResult> {
        const { rowCount } = await runQuery(sql, params);
        return { changes: rowCount, lastInsertRowid: 0 };
      },
    };
  },

  async exec(sql: string): Promise<void> {
    const trimmed = sql.trim().toUpperCase().replace(/\s+/g, " ");

    // ── Transações ──────────────────────────────────────────────────────────
    if (trimmed === "BEGIN" || trimmed === "BEGIN TRANSACTION") {
      const ctx = txStorage.getStore();
      if (!ctx) {
        throw new Error(
          "[pg] exec(\"BEGIN\") chamado fora do contexto withDbContext. " +
          "Certifique-se de que o middleware withDbContext está registrado no servidor."
        );
      }
      if (ctx.client) {
        throw new Error("[pg] Transação já ativa. Não é possível aninhar transações.");
      }
      const client = await getPool().connect();
      try {
        await client.query("BEGIN");
        ctx.client = client;
      } catch (err) {
        client.release();
        throw err;
      }
      return;
    }

    if (trimmed === "COMMIT") {
      const ctx = txStorage.getStore();
      if (!ctx?.client) throw new Error("[pg] COMMIT chamado sem transação ativa.");
      try {
        await ctx.client.query("COMMIT");
      } finally {
        ctx.client.release();
        ctx.client = null;
      }
      return;
    }

    if (trimmed === "ROLLBACK") {
      const ctx = txStorage.getStore();
      if (!ctx?.client) return; // Se não há transação, ignorar silenciosamente
      try {
        await ctx.client.query("ROLLBACK");
      } finally {
        ctx.client.release();
        ctx.client = null;
      }
      return;
    }

    // ── DDL e outros ────────────────────────────────────────────────────────
    // Executar via pool (não via transação ativa, pois DDL geralmente é fora de transação)
    const convertedSql = convertSql(sql);
    await getPool().query(convertedSql);
  },
};

export default pgAdapter;
