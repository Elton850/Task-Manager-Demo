-- Migration: coluna para inativação em massa por empresa.
-- Ao desativar a empresa, salva-se active em active_before_tenant_deactivation e inativa-se todos.
-- Ao reativar a empresa, restaura-se active apenas para quem tinha valor salvo (quem estava ativo antes).
--
-- Execute no SQL Editor do Supabase se o schema já existir sem esta coluna.

-- Se a coluna já existir, este comando falhará; execute apenas uma vez.
ALTER TABLE users ADD COLUMN active_before_tenant_deactivation INTEGER;
