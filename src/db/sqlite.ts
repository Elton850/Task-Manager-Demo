/**
 * Provider SQLite — usa node:sqlite (Node ≥ 22.5).
 * Implementa DbAdapter sobre DatabaseSync.
 * Comportamento idêntico ao src/db/index.ts original.
 */
import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";
import type { DbAdapter, PreparedStatement, RunResult, MaybePromise } from "./types";

const defaultDbPath = path.resolve(process.cwd(), "data", "taskmanager.db");
const DB_PATH = path.resolve(
  process.cwd(),
  process.env.SQLITE_DB_PATH || defaultDbPath
);

// Garante que o diretório existe
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const rawDb = new DatabaseSync(DB_PATH);

// Otimizações de performance
rawDb.exec("PRAGMA journal_mode = WAL");
rawDb.exec("PRAGMA foreign_keys = ON");
rawDb.exec("PRAGMA synchronous = NORMAL");

// ─── Schema ──────────────────────────────────────────────────────────────────
rawDb.exec(`
  CREATE TABLE IF NOT EXISTS tenants (
    id          TEXT PRIMARY KEY,
    slug        TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id                    TEXT PRIMARY KEY,
    tenant_id             TEXT NOT NULL REFERENCES tenants(id),
    email                 TEXT NOT NULL,
    nome                  TEXT NOT NULL,
    role                  TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER','LEADER','ADMIN')),
    area                  TEXT NOT NULL DEFAULT '',
    active                INTEGER NOT NULL DEFAULT 1,
    can_delete            INTEGER NOT NULL DEFAULT 0,
    password_hash         TEXT NOT NULL DEFAULT '',
    must_change_password  INTEGER NOT NULL DEFAULT 1,
    reset_code_hash       TEXT,
    reset_code_expires_at TEXT,
    created_at            TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, email)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id                TEXT PRIMARY KEY,
    tenant_id         TEXT NOT NULL REFERENCES tenants(id),
    competencia_ym    TEXT NOT NULL,
    recorrencia       TEXT NOT NULL,
    tipo              TEXT NOT NULL,
    atividade         TEXT NOT NULL,
    responsavel_email TEXT NOT NULL,
    responsavel_nome  TEXT NOT NULL,
    area              TEXT NOT NULL,
    prazo             TEXT,
    realizado         TEXT,
    status            TEXT NOT NULL DEFAULT 'Em Andamento',
    observacoes       TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    created_by        TEXT NOT NULL,
    updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_by        TEXT NOT NULL,
    deleted_at        TEXT,
    deleted_by        TEXT
  );

  CREATE TABLE IF NOT EXISTS lookups (
    id          TEXT PRIMARY KEY,
    tenant_id   TEXT NOT NULL REFERENCES tenants(id),
    category    TEXT NOT NULL,
    value       TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, category, value)
  );

  CREATE TABLE IF NOT EXISTS rules (
    id                    TEXT PRIMARY KEY,
    tenant_id             TEXT NOT NULL REFERENCES tenants(id),
    area                  TEXT NOT NULL,
    allowed_recorrencias  TEXT NOT NULL DEFAULT '[]',
    updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
    updated_by            TEXT NOT NULL,
    UNIQUE(tenant_id, area)
  );

  CREATE TABLE IF NOT EXISTS task_evidences (
    id           TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL REFERENCES tenants(id),
    task_id      TEXT NOT NULL REFERENCES tasks(id),
    file_name    TEXT NOT NULL,
    file_path    TEXT NOT NULL,
    mime_type    TEXT NOT NULL,
    file_size    INTEGER NOT NULL DEFAULT 0,
    uploaded_at  TEXT NOT NULL DEFAULT (datetime('now')),
    uploaded_by  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_tenant    ON tasks(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status ON tasks(tenant_id, status);
  CREATE INDEX IF NOT EXISTS idx_tasks_area      ON tasks(tenant_id, area);
  CREATE INDEX IF NOT EXISTS idx_tasks_resp      ON tasks(tenant_id, responsavel_email);
  CREATE INDEX IF NOT EXISTS idx_tasks_ym        ON tasks(tenant_id, competencia_ym);
  CREATE INDEX IF NOT EXISTS idx_users_tenant    ON users(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_lookups_tenant  ON lookups(tenant_id, category);

  CREATE TABLE IF NOT EXISTS login_events (
    id         TEXT PRIMARY KEY,
    tenant_id  TEXT NOT NULL REFERENCES tenants(id),
    user_id    TEXT NOT NULL REFERENCES users(id),
    logged_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_evidence_task   ON task_evidences(task_id);
  CREATE INDEX IF NOT EXISTS idx_evidence_tenant ON task_evidences(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_login_events_tenant_user ON login_events(tenant_id, user_id);
  CREATE INDEX IF NOT EXISTS idx_login_events_logged_at ON login_events(logged_at);
`);

