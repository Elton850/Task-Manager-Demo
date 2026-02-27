# Testes e ambientes — guia simples

Explicação direta de como rodar os testes e como preparar os ambientes (dev, staging, produção) sem sujar a base errada.

---

## O que são os testes?

O projeto tem **testes automáticos** que verificam se a API está segura: autenticação, isolamento entre empresas (multi-tenant), CSRF, CORS, etc.

- **Comando:** `npm run test`
- **O que roda:** 16 testes em `tests/security.test.ts`
- **Onde:** no seu computador, usando o banco configurado no `.env` (ou SQLite em `./data/taskmanager.db` por padrão)

Os testes **usam o banco de verdade** (SQLite por padrão). Eles precisam que exista um tenant **"demo"** e um usuário **admin@demo.com** para simular login e rotas.

---

## Pré-requisitos (checklist)

Antes de rodar os testes, tenha:

| Pré-requisito | Como verificar |
|---------------|----------------|
| Node.js instalado (v18+) | `node -v` |
| Dependências instaladas | `npm install` (na raiz do projeto) |
| Arquivo `.env` ativo | Existe um `.env` (ou você rodou `npm run env:dev`) |
| Banco com dados "demo" | Rodou pelo menos um seed que cria o tenant **demo** (veja abaixo) |

Nada de configuração especial: os testes já definem `NODE_ENV=test` e um `JWT_SECRET` de teste automaticamente.

---

## Passo a passo: preparar e rodar os testes

### 1) Primeira vez no projeto

```bash
# Na pasta do projeto (Task-Manager)
npm install
```

### 2) Ter um .env (desenvolvimento)

Se ainda não tiver `.env`:

```bash
# Copia o modelo de desenvolvimento para .env
npm run env:dev
```

Isso copia `.env.development` → `.env`. Se você ainda não criou `.env.development`, crie a partir do template:

```bash
cp .env.development.example .env.development
# Depois edite .env.development e coloque pelo menos JWT_SECRET e o que precisar
```

Ou crie `.env` direto a partir do modelo genérico:

```bash
cp .env.example .env
# Edite .env e defina JWT_SECRET (mín. 32 caracteres) e o que mais precisar
```

### 3) Popular o banco com dados "demo" (obrigatório para os testes)

Os testes dependem do tenant **demo** e do usuário **admin@demo.com**. Use um dos seeds:

**Opção A – Seed local (recomendado para dev e testes)**  
Cria tenant "demo", admin@demo.com e dados de exemplo. Pode limpar tudo e recriar.

O **banco de destino** é definido no comando:

```bash
# Popular banco LOCAL (SQLite em data/taskmanager.db) — padrão
npm run seed:db
# ou explicitamente:
npm run seed:db -- local
# ou use o atalho:
npm run seed:local

# Popular Supabase STAGING (usa .env.staging)
npm run seed:db -- staging
# ou use o atalho:
npm run seed:staging
```

Requer para staging: `.env.staging` com `DB_PROVIDER=supabase` e `SUPABASE_DB_URL` (e demais variáveis Supabase) apontando para o projeto de staging.

Se quiser **zerar** e recriar depois:

```bash
npm run seed:local:clean   # apaga dados do banco local
npm run seed:local        # recria demo + admin no local
# Para staging: npm run seed:staging -- --clean  (depois npm run seed:staging)
```

Se quiser **popular ao mesmo tempo o banco local e o Supabase de staging** (mesmos dados em ambos):

```bash
npm run seed:local:and-staging   # 1) popula SQLite (dev)  2) popula Supabase staging (.env.staging)
```

**Opção B – Seed antigo (só demo básico)**

```bash
npm run seed
```

### 4) Rodar os testes

```bash
npm run test
```

Saída esperada: algo como **16 passed**.

Exemplo:

```
PASS tests/security.test.ts
  Segurança - Endpoints públicos
    √ GET /api/health retorna 200 sem tenant
    √ GET /api/csrf exige tenant
    ...
Tests: 16 passed, 16 total
```

### 5) Rodar só os testes de segurança

```bash
npm run test:security
```

É o mesmo arquivo; esse comando só deixa explícito que está rodando a suíte de segurança.

---

## Resumo em 4 comandos (primeira vez)

```bash
npm install
npm run env:dev
npm run seed:local
npm run test
```

