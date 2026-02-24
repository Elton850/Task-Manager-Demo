# Refatoração: Staging Path-Based — Handoff Completo

**Data:** 2026-02-24
**Estado:** Código refatorado e pronto para deploy.
**Próximo passo:** Aplicar na VPS (ver Seção 4).

---

## 1. Diagnóstico — PM2 errored em produção

O processo PM2 de produção (`task-manager` ou `fluxiva-prod`) entra em status **errored** quando o servidor Node faz `process.exit(1)` ao iniciar. As causas mais comuns, em ordem de probabilidade:

### 1.1 Como ver os logs no servidor

```bash
pm2 logs task-manager --lines 100
# ou, se o app se chama fluxiva-prod:
pm2 logs fluxiva-prod --lines 100
pm2 show task-manager   # mostra env, porta e caminho do script
```

### 1.2 Causas mais prováveis (verificar em ordem)

| # | Sintoma no log | Causa | Solução |
|---|---|---|---|
| 1 | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_DB_URL` ausentes | `.env.production` não existe ou está incompleto na VPS | Criar/completar `.env.production` na raiz do projeto |
| 2 | `SUPABASE_DB_URL: inválida` | A string não começa com `postgresql://` — aspas extras, espaço, ou URL errada | Corrigir sem aspas: `SUPABASE_DB_URL=postgresql://...` |
| 3 | `JWT_SECRET deve ter pelo menos 32 caracteres` | JWT_SECRET muito curto | Trocar por string aleatória ≥ 32 chars |
| 4 | `Cannot find module '../dist/server.js'` | Build não foi feito | `npm run build` no servidor |
| 5 | `Error: listen EADDRINUSE 0.0.0.0:3000` | Outro processo na porta 3000 | `pm2 delete task-manager && pm2 start ecosystem.config.js --only task-manager` |
| 6 | `.env.staging obrigatório em staging. Não encontrado` | Processo PM2 com NODE_ENV=staging mas sem `.env.staging` | Criar `.env.staging` na VPS |

### 1.3 Sequência de diagnóstico no servidor

```bash
# 1. Listar todos os processos PM2
pm2 list

# 2. Ver logs detalhados do processo com erro
pm2 logs task-manager --lines 100   # ou fluxiva-prod, conforme o nome

# 3. Verificar se o build existe
ls ~/Task-Manager/dist/server.js

# 4. Verificar se .env.production existe e tem as variáveis obrigatórias
cat ~/Task-Manager/.env.production | grep -E "SUPABASE_DB_URL|SUPABASE_URL|JWT_SECRET|DB_PROVIDER"

# 5. Reiniciar limpamente:
cd ~/Task-Manager
pm2 delete task-manager        # apaga processo errored (nome pode ser fluxiva-prod)
npm run build                  # recompila o backend
pm2 start ecosystem.config.js --only task-manager
pm2 logs task-manager --lines 50   # confirmar que iniciou sem erros
```

### 1.4 Atenção: nome do processo PM2

O `ecosystem.config.js` usa o nome `task-manager` (produção) e `task-manager-staging`.
Se na VPS o processo foi criado com outro nome (ex.: `fluxiva-prod`), ele coexiste com o do ecosystem. Use `pm2 list` para ver todos. Se quiser substituir:

```bash
pm2 delete fluxiva-prod           # apaga o processo antigo
pm2 start ecosystem.config.js --only task-manager   # inicia o correto
```

---

## 2. O que foi refatorado — Mudança de esquema de URLs

| Ambiente  | Antes                              | Depois                              |
|-----------|------------------------------------|-------------------------------------|
| Produção  | `empresa.fluxiva.com.br`           | **`empresa.fluxiva.com.br`** (igual) |
| Staging   | `empresa.staging.fluxiva.com.br`   | **`staging.fluxiva.com.br/empresa`** |

**Produção:** continua com subdomínio por empresa (sem alteração).
**Staging:** passa para **um único host** (`staging.fluxiva.com.br`) com **tenant pelo path**.
- Admin sistema em staging: `staging.fluxiva.com.br/login` ou `staging.fluxiva.com.br/sistema`
- Empresa em staging: `staging.fluxiva.com.br/empresa1/login`, `staging.fluxiva.com.br/empresa1/calendar`

---

## 3. Arquivos alterados e o que mudou

