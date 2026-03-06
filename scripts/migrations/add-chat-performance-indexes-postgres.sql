-- ============================================================
-- Migração: índices de performance para Chat (PostgreSQL/Supabase)
-- Objetivo: reduzir latência em listagem de threads/mensagens e marcação de leitura
-- Seguro para reaplicar (IF NOT EXISTS)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_visible_latest
  ON chat_messages(thread_id, deleted_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_sender_visible
  ON chat_messages(thread_id, sender_id, deleted_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_receipts_user_message
  ON chat_message_receipts(user_id, message_id);

CREATE INDEX IF NOT EXISTS idx_chat_threads_type_updated
  ON chat_threads(tenant_id, type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_events_tenant_type_time
  ON chat_message_events(tenant_id, event_type, event_at DESC);
