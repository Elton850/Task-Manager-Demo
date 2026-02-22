# Prompt Mestre: Migração do Task-Manager para Supabase

Este documento é seu **prompt estruturado** para usar com Claude (ou outra IA de código) e realizar a migração do banco de dados do **Task-Manager** de **SQLite** para **Supabase (PostgreSQL)** de forma **segura, eficiente, testada e validada**, passo a passo.

**Contexto de uso:** O projeto é um **produto para venda e comercialização**. Você é o **único desenvolvedor** — não há repasse para terceiros. O texto está focado em você: referência pessoal, deploy do produto e qualidade para comercialização (segurança, testes, manutenção futura por você).

---

## Como usar este prompt

1. **No Claude Code:** use o prompt pronto em **`docs/PROMPT-CLAUDE-CODE-MIGRACAO.md`** — lá está o texto para colar, com instrução para o Claude ler este documento e executar as fases.
2. **Leia o contexto do projeto** (seção abaixo) para refrescar o estado atual.
3. **Siga as fases na ordem** (Fase 0 → Fase 5). Não pule fases.
4. **Valide cada fase** antes de avançar (testes, checklist).

---

## Contexto do projeto

### Stack atual
- **Backend:** Node.js, Express, TypeScript (CommonJS), `ts-node-dev`.
- **Frontend:** React 18, Vite, TypeScript (em `frontend/`); não precisa alterar para a migração do banco.
- **Banco atual:** SQLite via módulo nativo `node:sqlite` (Node ≥ 22.5). Sem ORM.

### Onde está o banco
- **Único arquivo de acesso:** `src/db/index.ts`.
  - Cria o schema com `CREATE TABLE IF NOT EXISTS` e índices.
  - Contém “migrations” inline (PRAGMA table_info + ALTER TABLE / CREATE TABLE).
  - Exporta `db` (instância `DatabaseSync`) e `SYSTEM_TENANT_ID`.
- **Uso do `db`:** Todas as rotas e seeds importam `import db from "../db"` (ou `"../src/db"`) e usam:
  - `db.prepare(sql).get(...params)` → um registro ou undefined
  - `db.prepare(sql).all(...params)` → array de registros
  - `db.prepare(sql).run(...params)` → `{ changes, lastInsertRowid }`
  - `db.exec(sql)` → void
- **Placeholders:** Sempre `?` (positional). Ex.: `WHERE tenant_id = ? AND email = ?`.
- **Tipos no SQLite:** INTEGER para boolean (0/1), TEXT para datas (ISO string ou `datetime('now')`).

### Tabelas e relacionamentos (schema atual)
- **tenants** — id (TEXT PK), slug, name, active, created_at, logo_path, logo_updated_at
- **users** — id, tenant_id (FK tenants), email, nome, role, area, active, can_delete, password_hash, must_change_password, reset_code_*, created_at, last_login_at, last_logout_at
- **tasks** — id, tenant_id (FK), competencia_ym, recorrencia, tipo, atividade, responsavel_*, area, prazo, realizado, status, observacoes, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, prazo_modified_by, realizado_por, parent_task_id, justification_blocked*
- **lookups** — id, tenant_id, category, value, order_index, created_at
- **rules** — id, tenant_id, area, allowed_recorrencias (JSON text), updated_at, updated_by
- **task_evidences** — id, tenant_id, task_id, file_name, file_path, mime_type, file_size, uploaded_at, uploaded_by
- **login_events** — id, tenant_id, user_id, logged_at
- **task_justifications** — id, tenant_id, task_id, description, status, created_at, created_by, reviewed_at, reviewed_by, review_comment
- **justification_evidences** — id, tenant_id, justification_id, file_name, file_path, mime_type, file_size, uploaded_at, uploaded_by

Constante: `SYSTEM_TENANT_ID = "00000000-0000-0000-0000-000000000001"`. Tenant "system" inserido na inicialização.

