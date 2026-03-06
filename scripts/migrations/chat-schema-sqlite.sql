-- ============================================================
-- Migração: Sistema de Chat Interno
-- Banco: SQLite (dev/local)
-- Aplicar em: novos installs ou via migração incremental
-- ============================================================

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

CREATE INDEX IF NOT EXISTS idx_chat_threads_tenant      ON chat_threads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_updated     ON chat_threads(tenant_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_chat_participants_thread ON chat_thread_participants(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user   ON chat_thread_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread     ON chat_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant     ON chat_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_receipts_message    ON chat_message_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_receipts_user       ON chat_message_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_events_message      ON chat_message_events(message_id);