// ─── Tenant "system" ─────────────────────────────────────────────────────────
const SYSTEM_TENANT_ID = "00000000-0000-0000-0000-000000000001";
try {
  rawDb
    .prepare(
      "INSERT OR IGNORE INTO tenants (id, slug, name, active, created_at) VALUES (?, 'system', 'Sistema', 1, datetime('now'))"
    )
    .run(SYSTEM_TENANT_ID);
} catch {
  // ignorar se já existir
}

// ─── Migrations inline ───────────────────────────────────────────────────────
try {
  const cols = rawDb.prepare("PRAGMA table_info(tenants)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "logo_path"))
    rawDb.exec("ALTER TABLE tenants ADD COLUMN logo_path TEXT");
} catch { /* ignorar */ }

try {
  const cols = rawDb.prepare("PRAGMA table_info(tenants)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "logo_updated_at")) {
    rawDb.exec("ALTER TABLE tenants ADD COLUMN logo_updated_at TEXT");
    rawDb.exec("UPDATE tenants SET logo_updated_at = datetime('now') WHERE logo_path IS NOT NULL AND logo_path != ''");
  }
} catch { /* ignorar */ }

try {
  const userCols = rawDb.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (!userCols.some((c) => c.name === "last_login_at"))
    rawDb.exec("ALTER TABLE users ADD COLUMN last_login_at TEXT");
  if (!userCols.some((c) => c.name === "last_logout_at"))
    rawDb.exec("ALTER TABLE users ADD COLUMN last_logout_at TEXT");
  if (!userCols.some((c) => c.name === "active_before_tenant_deactivation"))
    rawDb.exec("ALTER TABLE users ADD COLUMN active_before_tenant_deactivation INTEGER");
} catch { /* ignorar */ }

try {
  const taskCols = rawDb.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
  if (!taskCols.some((c) => c.name === "prazo_modified_by"))
    rawDb.exec("ALTER TABLE tasks ADD COLUMN prazo_modified_by TEXT");
  if (!taskCols.some((c) => c.name === "realizado_por"))
    rawDb.exec("ALTER TABLE tasks ADD COLUMN realizado_por TEXT");
} catch { /* ignorar */ }

try {
  const taskCols = rawDb.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
  if (!taskCols.some((c) => c.name === "parent_task_id")) {
    rawDb.exec("ALTER TABLE tasks ADD COLUMN parent_task_id TEXT REFERENCES tasks(id)");
    rawDb.exec("CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id)");
  }
} catch { /* ignorar */ }

try {
  const taskCols = rawDb.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
  if (!taskCols.some((c) => c.name === "justification_blocked"))
    rawDb.exec("ALTER TABLE tasks ADD COLUMN justification_blocked INTEGER NOT NULL DEFAULT 0");
  if (!taskCols.some((c) => c.name === "justification_blocked_at"))
    rawDb.exec("ALTER TABLE tasks ADD COLUMN justification_blocked_at TEXT");
  if (!taskCols.some((c) => c.name === "justification_blocked_by"))
    rawDb.exec("ALTER TABLE tasks ADD COLUMN justification_blocked_by TEXT");
} catch { /* ignorar */ }

try {
  const rulesCols = rawDb.prepare("PRAGMA table_info(rules)").all() as { name: string }[];
  if (!rulesCols.some((c) => c.name === "allowed_tipos"))
    rawDb.exec("ALTER TABLE rules ADD COLUMN allowed_tipos TEXT");
  if (!rulesCols.some((c) => c.name === "custom_tipos"))
    rawDb.exec("ALTER TABLE rules ADD COLUMN custom_tipos TEXT");
  if (!rulesCols.some((c) => c.name === "default_tipos"))
    rawDb.exec("ALTER TABLE rules ADD COLUMN default_tipos TEXT");
  if (!rulesCols.some((c) => c.name === "custom_recorrencias"))
    rawDb.exec("ALTER TABLE rules ADD COLUMN custom_recorrencias TEXT");
  if (!rulesCols.some((c) => c.name === "default_recorrencias"))
    rawDb.exec("ALTER TABLE rules ADD COLUMN default_recorrencias TEXT");
} catch { /* ignorar */ }

// Limpeza: remover filtro de tipos que possa ter sido definido pelo admin mestre; ficam só tipos globais + customTipos (Leader)
try {
  rawDb.exec("UPDATE rules SET allowed_tipos = NULL WHERE allowed_tipos IS NOT NULL");
} catch { /* ignorar */ }

try {
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS task_justifications (
      id           TEXT PRIMARY KEY,
      tenant_id    TEXT NOT NULL REFERENCES tenants(id),
      task_id      TEXT NOT NULL REFERENCES tasks(id),
      description  TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','refused')),
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      created_by   TEXT NOT NULL,
      reviewed_at  TEXT,
      reviewed_by  TEXT,
      review_comment TEXT
    )
  `);
  rawDb.exec("CREATE INDEX IF NOT EXISTS idx_justifications_tenant ON task_justifications(tenant_id)");
  rawDb.exec("CREATE INDEX IF NOT EXISTS idx_justifications_task ON task_justifications(task_id)");
  rawDb.exec("CREATE INDEX IF NOT EXISTS idx_justifications_status ON task_justifications(tenant_id, status)");
} catch { /* ignorar */ }

try {
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS justification_evidences (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL REFERENCES tenants(id),
      justification_id TEXT NOT NULL REFERENCES task_justifications(id),
      file_name       TEXT NOT NULL,
      file_path       TEXT NOT NULL,
      mime_type       TEXT NOT NULL,
      file_size       INTEGER NOT NULL DEFAULT 0,
      uploaded_at     TEXT NOT NULL DEFAULT (datetime('now')),
      uploaded_by     TEXT NOT NULL
    )
  `);
  rawDb.exec("CREATE INDEX IF NOT EXISTS idx_just_evidence_just ON justification_evidences(justification_id)");
} catch { /* ignorar */ }

