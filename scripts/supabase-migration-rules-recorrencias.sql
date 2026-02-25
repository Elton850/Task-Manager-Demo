-- =============================================================================
-- Migração: tabela rules — colunas custom_recorrencias e default_recorrencias
--
-- Equivalente ao que o SQLite faz em src/db/sqlite.ts (ALTER TABLE rules).
-- Necessário para a migração SQLite → Supabase (npm run migrate:supabase)
-- não falhar com: column "custom_recorrencias" of relation "rules" does not exist.
--
-- Execute no SQL Editor do projeto Supabase. É idempotente.
-- =============================================================================

ALTER TABLE rules ADD COLUMN IF NOT EXISTS custom_recorrencias TEXT;
ALTER TABLE rules ADD COLUMN IF NOT EXISTS default_recorrencias TEXT;