### Arquivos que importam o DB (não quebrar assinaturas)
- `src/db/index.ts`, `src/db/seed.ts`, `src/db/seedLocal.ts`, `src/db/seedSystemAdmin.ts`
- `src/middleware/tenant.ts`
- `src/routes/auth.ts`, `src/routes/tasks.ts`, `src/routes/justifications.ts`, `src/routes/users.ts`, `src/routes/lookups.ts`, `src/routes/rules.ts`, `src/routes/tenants.ts`, `src/routes/system.ts`
- `tests/security.test.ts`

### Variáveis de ambiente
- Já existem no `.env.example`: `DB_PROVIDER`, `SQLITE_DB_PATH`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Regra de segurança:** `SUPABASE_SERVICE_ROLE_KEY` só no backend; nunca expor no frontend.

### Arquivos em disco (evidências e logos)
- Evidências de tarefas: paths em `task_evidences.file_path` e `justification_evidences.file_path`.
- Logos de tenants: `data/uploads/tenants/`. Na migração, considerar Supabase Storage para esses arquivos (pode ser fase posterior ou opcional).

### Testes
- Jest em `tests/`. Único arquivo: `tests/security.test.ts` (CSRF, auth, multi-tenant, CORS, etc.).
- Os testes importam `app` e `db`; hoje usam SQLite real (seed "demo"). Após migração, manter testes passando com `DB_PROVIDER=sqlite` ou, se optar por Supabase em testes, usar projeto de teste ou local.

---

## Objetivos da migração (o que a IA deve entregar)

1. **Schema PostgreSQL no Supabase** equivalente ao SQLite atual (tipos, FKs, índices, CHECKs).
2. **Abstração de acesso ao banco** no backend: quando `DB_PROVIDER=supabase`, usar Supabase; quando `sqlite`, manter comportamento atual. **Não alterar a assinatura pública** do que as rotas usam (ou criar uma interface mínima que ambos os providers implementem).
3. **Script de migração de dados** SQLite → Supabase (exportar de `data/taskmanager.db` e importar no Supabase), com ordem respeitando FKs e validação de contagens.
4. **Variáveis de ambiente** documentadas e validadas no arranque quando `DB_PROVIDER=supabase` — suficiente para você configurar e fazer deploy do produto.
5. **Testes** existentes continuando a passar; você poderá rodar `npm run test` localmente ou no seu fluxo de build.
6. **Segurança:** sem expor service role no frontend; RLS no Supabase onde fizer sentido; nenhum SQL com concatenação de input do usuário (usar parâmetros). Essencial para produto comercial.

---

## Riscos a evitar (instruções explícitas para a IA)

- **Não** alterar a lógica de negócio das rotas; apenas o meio de acesso aos dados.
- **Não** usar `SUPABASE_SERVICE_ROLE_KEY` no frontend ou em variáveis expostas.
- **Não** construir SQL com concatenação de strings do usuário; usar sempre parâmetros/placeholders.
- **Não** remover ou quebrar suporte a `DB_PROVIDER=sqlite` (manter compatibilidade).
- **Não** pular validação de variáveis de ambiente em produção quando `DB_PROVIDER=supabase`.
- **Não** fazer migração de dados em produção sem backup e sem teste em staging/local primeiro.

---

## Fases da migração (ordem obrigatória)

### Fase 0 — Pré-requisitos e validações
- Confirmar que o projeto tem `.env.example` com `DB_PROVIDER`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Você cria um projeto no Supabase (dashboard) e obtém as chaves; o doc/IA pode lembrar esse passo.
- Opcional: script ou checklist que valide presença e formato das variáveis quando `DB_PROVIDER=supabase` (ex.: URL válida, keys não vazias).
- Garantir que `npm run test` passa com o estado atual (SQLite).

**Validação:** Testes passando; env documentado o suficiente para você e para deploy (ex.: `docs/ENV-REQUISITOS.md`).

**Estado atual (Fase 0 já adequada):** Os testes (`npm run test`) passam (16 testes). Existe o script `npm run validate:supabase` para validar variáveis quando `DB_PROVIDER=supabase`. O `docs/ENV-REQUISITOS.md` referencia este guia e o prompt em `docs/PROMPT-CLAUDE-CODE-MIGRACAO.md`. O Claude Code deve começar pela Fase 1 (schema no Supabase) ou repetir Fase 0 se quiser revalidar.

