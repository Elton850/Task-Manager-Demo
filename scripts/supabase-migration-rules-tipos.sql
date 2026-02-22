-- =============================================================================
-- Migração única: regras — colunas de tipos (Supabase/PostgreSQL)
--
-- Ajusta a tabela rules com:
--   - allowed_tipos: tipos globais permitidos para a área (NULL = todos)
--   - custom_tipos: tipos criados só para a área (Leader/Admin)
--   - default_tipos: subset de custom_tipos que são "tipos padrão" (botão
--     "Excluir apenas tipos padrão")
--
-- Use em: base de teste, staging ou produção.
-- Execute no SQL Editor do projeto Supabase. É idempotente (pode rodar mais de uma vez).
-- Ordem recomendada (produção): backup → executar este script → reiniciar o backend.
-- =============================================================================

-- Tipos globais permitidos por área (NULL = todos). Apenas ADMIN altera.
ALTER TABLE rules ADD COLUMN IF NOT EXISTS allowed_tipos TEXT;

-- Tipos criados somente para a área (Leader/Admin). Não afeta outras áreas.
ALTER TABLE rules ADD COLUMN IF NOT EXISTS custom_tipos TEXT;

-- Tipos que são "padrão" (carregados pelo botão); permite excluir só esses.
ALTER TABLE rules ADD COLUMN IF NOT EXISTS default_tipos TEXT;

-- Limpeza: remover filtro de tipos que possa ter sido definido pelo admin mestre
UPDATE rules SET allowed_tipos = NULL WHERE allowed_tipos IS NOT NULL;