// ─── holidays (feriados: API + manual, multi-tenant) ────────────────────────
try {
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS holidays (
      id                TEXT PRIMARY KEY,
      tenant_id         TEXT NOT NULL REFERENCES tenants(id),
      date              TEXT NOT NULL,
      name              TEXT NOT NULL,
      type              TEXT NOT NULL CHECK (type IN ('national','state','municipal','company')),
      source            TEXT NOT NULL CHECK (source IN ('api','manual')),
      source_provider    TEXT,
      source_id         TEXT,
      active            INTEGER NOT NULL DEFAULT 1,
      metadata_json     TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      created_by        TEXT NOT NULL,
      updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by        TEXT NOT NULL,
      last_synced_at    TEXT
    )
  `);
  rawDb.exec("CREATE INDEX IF NOT EXISTS idx_holidays_tenant_date ON holidays(tenant_id, date)");
  rawDb.exec("CREATE INDEX IF NOT EXISTS idx_holidays_tenant_source ON holidays(tenant_id, source)");
} catch { /* ignorar */ }

// ─── holiday_sync_runs (log de execução do job de sync de feriados) ───────────
try {
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS holiday_sync_runs (
      id               TEXT PRIMARY KEY,
      started_at       TEXT NOT NULL,
      finished_at      TEXT,
      status           TEXT NOT NULL CHECK (status IN ('running','success','failure')),
      error_message    TEXT,
      tenants_count    INTEGER NOT NULL DEFAULT 0,
      inserted_total   INTEGER NOT NULL DEFAULT 0,
      updated_total    INTEGER NOT NULL DEFAULT 0
    )
  `);
  rawDb.exec("CREATE INDEX IF NOT EXISTS idx_holiday_sync_runs_started ON holiday_sync_runs(started_at)");
} catch { /* ignorar */ }