---

### Fase 1 — Schema no Supabase (PostgreSQL)
- Gerar script SQL (ou migrations Supabase) que criem no Supabase as tabelas equivalentes ao `src/db/index.ts`:
  - Traduzir tipos: TEXT → TEXT/VARCHAR, INTEGER (boolean) → BOOLEAN, datetime('now') → DEFAULT (now() AT TIME ZONE 'UTC') ou timestamptz.
  - Manter nomes de colunas em snake_case e mesmos nomes de tabelas para facilitar migração de dados e código.
  - Criar FKs, índices e CHECKs equivalentes.
- Incluir inserção do tenant "system" (SYSTEM_TENANT_ID) se não existir.
- Considerar Row Level Security (RLS): políticas que restrinjam acesso por `tenant_id` quando o acesso for via anon key; no backend com service role a aplicação pode bypassar RLS conforme documentação Supabase.
- **Não** alterar ainda o código do backend; apenas criar o schema no Supabase.

**Validação:** Executar o script no projeto Supabase; conferir tabelas, índices e tenant system no dashboard.

---

### Fase 2 — Abstração de acesso ao banco no backend
- Definir uma **interface mínima** que o código atual espera do `db` (ex.: `prepare(sql).get(...)`, `prepare(sql).all(...)`, `prepare(sql).run(...)`, `exec(sql)`). Listar todos os usos em `src/` para não esquecer nenhum.
- Implementar **dois providers**:
  - **SQLite:** manter o comportamento atual em `src/db/index.ts` (ou mover para `src/db/sqlite.ts`) e exportar o mesmo objeto que implementa essa interface.
  - **Supabase:** novo módulo (ex.: `src/db/supabase.ts` ou `src/db/supabaseClient.ts`) que, com `@supabase/supabase-js`, implemente a mesma interface. Como o Supabase usa API REST/PostgREST e não `prepare().get()`, a implementação será um **adapter**: traduzir cada `prepare(sql).get(params)` em chamada ao Supabase (ex.: `.from(...).select().match(...).single()` ou query RPC). Para queries complexas, pode ser necessário usar `.rpc()` com funções SQL criadas no Supabase ou uma conexão PostgreSQL direta (ex.: `pg`) com prepared statements; decidir conforme complexidade.
- **Escolha de implementação:** Se houver muitas queries SQL cruas e complexas, uma opção é usar o cliente `pg` (node-postgres) com `SUPABASE_URL` convertida em connection string do Postgres (Supabase expõe connection string na dashboard) e implementar a interface `prepare().get/all/run` em cima de `pg` (prepared statements com $1, $2). Isso mantém o mesmo SQL com pequenas alterações (?) → ($1, $2). Outra opção é mapear cada query para chamadas Supabase client; mais trabalho, menos SQL direto.
- Em `src/db/index.ts` (ou ponto único de entrada): ler `process.env.DB_PROVIDER`; se `supabase`, exportar o adapter Supabase; senão, exportar o SQLite. Exportar sempre `SYSTEM_TENANT_ID`.
- Garantir que **nenhum** arquivo que importa `db` precise mudar de assinatura (apenas o objeto exportado muda de implementação interna).

**Validação:** Com `DB_PROVIDER=sqlite`, `npm run test` e fluxo manual (login, tarefas) iguais. Com `DB_PROVIDER=supabase` e banco vazio (apenas schema), falhas esperadas por falta de dados; mas sem erros de sintaxe ou de interface.

---

### Fase 3 — Migração de dados (SQLite → Supabase)
- Criar script (Node/TS ou SQL) que:
  1. Leia o SQLite em `data/taskmanager.db` (ou `SQLITE_DB_PATH`).
  2. Exporte dados na ordem das FKs: tenants → users → lookups, rules, tasks → task_evidences, login_events, task_justifications → justification_evidences.
  3. Insira no Supabase via API (service role) ou via conexão PostgreSQL (INSERT). Tratar conflitos (ex.: tenant system já existente) com ON CONFLICT ou ignore.
  4. Comparar contagens (número de linhas por tabela) entre SQLite e Supabase após a carga e reportar divergências.
