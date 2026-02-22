# Requisitos de variáveis de ambiente (.env)

## Arquivos .env no projeto

| Arquivo | Status | Uso |
|--------|--------|-----|
| `.env.example` | ✅ Versionado | Modelo genérico; copie para `.env` e ajuste. |
| `.env.development.example` | ✅ Versionado | Template **desenvolvimento local**. Copie para `.env.development`; use `npm run env:dev` para ativar. |
| `.env.staging.example` | ✅ Versionado | Template **staging/testes**. Copie para `.env.staging`; use `npm run env:staging` para ativar. Base separada; link de site teste. |
| `.env.production.example` | ✅ Versionado | Template **produção**. Copie para `.env.production`; use `npm run env:prod` para ativar. |
| `.env` | ❌ Não versionado | Arquivo ativo; criado pelos scripts `env:dev` / `env:staging` / `env:prod` a partir do respectivo `.env.*`. |
| `.env.development` / `.env.staging` / `.env.production` | ❌ Não versionados | Um por ambiente; preencha a partir dos `*.example` e não commite. |

**Para rodar localmente:** use `npm run env:dev` (copia `.env.development` → `.env`) ou crie `.env` a partir de `.env.example`.

**Testes e preparação dos ambientes (passo a passo simples):** veja **`docs/TESTES-E-AMBIENTES.md`** — pré-requisitos, como rodar os testes, seed "demo" e como preparar dev/staging/produção.

---

## Ambientes (development / staging / production)

Use **três ambientes** para testes seguros, sem sujar a base de produção, e para ter links de site de teste para novos updates:

| Ambiente | Objetivo | Base de dados | Como ativar |
|----------|----------|---------------|-------------|
| **Development** | Desenvolvimento local | Preferir **SQLite** (não suja base remota) ou um projeto Supabase de *dev* separado | `npm run env:dev` → copia `.env.development` para `.env` |
| **Staging** | Testes, demos, link de site teste para novos updates | **Supabase dedicado** (projeto de staging, nunca o de produção) | `npm run env:staging` → copia `.env.staging` para `.env`; deploy do frontend/backend com esse `.env` |
| **Production** | Produção, clientes reais | **Supabase de produção** | `npm run env:prod` → copia `.env.production` para `.env`; deploy com esse `.env` |

**Criar os arquivos por ambiente (uma vez):**

1. **Desenvolvimento:** `cp .env.development.example .env.development` e ajuste (recomendado `DB_PROVIDER=sqlite` para não sujar base).
2. **Staging:** `cp .env.staging.example .env.staging`; crie um **projeto Supabase separado** para staging; execute `scripts/supabase-schema.sql` nesse projeto; preencha `SUPABASE_*`, `SUPABASE_DB_URL` e `ALLOWED_ORIGINS`. Passo a passo: **`docs/TESTES-E-AMBIENTES.md`** → "Como criar um ambiente de testes no Supabase (staging)".
3. **Produção:** `cp .env.production.example .env.production`; use projeto Supabase de produção; preencha `SUPABASE_*`, `ALLOWED_ORIGINS`, `JWT_SECRET`, `SUPER_ADMIN_KEY`.

Assim você mantém **base de staging separada** para testes e um **link de site de teste** para validar updates antes de ir para produção.

---

## Rodar localmente (desenvolvimento)

Variáveis **obrigatórias** ou **recomendadas** para o backend subir e funcionar:

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `PORT` | Não (default 3000) | Porta do servidor. |
| `NODE_ENV` | Não (default development) | `development` para local. |
| `JWT_SECRET` | **Sim** (auth usa em todo request) | Mín. 32 caracteres em produção; em dev pode ser qualquer string longa. |
| `SUPER_ADMIN_KEY` | Não (string vazia se omitido) | Necessária para rotas de criação de tenants (super admin). |
| `SYSTEM_ADMIN_EMAIL` | Recomendado | Email do admin do sistema (criado no primeiro start). |
| `SYSTEM_ADMIN_PASSWORD` | Recomendado (mín. 6 caracteres) | Senha do admin do sistema. |
| `SYSTEM_ADMIN_NOME` | Não | Nome exibido do admin (default: "Administrador do Sistema"). |
| `ALLOWED_ORIGINS` | Em prod sim | Para local, o servidor já permite `localhost:5173` e `127.0.0.1:5173`. |
| `DB_PROVIDER` | Não | `sqlite` (padrão) ou `supabase`. Use `sqlite` para desenvolvimento local. |
| `SQLITE_DB_PATH` | Não | Caminho do SQLite (default: `./data/taskmanager.db`). Ignorado quando `DB_PROVIDER=supabase`. |