// ─── chat (mensagens diretas entre usuários, multi-tenant) ───────────────────
try {
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS chat_threads (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL REFERENCES tenants(id),
      type        TEXT NOT NULL CHECK (type IN ('direct','subtask')),
      subtask_id  TEXT REFERENCES tasks(id),
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_thread_participants (
      id            TEXT PRIMARY KEY,
      thread_id     TEXT NOT NULL REFERENCES chat_threads(id),
      user_id       TEXT NOT NULL REFERENCES users(id),
      unread_count  INTEGER NOT NULL DEFAULT 0,
      last_read_at  TEXT,
      joined_at     TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(thread_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL REFERENCES tenants(id),
      thread_id   TEXT NOT NULL REFERENCES chat_threads(id),
      sender_id   TEXT NOT NULL REFERENCES users(id),
      content     TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS chat_message_receipts (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL REFERENCES tenants(id),
      message_id  TEXT NOT NULL REFERENCES chat_messages(id),
      user_id     TEXT NOT NULL REFERENCES users(id),
      read_at     TEXT NOT NULL,
      UNIQUE(message_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS chat_message_events (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL REFERENCES tenants(id),
      message_id  TEXT NOT NULL REFERENCES chat_messages(id),
      user_id     TEXT NOT NULL,
      event_type  TEXT NOT NULL CHECK (event_type IN ('sent','delivered','read')),
      event_at    TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chat_threads_tenant   ON chat_threads(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_chat_threads_updated  ON chat_threads(tenant_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_chat_participants_thread ON chat_thread_participants(thread_id);
    CREATE INDEX IF NOT EXISTS idx_chat_participants_user   ON chat_thread_participants(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_thread  ON chat_messages(thread_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant  ON chat_messages(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_chat_receipts_message ON chat_message_receipts(message_id);
    CREATE INDEX IF NOT EXISTS idx_chat_receipts_user    ON chat_message_receipts(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_events_message   ON chat_message_events(message_id);
  `);
} catch { /* ignorar se já existir */ }

// ─── Adapter wrapper ─────────────────────────────────────────────────────────
// Envolve DatabaseSync na interface DbAdapter para que o código do index.ts
// possa retornar o mesmo objeto tanto para SQLite quanto para PostgreSQL.

function wrapStatement(stmt: ReturnType<DatabaseSync["prepare"]>): PreparedStatement {
  return {
    get(...params: unknown[]): MaybePromise<unknown> {
      return stmt.get(...(params as Parameters<typeof stmt.get>));
    },
    all(...params: unknown[]): MaybePromise<unknown[]> {
      return stmt.all(...(params as Parameters<typeof stmt.all>)) as unknown[];
    },
    run(...params: unknown[]): MaybePromise<RunResult> {
      const r = stmt.run(...(params as Parameters<typeof stmt.run>));
      return {
        changes: Number(r.changes),
        lastInsertRowid: r.lastInsertRowid,
      };
    },
  };
}

const sqliteAdapter: DbAdapter = {
  prepare(sql: string): PreparedStatement {
    return wrapStatement(rawDb.prepare(sql));
  },
  exec(sql: string): void {
    rawDb.exec(sql);
  },
};

export { SYSTEM_TENANT_ID };
export default sqliteAdapter;