Se os 16 testes passarem, o ambiente está pronto para desenvolvimento e testes.

---

## Não sujar a base de desenvolvimento (opcional)

Por padrão, os testes usam o **mesmo banco** que o desenvolvimento (por exemplo `./data/taskmanager.db`). Isso é simples, mas os testes podem criar/alterar dados (ex.: tenant "other").

Se quiser **usar um banco só para testes**:

1. Crie um arquivo `.env.test` (não versionado) ou use variáveis na hora de rodar:

```bash
# Windows (PowerShell)
$env:SQLITE_DB_PATH="./data/taskmanager.test.db"; npm run test

# Linux / macOS
SQLITE_DB_PATH=./data/taskmanager.test.db npm run test
```

2. Rode o seed nesse banco antes dos testes (uma vez):

```bash
# Exemplo no PowerShell
$env:SQLITE_DB_PATH="./data/taskmanager.test.db"; npm run seed:local
$env:SQLITE_DB_PATH="./data/taskmanager.test.db"; npm run test
```

Assim o banco de **dev** (`taskmanager.db`) fica intacto.

---

## Ambientes (dev, staging, produção) em poucas palavras

| Ambiente      | Para que serve              | Banco típico     | Como ativar              |
|---------------|-----------------------------|------------------|---------------------------|
| **Development** | Desenvolver no seu PC       | SQLite local     | `npm run env:dev`         |
| **Staging**     | Testar em um site na nuvem (link de teste) | Supabase separado (staging) | `npm run env:staging` + deploy |
| **Production**  | Clientes reais              | Supabase produção | `npm run env:prod` + deploy |

- **Rodar testes** (`npm run test`) você faz no **desenvolvimento**, com `.env` de dev (geralmente SQLite).  
- **Staging** é para **publicar** uma versão de teste (link para alguém acessar) sem mexer na base de produção.  
- **Produção** é o app e a base reais.

Não é obrigatório ter os três; o mínimo é ter um `.env` (ou `.env.development`) para desenvolver e rodar os testes.

---

## Preparar cada ambiente (resumo)

### Desenvolvimento (seu dia a dia)

1. Copiar template: `cp .env.development.example .env.development`
2. Editar `.env.development` (por exemplo `DB_PROVIDER=sqlite`, `JWT_SECRET`, etc.)
3. Ativar: `npm run env:dev`
4. Popular banco (uma vez): `npm run seed:local`
5. Rodar testes: `npm run test`

### Staging (site de teste na nuvem)

Siga o guia detalhado na seção **"Como criar um ambiente de testes no Supabase"** abaixo. Em resumo:

1. Copiar template: `cp .env.staging.example .env.staging`
2. Criar um **projeto Supabase só para staging** (não use o de produção)
3. Executar o schema e preencher em `.env.staging`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `ALLOWED_ORIGINS`
4. Antes do deploy de staging: `npm run env:staging`
5. Fazer deploy do backend/frontend apontando para esse `.env` (e para o Supabase de staging)

### Produção

1. Copiar template: `cp .env.production.example .env.production`
2. Preencher com projeto Supabase de produção e segredos fortes
3. Antes do deploy: `npm run env:prod`
4. Fazer deploy usando o `.env` gerado

---

## Como criar um ambiente de testes no Supabase (staging)

Use um **projeto Supabase separado** só para testes/staging. Assim você testa com banco real (PostgreSQL) sem tocar na produção.

### Passo 1: Criar o projeto no Supabase

