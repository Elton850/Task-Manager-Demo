-- Log de execução do job de sincronização de feriados (rastrear sucesso/falha).
-- Execute no SQL Editor do Supabase se o projeto já existia antes desta feature.

CREATE TABLE IF NOT EXISTS holiday_sync_runs (
  id              TEXT PRIMARY KEY,
  started_at      TEXT NOT NULL,
  finished_at     TEXT,
  status          TEXT NOT NULL CHECK (status IN ('running','success','failure')),
  error_message   TEXT,
  tenants_count   INTEGER NOT NULL DEFAULT 0,
  inserted_total  INTEGER NOT NULL DEFAULT 0,
  updated_total   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_holiday_sync_runs_started ON holiday_sync_runs(started_at);
ALTER TABLE holiday_sync_runs ENABLE ROW LEVEL SECURITY;
