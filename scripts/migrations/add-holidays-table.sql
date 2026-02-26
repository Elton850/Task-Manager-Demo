-- Migration: adiciona tabela holidays (feriados) para uso com calendário e sync BrasilAPI.
-- Execute no SQL Editor do Supabase se o schema já existir sem esta tabela.

CREATE TABLE IF NOT EXISTS holidays (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL REFERENCES tenants(id),
  date             TEXT NOT NULL,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('national','state','municipal','company')),
  source           TEXT NOT NULL CHECK (source IN ('api','manual')),
  source_provider  TEXT,
  source_id        TEXT,
  active           INTEGER NOT NULL DEFAULT 1,
  metadata_json    TEXT,
  created_at       TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::TEXT,
  created_by       TEXT NOT NULL,
  updated_at       TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::TEXT,
  updated_by       TEXT NOT NULL,
  last_synced_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_holidays_tenant_date   ON holidays(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_holidays_tenant_source ON holidays(tenant_id, source);

ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