### 3.1 Backend

#### `src/middleware/tenant.ts`
- **Adicionado** constantes `IS_STAGING` e `STAGING_HOST` (lido de `APP_DOMAIN` do env).
- **`validateHost()`**: Em staging, aceita **apenas** o host exato (`STAGING_HOST`). Remove o antigo curinga `*.staging.fluxiva.com.br`.
- **`resolveTenantSlug()`**: Remove o bloco de resolução por subdomínio de staging (`empresa.staging.*`). Em staging, o tenant vem exclusivamente do **header `X-Tenant-Slug`** (enviado pelo frontend SPA). Sem o header: cai no fallback `"system"`. A lógica de subdomínio de produção ganha guard `!IS_STAGING` para não conflitar com o host de staging.

#### `src/server.ts`
- **`isOriginAllowed()`**: Em staging, a regex do CORS aceita apenas o host exato de `APP_DOMAIN` (sem `([a-z0-9-]+\.)?` antes). Isso impede que `empresa.staging.fluxiva.com.br` seja aceito como origem CORS.

#### `src/routes/tenants.ts`
- **`POST /api/tenants` — `accessUrl`**: Em staging, gera `https://{APP_DOMAIN}/{slug}` (path-based). Em produção, continua gerando `https://{slug}.{APP_DOMAIN}`.

### 3.2 Frontend

#### `frontend/src/contexts/BasePathContext.tsx` — `getSubdomainSlug()`
- **`staging.fluxiva.com.br`** (4 partes, começa com `"staging"`): retorna **`null`** → modo path-based (igual ao localhost). Antes retornava `"system"` e ficava em modo subdomínio.
- Remove o bloco de detecção de `empresa.staging.fluxiva.com.br` (5+ partes).
- Resultado: em staging, `SyncTenantAndBasePath` usa `getTenantFromPath(pathname)` e `getBasePath(pathname)` → tenant e basePath vêm do path da URL.

#### `frontend/src/services/api.ts` — `isSubdomainMode()` e `getTenantSlugFromUrl()`
- **`isSubdomainMode()`**: Para host com 4 partes começando por `"staging"`, retorna `false` (modo path).
- **`getTenantSlugFromUrl()`**: Remove checks de `empresa.staging.fluxiva.com.br` e `staging.fluxiva.com.br` do bloco subdomain (agora `isSubdomainMode()` retorna false para esses hosts, e a função cai no bloco path-based).
- Redirect 401 (`loginPath`) funciona corretamente: em staging, `isSubdomainMode()=false` → redireciona para `/{tenant}/login`.

#### `frontend/src/pages/CompaniesPage.tsx` — `getTenantAccessUrl()`
- Em staging (hostname 4 partes, começa `"staging"`): gera `https://{APP_DOMAIN}/{slug}`.
- Em produção: continua gerando `https://{slug}.{APP_DOMAIN}`.

### 3.3 Arquivos de ambiente

#### `.env.staging.example`
- Remove `ALLOWED_HOST_PATTERN` (não é usado em staging; a validação agora usa `APP_DOMAIN` diretamente).
- Atualiza comentários para refletir esquema path-based.

#### `frontend/.env.staging.example`
- Atualiza comentário de exemplo de link para path-based.

---

## 4. O que fazer na VPS para aplicar as mudanças

### 4.1 Pré-requisitos na VPS

Antes de começar, verifique:

```bash
# VPS: confirmar que .env.production e .env.staging existem e estão corretos
ls ~/Task-Manager/.env.production
ls ~/Task-Manager/.env.staging

# Conferir as variáveis críticas de produção
grep -E "DB_PROVIDER|SUPABASE_DB_URL|JWT_SECRET|APP_DOMAIN|NODE_ENV|PORT" ~/Task-Manager/.env.production

# Conferir staging
grep -E "DB_PROVIDER|SUPABASE_DB_URL|JWT_SECRET|APP_DOMAIN|NODE_ENV|PORT" ~/Task-Manager/.env.staging
```