Opcionais (funcionalidades extras):

- `ALLOWED_HOST_PATTERN` – regex de host em produção.
- `RESEND_API_KEY` e `EMAIL_FROM` – envio de e-mail (ex.: recuperação de senha).

---

## Migração do banco local (SQLite) para Supabase

**Situação atual:** o backend suporta **dois providers**: `DB_PROVIDER=sqlite` (padrão, banco local) e `DB_PROVIDER=supabase` (PostgreSQL via Supabase). A camada de abstração (`src/db/`) roteia automaticamente conforme a variável.

**Validar env Supabase (após preencher as chaves):** rode `npm run validate:supabase`. Só valida quando `DB_PROVIDER=supabase`; não exibe valores das chaves.

Para **ativar o Supabase** como banco de dados:

1. **Configurar o projeto no Supabase** e obter:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (só no backend, nunca no frontend)
   - `SUPABASE_DB_URL` — connection string PostgreSQL (Dashboard → Settings → Database → Connection string → Session mode)

2. **Criar o schema no Supabase:** execute `scripts/supabase-schema.sql` no SQL Editor do Supabase Dashboard. Cria todas as tabelas, índices e habilita RLS.

3. **Migrar dados (opcional):** se tiver dados no SQLite local, rode:
   ```bash
   npm run migrate:supabase
   ```
   O script lê o SQLite em modo somente-leitura e insere no Supabase respeitando a ordem das FKs. É idempotente (usa `ON CONFLICT DO NOTHING`).

4. **Ativar o provider:** defina `DB_PROVIDER=supabase` no `.env` e reinicie o servidor.

O `.env` para **rodar apontando ao Supabase** deve conter:

| Variável | Uso |
|----------|-----|
| `DB_PROVIDER=supabase` | Backend usa Supabase em vez de SQLite. |
| `SUPABASE_URL` | URL do projeto (ex.: `https://xxxx.supabase.co`). |
| `SUPABASE_ANON_KEY` | Chave anon (uso público/frontend). |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role (apenas backend; nunca no frontend). |
| `SUPABASE_DB_URL` | Connection string PostgreSQL (Session mode). Obrigatória para `DB_PROVIDER=supabase`. |

---

## Checklist rápido

- [ ] **Por ambiente:** copiar cada `.env.*.example` para `.env.development` / `.env.staging` / `.env.production` (conforme usar) e preencher; não versionar os `.env.*` (só os `.example`).
- [ ] **Desenvolvimento:** `npm run env:dev` usa `.env.development`; recomendado `DB_PROVIDER=sqlite` para não sujar base remota.
- [ ] **Staging:** projeto Supabase separado; preencher `ALLOWED_ORIGINS` com URL do site de teste; `npm run env:staging` antes do deploy de staging.
- [ ] **Produção:** `npm run env:prod` antes do deploy; definir `JWT_SECRET` (mín. 32 caracteres), `SUPER_ADMIN_KEY`, `ALLOWED_ORIGINS`.
- [ ] Definir `SYSTEM_ADMIN_EMAIL` e `SYSTEM_ADMIN_PASSWORD` em cada arquivo `.env.*` que usar.
- [ ] Quando usar Supabase em qualquer ambiente: definir `DB_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_DB_URL`; rodar `npm run validate:supabase` após preencher as chaves; executar `scripts/supabase-schema.sql` no Supabase antes de subir o servidor.
