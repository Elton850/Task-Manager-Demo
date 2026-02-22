-- =============================================================================
-- Task Manager — Schema PostgreSQL para Supabase
-- Equivalente a src/db/index.ts (SQLite) traduzido para PostgreSQL.
--
-- Como usar:
--   1. Acesse o SQL Editor do seu projeto Supabase.
--   2. Cole este script e execute.
--   3. Confirme as tabelas no Table Editor / Dashboard.
--
-- Se você já tem o schema antigo (sem allowed_tipos/custom_tipos em rules):
--   Execute scripts/supabase-migration-rules-tipos.sql antes de atualizar o backend.
--
-- Convenções:
--   - snake_case idêntico ao SQLite para facilitar migração de dados e código.
--   - Booleanos: INTEGER 0/1 (igual ao SQLite) — mantém compatibilidade total com
--     as verificações === 0 / === 1 nas rotas do backend sem necessidade de conversão.
--   - Datas: TEXT (ISO string) do SQLite → TEXT no PostgreSQL (mantém compatibilidade
--     com o código que gera/compara ISO strings).  Alternativa futura: TIMESTAMPTZ.
--   - Placeholders: o adapter usa $1, $2,... (node-postgres).
-- =============================================================================

-- ─── Extensões ───────────────────────────────────────────────────────────────
-- uuid-ossp não é obrigatório; UUIDs são gerados no Node (uuid v4).
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABELAS
-- =============================================================================

-- ─── tenants ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id               TEXT PRIMARY KEY,
  slug             TEXT UNIQUE NOT NULL,
  name             TEXT NOT NULL,
  active           INTEGER NOT NULL DEFAULT 1,   -- 0=inativo, 1=ativo (compatível com SQLite)
  created_at       TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::TEXT,
  logo_path        TEXT,
  logo_updated_at  TEXT
);

-- ─── users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                    TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL REFERENCES tenants(id),
  email                 TEXT NOT NULL,
  nome                  TEXT NOT NULL,
  role                  TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER','LEADER','ADMIN')),
  area                  TEXT NOT NULL DEFAULT '',
  active                INTEGER NOT NULL DEFAULT 1,    -- 0=inativo, 1=ativo
  can_delete            INTEGER NOT NULL DEFAULT 0,    -- 0=não, 1=sim
  password_hash         TEXT NOT NULL DEFAULT '',
  must_change_password  INTEGER NOT NULL DEFAULT 1,    -- 0=não, 1=sim
  reset_code_hash       TEXT,
  reset_code_expires_at TEXT,
  created_at            TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::TEXT,
  last_login_at         TEXT,
  last_logout_at        TEXT,
  UNIQUE(tenant_id, email)
);

-- ─── tasks ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id                          TEXT PRIMARY KEY,
  tenant_id                   TEXT NOT NULL REFERENCES tenants(id),
  competencia_ym              TEXT NOT NULL,
  recorrencia                 TEXT NOT NULL,
  tipo                        TEXT NOT NULL,
  atividade                   TEXT NOT NULL,
  responsavel_email           TEXT NOT NULL,
  responsavel_nome            TEXT NOT NULL,
  area                        TEXT NOT NULL,
  prazo                       TEXT,
  realizado                   TEXT,
  status                      TEXT NOT NULL DEFAULT 'Em Andamento',
  observacoes                 TEXT,
  created_at                  TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::TEXT,
  created_by                  TEXT NOT NULL,
  updated_at                  TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::TEXT,
  updated_by                  TEXT NOT NULL,
  deleted_at                  TEXT,
  deleted_by                  TEXT,
  prazo_modified_by           TEXT,
  realizado_por               TEXT,
  parent_task_id              TEXT REFERENCES tasks(id),
  justification_blocked       INTEGER NOT NULL DEFAULT 0,  -- 0=não bloqueado, 1=bloqueado
  justification_blocked_at    TEXT,
  justification_blocked_by    TEXT
);

-- ─── lookups ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lookups (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  category     TEXT NOT NULL,
  value        TEXT NOT NULL,
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::TEXT,
  UNIQUE(tenant_id, category, value)
);