**`.env.staging` deve ter:**
```env
NODE_ENV=staging
PORT=3001
DB_PROVIDER=supabase
APP_DOMAIN=staging.fluxiva.com.br
ALLOWED_ORIGINS=https://staging.fluxiva.com.br
# ALLOWED_HOST_PATTERN não é mais necessário em staging (pode deixar vazio ou remover)
SUPABASE_URL=https://seu-projeto-staging.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-chave-staging
SUPABASE_DB_URL=postgresql://postgres.[REF]:[SENHA]@...pooler.supabase.com:5432/postgres
JWT_SECRET=string-aleatoria-min-32-chars
```

### 4.2 Deploy

```bash
cd ~/Task-Manager

# 1. Baixar o código atualizado
git pull origin main

# 2. Instalar dependências (se necessário)
npm install

# 3. Build do backend
npm run build

# 4. Build do frontend (um único build usado para prod e staging)
npm run frontend:build

# 5. Reiniciar PM2 (produção)
pm2 restart task-manager
# Se o nome for diferente ou estiver errored:
# pm2 delete task-manager && pm2 start ecosystem.config.js --only task-manager

# 6. Reiniciar PM2 (staging)
pm2 restart task-manager-staging
# Se o nome for diferente ou estiver errored:
# pm2 delete task-manager-staging && pm2 start ecosystem.config.js --only task-manager-staging

# 7. Verificar status
pm2 list

# 8. Verificar logs (procurar por "errored" ou "process.exit")
pm2 logs task-manager --lines 30
pm2 logs task-manager-staging --lines 30
```

**Sinais de sucesso nos logs:**
```
 Task Manager v2.0 rodando em http://localhost:3000
   Modo: produção
   DB:   Supabase (PostgreSQL)

 Task Manager v2.0 rodando em http://localhost:3001
   Modo: staging
[load-env] Staging: credenciais e DB carregados somente de .env.staging (override ativo)
```

### 4.3 Nginx — Atualizar configuração de staging

O Nginx de staging precisa ser atualizado: remover `*.staging.fluxiva.com.br` do `server_name` (não existe mais).

```bash
sudo nano /etc/nginx/sites-available/staging-fluxiva
```

**Nova configuração de staging (path-based):**

```nginx
server {
    listen 80;
    listen [::]:80;
    # APENAS o host exato — sem wildcard *.staging.fluxiva.com.br
    server_name staging.fluxiva.com.br;

    # Redireciona HTTP → HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name staging.fluxiva.com.br;

    # SSL (mesmo certificado da produção se cobrir *.fluxiva.com.br)
    ssl_certificate     /etc/letsencrypt/live/fluxiva.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fluxiva.com.br/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Frontend: um único build serve todas as empresas (tenant pelo path)
    root /home/deploy/Task-Manager/frontend/dist;
    index index.html;

    # API → backend staging (porta 3001)
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # SPA: rotas como /empresa1/tasks ou /login são tratadas pelo React Router
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**Configuração de produção (não alterada — subdomínio-based):**

```nginx
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name fluxiva.com.br *.fluxiva.com.br;  # subdomínios de produção

    ssl_certificate     /etc/letsencrypt/live/fluxiva.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fluxiva.com.br/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /home/deploy/Task-Manager/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**Aplicar e testar:**
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 4.4 DNS

Não é necessário criar novos registros DNS.
`staging.fluxiva.com.br` já deve resolver para o IP da VPS (coberto pelo `*.fluxiva.com.br` existente).

Empresas em staging **não precisam de subdomínio DNS** — o tenant vai pelo path (`/empresa1`), não pelo hostname.

---

## 5. Como testar manualmente após o deploy

### 5.1 Produção (sem alteração funcional — confirmar que continua funcionando)

```
# Admin sistema
https://sistema.fluxiva.com.br/login   → deve abrir login do sistema

# Empresa
https://demo.fluxiva.com.br/login      → deve abrir login da empresa "demo"
https://demo.fluxiva.com.br/calendar   → deve abrir calendário
```

### 5.2 Staging (novo esquema path-based)

```
# Admin sistema
https://staging.fluxiva.com.br/login     → login do sistema (tenant "system")
https://staging.fluxiva.com.br/sistema   → dashboard sistema (após login)

# Empresa "demo" em staging
https://staging.fluxiva.com.br/demo/login    → login da empresa demo
https://staging.fluxiva.com.br/demo/calendar → calendário

# URL inválida (empresa.staging.fluxiva.com.br não existe mais)
https://demo.staging.fluxiva.com.br/login → deve retornar 400 NO_TENANT (host rejeitado pelo backend)
                                            ou 404 (Nginx não roteia para staging)
```