1. Acesse [supabase.com/dashboard](https://supabase.com/dashboard) e faça login.
2. Clique em **New project**.
3. Escolha a organização (ou crie uma).
4. Preencha:
   - **Name:** por exemplo `Task-Manager-Staging` ou `Task-Manager-Test`.
   - **Database Password:** defina e **guarde** (será usada na connection string).
   - **Region:** a mais próxima (ex.: South America (São Paulo)).
5. Clique em **Create new project** e aguarde a criação.

### Passo 2: Criar o schema (tabelas) no projeto de staging

1. No projeto criado, no menu lateral abra **SQL Editor**.
2. Clique em **New query**.
3. Abra o arquivo `scripts/supabase-schema.sql` do seu projeto (Task-Manager) e **copie todo o conteúdo**.
4. Cole no SQL Editor do Supabase e clique em **Run** (ou Ctrl+Enter).
5. Confirme que não há erros e que as tabelas aparecem em **Table Editor** (tenants, users, tasks, etc.).

### Passo 3: Obter as chaves e a connection string

1. No menu lateral: **Settings** (ícone de engrenagem) → **API**.
   - **Project URL** → use em `SUPABASE_URL`.
   - **anon public** → use em `SUPABASE_ANON_KEY`.
   - **service_role** (Reveal) → use em `SUPABASE_SERVICE_ROLE_KEY` (só no backend, nunca no frontend).
2. **Settings** → **Database**.
   - Em **Connection string** use **Session mode** (ou **Transaction mode**), **não** use "Direct connection".
   - A URL do pooler começa com host tipo `aws-0-xx.pooler.supabase.com`. Se a URL tiver host `db.xxxxx.supabase.co`, é conexão direta — troque para Session/Transaction mode.
   - Copie a URL, troque `[YOUR-PASSWORD]` pela senha do banco e use em `SUPABASE_DB_URL`.

### Passo 4: Configurar o `.env.staging` no projeto

1. Na pasta do Task-Manager:
   ```bash
   cp .env.staging.example .env.staging
   ```
2. Edite `.env.staging` e preencha:
   - `DB_PROVIDER=supabase`
   - `SUPABASE_URL` = URL do projeto de staging
   - `SUPABASE_ANON_KEY` = chave anon do projeto de staging
   - `SUPABASE_SERVICE_ROLE_KEY` = chave service_role do projeto de staging
   - `SUPABASE_DB_URL` = connection string (com a senha real)
   - `JWT_SECRET` = string com pelo menos 32 caracteres (pode ser diferente da produção)
   - `SUPER_ADMIN_KEY` = chave para rotas de super admin (pode ser diferente da produção)
   - `SYSTEM_ADMIN_EMAIL` e `SYSTEM_ADMIN_PASSWORD` = login do admin do sistema nesse ambiente
   - `ALLOWED_ORIGINS` = URL(s) do seu site de teste (ex.: `http://localhost:5173` para testar local, ou `https://staging.seudominio.com`)

3. Validar:
   ```bash
   npm run env:staging
   npm run validate:supabase
   ```
   Se aparecer "Variáveis SUPABASE_* válidas", está correto.

### Passo 5: Popular dados (opcional)

- **Admin do sistema:** ao subir o backend com esse `.env`, o seed cria o usuário de sistema automaticamente (usando `SYSTEM_ADMIN_EMAIL` e `SYSTEM_ADMIN_PASSWORD`).
- **Dados de teste (tenant demo, etc.):**  
  Se quiser os mesmos dados do SQLite local no Supabase de staging:
  ```bash
  npm run env:staging
  npm run migrate:supabase
  ```
  (O script lê o SQLite em `data/taskmanager.db` e insere no Supabase atual. Certifique-se de que o `.env` aponta para o projeto de staging.)

### Limpar a base de staging (Supabase)

Para **zerar os dados** da base de teste no Supabase (equivalente ao `seed:local:clean` no SQLite):

```bash
npm run env:staging
npm run staging:clean -- --confirm
```

Isso apaga todos os registros das tabelas (na ordem correta das FKs) e recria apenas o tenant **"system"**. Depois você pode repopular com `npm run migrate:supabase` (a partir do SQLite) ou cadastrar dados de novo pela aplicação.

**Segurança:** o script só roda com a flag `--confirm`. Nunca use em produção.

### Copiar produção → staging (Supabase → Supabase)

Para **replicar os dados da base de produção na base de teste** (útil para testar com dados reais sem mexer na produção):

1. No `.env` (ou num arquivo que você carregue), defina:
   - **SUPABASE_DB_URL** = connection string do **staging** (destino)
   - **SUPABASE_DB_URL_PRODUCTION** = connection string da **produção** (origem)

2. Execute:
   ```bash
   npm run env:staging
   # Edite .env e adicione SUPABASE_DB_URL_PRODUCTION com a URL do projeto de produção
   npm run copy:prod-to-staging -- --confirm
   ```

O script limpa a base de destino (staging) e copia todos os dados da produção para o staging, na ordem correta das FKs. Exige `--confirm`.

**Requisito:** o schema (tabelas/colunas) do staging deve ser igual ou mais novo que o da produção (rode as migrações no staging se necessário).

### Passo 6: Usar o ambiente de testes

- **Rodar o backend local apontando ao Supabase de staging:**
  ```bash
  npm run env:staging
  npm run dev
  ```
  Acesse o frontend (ex.: http://localhost:5173) e faça login com os usuários desse banco (ex.: admin@demo.com se você rodou a migração, ou o SYSTEM_ADMIN_EMAIL).

- **Deploy de staging:** antes do deploy, rode `npm run env:staging` e faça o deploy do backend e do frontend usando o `.env` gerado. Configure `ALLOWED_ORIGINS` com a URL pública do site de teste.

### Resumo rápido

| O que | Onde |
|-------|------|
| Projeto Supabase só para testes | Dashboard → New project (ex.: Task-Manager-Staging) |
| Schema (tabelas) | SQL Editor → colar `scripts/supabase-schema.sql` → Run |
| Chaves e connection string | Settings → API e Settings → Database |
| Config local | `.env.staging` com todas as `SUPABASE_*` + `SUPABASE_DB_URL` |
| Ativar no seu PC | `npm run env:staging` e depois `npm run dev` ou deploy |
| Limpar base staging | `npm run env:staging` e depois `npm run staging:clean -- --confirm` |
| Copiar produção → staging | Defina `SUPABASE_DB_URL_PRODUCTION` e `SUPABASE_DB_URL` (staging), depois `npm run copy:prod-to-staging -- --confirm` |

Assim você tem um banco Supabase **separado da produção** só para testar e fazer demos.

### Migração de schema em produção (Supabase)

Se o seu **Supabase de produção** (ou staging) foi criado com uma versão antiga do schema (tabela `rules` sem as colunas de tipos), execute **uma vez** no SQL Editor do projeto:

1. Abra **SQL Editor** no dashboard do Supabase.
2. Cole e execute o conteúdo de **`scripts/supabase-migration-rules-tipos.sql`**.

O script é **idempotente** (pode rodar mais de uma vez sem erro). Depois, reinicie o backend. Nenhuma perda de dados; apenas adição de colunas.

**Tipos criados pelo Leader não aparecem ou não gravam no Supabase**  
→ Execute **`scripts/supabase-migration-rules-tipos.sql`** no SQL Editor do projeto. Esse único script adiciona as colunas `allowed_tipos`, `custom_tipos` e `default_tipos` na tabela `rules`; sem elas, os tipos da área não são salvos.

### Remover tipos globais (só tipos do Leader na criação de tarefas)

Se quiser que na criação de tarefas apareçam **apenas** os tipos cadastrados pelo Leader (sem Rotina, Projeto, etc. da lista global), execute **uma vez** no SQL Editor (Supabase) ou via sqlite3 (SQLite) o conteúdo de **`scripts/cleanup-lookups-tipo.sql`**. Isso remove todos os registros da categoria TIPO na tabela `lookups`. No Supabase, execute antes a migração `supabase-migration-rules-tipos.sql` para que os tipos do Leader sejam gravados.

---

## Problemas comuns

**`getaddrinfo ENOTFOUND db.xxxxx.supabase.co` ao subir o servidor**  
→ Você está usando a connection string **Direct connection**. Use a do **Session mode** (ou Transaction mode): no Supabase, Settings → Database → Connection string → escolha "Session" ou "Transaction". O host deve ser `*.pooler.supabase.com`, não `db.xxx.supabase.co`.

**"Tenant demo não encontrado" / testes falhando**  
→ Rode um seed que crie o tenant "demo": `npm run seed:local` ou `npm run seed`.

**"JWT_SECRET must be at least 32 characters"**  
→ No `.env` (ou no `.env.development` que você copia com `env:dev`), defina `JWT_SECRET` com pelo menos 32 caracteres.

**Quero rodar os testes sem alterar meu banco de dev**  
→ Use outro arquivo de banco só para teste:  
`SQLITE_DB_PATH=./data/taskmanager.test.db npm run seed:local`  
e depois  
`SQLITE_DB_PATH=./data/taskmanager.test.db npm run test`

---

*Resumo: instale dependências, tenha um `.env` (ou `env:dev`), rode `seed:local`, depois `npm run test`. Use staging para um site de teste com base separada; produção para o app real.*