- Documentar uso do script (variáveis necessárias, comando npm) para você rodar quando for migrar (local ou cliente).
- **Não** rodar em produção sem backup do SQLite e sem testar antes em ambiente de teste/staging.

**Validação:** Rodar script em ambiente local; conferir contagens e amostra de dados no dashboard Supabase; rodar backend com `DB_PROVIDER=supabase` e testar login e listagem de tarefas.

---

### Fase 4 — Arquivos (evidências e logos) — opcional
- Hoje: evidências e logos em disco (`file_path`, `data/uploads/tenants/`). Para produto comercial você pode:
  - **A)** Manter em disco e apenas apontar paths no Supabase (mesmo valor de `file_path`); ou
  - **B)** Migrar para Supabase Storage (buckets por tenant ou único com prefixos), atualizar `file_path` e adaptar rotas de download.
- Fazer primeiro as fases 0–3 e 5 (dados relacionais e env); arquivos em etapa posterior se quiser ofertar storage na nuvem.

**Validação:** Se implementado, listar e baixar evidência e logo pelo app e conferir conteúdo.

---

### Fase 5 — Ambiente, testes e documentação
- **Env:** No arranque do servidor (`src/server.ts`), quando `DB_PROVIDER=supabase`, validar presença de `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (e opcionalmente `SUPABASE_ANON_KEY`). Se faltar, falhar com mensagem clara.
- **Testes:** Manter `npm run test` passando. Se os testes dependerem de SQLite, manter `DB_PROVIDER=sqlite` no ambiente de teste ou documentar como você pode rodar testes contra Supabase (ex.: projeto de teste, seed específico).
- **Documentação:** Atualizar `docs/ENV-REQUISITOS.md` e `.env.example` com o necessário para migração e uso com Supabase (para você e para deploy do produto). Incluir aviso de não expor service role no frontend.

**Validação:** `npm run test` verde; servidor inicia com `DB_PROVIDER=supabase` só quando as variáveis estiverem definidas; documentação suficiente para você operar e vender/deployar o produto.

---

## Checklist de segurança (a IA deve garantir)

Indispensável para produto comercial e para você manter o controle e a integridade:

- [ ] Nenhuma chave Supabase (principalmente service role) no frontend ou em repositório versionado.
- [ ] Todas as queries que usam input do usuário usam parâmetros/placeholders, nunca concatenação.
- [ ] RLS considerado no Supabase para tabelas sensíveis (tenant_id); backend com service role pode contornar quando necessário.
- [ ] Variáveis de ambiente sensíveis validadas no arranque em produção quando `DB_PROVIDER=supabase`.
- [ ] Script de migração de dados não expõe credenciais em logs; usar variáveis de ambiente.

---

## Prompt mestre (copiar e colar para a IA)

Use o bloco abaixo como prompt único ou por fases. Ajuste `[CAMINHO_RAIZ]` e `[FASE]` (ex.: "Fase 1" ou "Fases 0 a 2").

```
Você é um engenheiro de software realizando a migração do banco de dados do projeto Task-Manager de SQLite para Supabase (PostgreSQL). O projeto está em [CAMINHO_RAIZ].

CONTEXTO: Este é um produto para comercialização; o dono do repositório é o único desenvolvedor (não há repasse para outros). Entregue código e documentação prontos para ele operar e fazer deploy — sem foco em onboarding de terceiros.