-- ─── rules ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rules (
  id                   TEXT PRIMARY KEY,
  tenant_id            TEXT NOT NULL REFERENCES tenants(id),
  area                 TEXT NOT NULL,
  allowed_recorrencias TEXT NOT NULL DEFAULT '[]',
  allowed_tipos        TEXT,   -- JSON array: tipos globais permitidos para a área (NULL = todos)
  custom_tipos         TEXT,   -- JSON array: tipos criados só para esta área (Leader/Admin)
  default_tipos        TEXT,   -- JSON array: subset de custom_tipos que são "tipos padrão" (para excluir só esses)
  updated_at           TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::TEXT,
  updated_by           TEXT NOT NULL,
  UNIQUE(tenant_id, area)
);

-- ─── task_evidences ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_evidences (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  task_id      TEXT NOT NULL REFERENCES tasks(id),
  file_name    TEXT NOT NULL,
  file_path    TEXT NOT NULL,
  mime_type    TEXT NOT NULL,
  file_size    INTEGER NOT NULL DEFAULT 0,
  uploaded_at  TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::TEXT,
  uploaded_by  TEXT NOT NULL
);

-- ─── login_events ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS login_events (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL REFERENCES tenants(id),
  user_id    TEXT NOT NULL REFERENCES users(id),
  logged_at  TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::TEXT
);

-- ─── task_justifications ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_justifications (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  task_id         TEXT NOT NULL REFERENCES tasks(id),
  description     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','refused')),
  created_at      TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::TEXT,
  created_by      TEXT NOT NULL,
  reviewed_at     TEXT,
  reviewed_by     TEXT,
  review_comment  TEXT
);

-- ─── justification_evidences ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS justification_evidences (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL REFERENCES tenants(id),
  justification_id  TEXT NOT NULL REFERENCES task_justifications(id),
  file_name         TEXT NOT NULL,
  file_path         TEXT NOT NULL,
  mime_type         TEXT NOT NULL,
  file_size         INTEGER NOT NULL DEFAULT 0,
  uploaded_at       TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::TEXT,
  uploaded_by       TEXT NOT NULL
);

-- =============================================================================
-- ÍNDICES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_tasks_tenant           ON tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status    ON tasks(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_area             ON tasks(tenant_id, area);
CREATE INDEX IF NOT EXISTS idx_tasks_resp             ON tasks(tenant_id, responsavel_email);
CREATE INDEX IF NOT EXISTS idx_tasks_ym               ON tasks(tenant_id, competencia_ym);
CREATE INDEX IF NOT EXISTS idx_tasks_parent           ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant           ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lookups_tenant         ON lookups(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_evidence_task          ON task_evidences(task_id);
CREATE INDEX IF NOT EXISTS idx_evidence_tenant        ON task_evidences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_login_events_tenant_user ON login_events(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_login_events_logged_at   ON login_events(logged_at);
CREATE INDEX IF NOT EXISTS idx_justifications_tenant  ON task_justifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_justifications_task    ON task_justifications(task_id);
CREATE INDEX IF NOT EXISTS idx_justifications_status  ON task_justifications(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_just_evidence_just     ON justification_evidences(justification_id);

-- =============================================================================
-- TENANT "system" (SYSTEM_TENANT_ID)
-- =============================================================================

INSERT INTO tenants (id, slug, name, active, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'system',
  'Sistema',
  1,
  (now() AT TIME ZONE 'UTC')::TEXT
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================
-- O backend usa SUPABASE_SERVICE_ROLE_KEY, que ignora RLS por padrão.
-- As políticas abaixo protegem o banco em caso de acesso direto via anon key
-- (ex.: SDK do cliente, REST direto). Ajuste conforme suas necessidades.
--
-- IMPORTANTE: Com service role no backend, RLS é bypassado automaticamente.
-- Habilitar RLS não quebra a aplicação (o backend continua funcionando).

ALTER TABLE tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE lookups              ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules                ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_evidences       ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_justifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE justification_evidences ENABLE ROW LEVEL SECURITY;

-- Política padrão: nega acesso via anon key (o backend usa service role).
-- Se você precisar de acesso via anon key no frontend, adicione políticas
-- específicas com CHECK (auth.uid() IS NOT NULL) ou similar.

-- Exemplo de política restritiva (bloqueia tudo via anon):
-- CREATE POLICY "deny_anon" ON tenants FOR ALL TO anon USING (false);

-- Para backend-only (sem acesso direto do frontend ao Supabase), as políticas
-- acima (ENABLE RLS sem CREATE POLICY) já bloqueiam anon por padrão no Supabase.