**Verificações no browser (DevTools → Network):**
1. Toda requisição `/api/...` deve ter o header `X-Tenant-Slug: demo` (ou `system`).
2. Cookie de sessão deve ser definido com `Secure; SameSite=Lax` (em HTTPS).
3. Sem erros CORS no console.

### 5.3 Teste via curl

```bash
# Health check produção
curl -H "Host: fluxiva.com.br" http://localhost:3000/api/health
# → {"status":"ok","version":"2.0.0"}

# Health check staging
curl -H "Host: staging.fluxiva.com.br" http://localhost:3001/api/health
# → {"status":"ok","version":"2.0.0"}

# Host inválido em staging (deve ser rejeitado com 400)
curl -H "Host: demo.staging.fluxiva.com.br" http://localhost:3001/api/health
# → {"error":"Tenant não identificado (Host inválido).","code":"NO_TENANT"}

# Tenant via header em staging
curl -H "Host: staging.fluxiva.com.br" -H "X-Tenant-Slug: demo" http://localhost:3001/api/tenants/current
# → 401 (sem auth) ou 200 com dados do tenant "demo"
```

---

## 6. Slugs reservados

O slug `"staging"` é implicitamente reservado pelo esquema de detecção (hostname com 4 partes começando por `"staging"` → modo path). **Não criar empresa com slug `"staging"`** em nenhum dos dois ambientes.

Outros slugs reservados no frontend: `login`, `calendar`, `tasks`, `performance`, `users`, `admin`, `empresa`, `empresas`, `justificativas`, `sistema`, `logs-acesso`.

---

## 7. Desenvolvimento local (não alterado)

Localhost continua funcionando exatamente como antes:

```
http://localhost:5173/empresa1/login    → tenant "empresa1"
http://localhost:5173/login            → tenant "system"
```

O proxy Vite (`vite.config.ts`) continua apontando para `http://localhost:3000`.
Para testar o backend de staging localmente:
```bash
# Terminal 1: backend staging
NODE_ENV=staging npm run dev

# Terminal 2: frontend apontando para porta 3001
# Temporariamente alterar vite.config.ts proxy target para localhost:3001
```

---

## 8. Resumo das variáveis de ambiente por ambiente

| Variável | Produção | Staging |
|---|---|---|
| `NODE_ENV` | `production` | `staging` |
| `PORT` | `3000` | `3001` |
| `DB_PROVIDER` | `supabase` | `supabase` |
| `APP_DOMAIN` | `fluxiva.com.br` | `staging.fluxiva.com.br` |
| `ALLOWED_ORIGINS` | `https://fluxiva.com.br` | `https://staging.fluxiva.com.br` |
| `ALLOWED_HOST_PATTERN` | `^([a-z0-9-]+\.)?fluxiva\.com\.br$` | *(não necessário em staging)* |
| `SUPABASE_DB_URL` | URL do projeto de produção | URL do projeto de staging (separado!) |

**Regra de ouro:** Nunca compartilhar credenciais entre produção e staging.

---

## 9. Handoff para próxima sessão

Se esta sessão expirar, a próxima IA ou o usuário deve:

1. **Ler este documento** para entender o que foi feito.
2. **Verificar se o código foi commitado** (`git status` e `git diff`).
3. **Aplicar na VPS** conforme a Seção 4.
4. **Testar** conforme a Seção 5.
5. **Se ainda houver erro no PM2**: rodar `pm2 logs task-manager --lines 100` e verificar qual das causas da Seção 1.2 se aplica.

**Arquivos alterados nesta refatoração:**
- `src/middleware/tenant.ts` — validação de host e resolução de tenant
- `src/server.ts` — CORS staging (sem subdomínios)
- `src/routes/tenants.ts` — geração de `accessUrl` path-based em staging
- `frontend/src/contexts/BasePathContext.tsx` — modo path para staging
- `frontend/src/services/api.ts` — modo path para staging
- `frontend/src/pages/CompaniesPage.tsx` — links de acesso path-based em staging
- `.env.staging.example` — remove `ALLOWED_HOST_PATTERN`, atualiza comentários
- `frontend/.env.staging.example` — atualiza comentário de exemplo de link