CONTEXTO OBRIGATÓRIO:
- Backend: Express + TypeScript. Banco atual: SQLite via node:sqlite em src/db/index.ts (schema + migrations inline). Sem ORM.
- Todas as rotas e seeds importam "db" de src/db e usam: db.prepare(sql).get(...), .all(...), .run(...) e db.exec(sql). Placeholders são "?" (positional).
- Tabelas: tenants, users, tasks, lookups, rules, task_evidences, login_events, task_justifications, justification_evidences. Multi-tenant por tenant_id. SYSTEM_TENANT_ID = "00000000-0000-0000-0000-000000000001".
- Arquivos que usam db: src/db/index.ts, src/db/seed*.ts, src/middleware/tenant.ts, src/routes/*.ts (auth, tasks, justifications, users, lookups, rules, tenants, system), tests/security.test.ts.
- .env.example já tem DB_PROVIDER, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Service role NUNCA no frontend.

OBJETIVOS:
1. Schema PostgreSQL no Supabase equivalente ao SQLite (tipos, FKs, índices, CHECKs; tenant "system" inserido).
2. Abstração no backend: DB_PROVIDER=supabase usa Supabase; DB_PROVIDER=sqlite mantém SQLite. Mesma interface (prepare/get/all/run/exec) para não quebrar rotas.
3. Script de migração de dados SQLite → Supabase (ordem FKs, validação de contagens).
4. Validação de env no arranque quando DB_PROVIDER=supabase.
5. Testes existentes (tests/security.test.ts) continuando a passar.
6. Segurança: sem SQL por concatenação, sem service role no frontend, RLS considerado (produto comercial).

REGRAS:
- Não alterar lógica de negócio das rotas; apenas o meio de acesso aos dados.
- Não remover suporte a DB_PROVIDER=sqlite.
- Seguir as fases na ordem: 0 → 1 → 2 → 3 → 4 (opcional) → 5.
- Validar cada fase antes de avançar (testes, contagens, documentação).

Execute a(s) seguinte(s) fase(s): [FASE].

Referência completa: docs/PROMPT-MIGRACAO-SUPABASE.md (schema, tabelas, arquivos que importam db, checklist de segurança).
```

---

## Uso por fase (prompts curtos para você colar na IA)

- **Só Fase 0:** "Execute apenas a Fase 0 (pré-requisitos e validações) do documento docs/PROMPT-MIGRACAO-SUPABASE.md. Valide env e testes atuais."
- **Só Fase 1:** "Execute apenas a Fase 1 do documento docs/PROMPT-MIGRACAO-SUPABASE.md: gere o script SQL do schema PostgreSQL para Supabase equivalente ao src/db/index.ts, com tipos, FKs, índices e tenant system."
- **Fases 0+1+2:** "Execute as Fases 0, 1 e 2 do documento docs/PROMPT-MIGRACAO-SUPABASE.md. Não avance para migração de dados ainda."
- **Fase 3:** "Execute a Fase 3 do documento docs/PROMPT-MIGRACAO-SUPABASE.md: crie o script de migração de dados SQLite → Supabase e documente o uso (para eu rodar quando for migrar)."
- **Fase 5:** "Execute a Fase 5 do documento docs/PROMPT-MIGRACAO-SUPABASE.md: validação de env no server, testes e documentação."

---

## Notas técnicas para a IA

- **Placeholders:** SQLite usa `?`; PostgreSQL usa `$1, $2, ...`. Ao usar cliente `pg` no backend, converter ou aceitar ambos no adapter.
- **Connection string Supabase:** Na dashboard do projeto Supabase, em Settings → Database há "Connection string" (modo Session ou Transaction). Pode ser usada com `pg` para implementar o adapter com prepared statements idênticos ao SQL atual (apenas trocando `?` por `$1`, `$2`, etc.).
- **Tipos:** INTEGER 0/1 no SQLite → BOOLEAN no PostgreSQL. Datas em TEXT (ISO) podem permanecer como TEXT ou migrar para timestamptz; manter consistência no schema e no script de migração.
- **Seeds:** Os arquivos `src/db/seed.ts`, `seedLocal.ts`, `seedSystemAdmin.ts` usam `db` diretamente; ao trocar o provider por Supabase, passarão a popular o Supabase se o app rodar com `DB_PROVIDER=supabase`.

---

*Documento de referência para migração do Task-Manager (produto comercial, único desenvolvedor) para Supabase. Estrutura baseada em src/db/index.ts e análise do repositório.*
