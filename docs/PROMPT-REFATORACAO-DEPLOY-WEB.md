# Prompt: Refatoração do deploy para Web (produção + staging)

Use este arquivo como **prompt para Claude Code IA**. O objetivo é ajustar o projeto no servidor para rodar corretamente na Web, com duas instâncias bem definidas (produção e staging), corrigir o status **errored** do processo de produção no PM2 e adotar um esquema de URLs mais simples e robusto para staging.

---

## Texto do prompt (copiar e colar)

```
Você atua como engenheiro de software e deve realizar uma refatoração estrutural do deploy do projeto Task Manager no servidor, para que produção e staging funcionem de forma limpa e previsível.  

---

## CONTEXTO DO PROJETO

- **Stack:** Node.js (Express) + React (Vite), multi-tenant, banco Supabase (ou SQLite em dev).
- **Servidor:** Hostgator VPS, Ubuntu 22.04. Projeto em `/var/www/Task-Manager` (ou `~/Task-Manager` conforme o usuário deploy).
- **Ferramentas já instaladas:** PM2, Nginx, certificado SSL para o domínio (ex.: fluxiva.com.br).
- **Estado atual:** Na última tentativa de deploy, o processo de **produção** no PM2 ficou em status **errored** (ex.: fluxiva-prod ou task-manager); o de **staging** pode estar online. É necessário diagnosticar e corrigir.

---

## OBJETIVO DA REFATORAÇÃO

1. **Produção:** Manter e garantir o esquema **empresa.dominio** (ex.: empresaX.fluxiva.com.br). Um subdomínio por empresa; domínio raiz ou subdomínio "sistema" para o admin do sistema (tenant "system").
2. **Staging:** Mudar do esquema atual **empresa.staging.dominio** (ex.: empresax.staging.fluxiva.com.br) para o esquema **staging.dominio/empresa** (ex.: staging.fluxiva.com.br/empresax). Ou seja:
   - **Um único host para staging:** `staging.fluxiva.com.br`.
   - **Tenant identificado pelo path:** `/empresax/login`, `/empresax/calendar`, etc. Para o admin do sistema em staging: `staging.fluxiva.com.br/sistema` ou `staging.fluxiva.com.br/login` (path sem prefixo de empresa = tenant "system").
3. **Isolamento por instância:** Cada instância (produção e staging) tem seu próprio banco de dados, credenciais e arquivo de ambiente:
   - **Produção:** `.env.production` (e base Supabase de produção). Processo PM2 com NODE_ENV=production, PORT=3000.
   - **Staging:** `.env.staging` (e base Supabase de staging). Processo PM2 com NODE_ENV=staging, PORT=3001.
   O código já carrega o env correto via `src/load-env.ts` (staging usa apenas .env.staging; produção usa .env + .env.production). Garanta que nenhuma alteração quebre essa separação e que cada instância use exclusivamente seu .env e seu banco.

---

## O QUE VOCÊ DEVE FAZER

### 1. Diagnóstico do erro em produção (PM2 errored)

- Analise o projeto para identificar possíveis causas do status **errored** no processo de produção (variáveis de ambiente obrigatórias, PORT, SUPABASE_DB_URL, caminho do script, etc.).
- Inclua no plano: como o usuário pode ver os logs no servidor (`pm2 logs`, `pm2 show fluxiva-prod` ou o nome do app) e quais variáveis conferir (.env.production na raiz do projeto).
- Se houver arquivo de configuração do PM2 no repositório (ex.: ecosystem.config.js), verifique se os nomes dos apps e as portas estão corretos e se o script aponta para o build (ex.: dist/server.js).

### 2. Refatoração da lógica de URLs: staging por path

- **Backend (Node/Express):**
  - No middleware de tenant (ex.: `src/middleware/tenant.ts`), quando o header Host for exatamente o domínio de staging (ex.: staging.fluxiva.com.br), **não** resolver o tenant pelo subdomínio. Resolver o tenant pelo **primeiro segmento do path** (ex.: /empresax/... → slug "empresax"; /login ou /sistema → tenant "system"). O domínio de staging pode ser obtido de uma variável de ambiente (ex.: APP_DOMAIN em NODE_ENV=staging) ou de uma variável dedicada (ex.: STAGING_HOST=staging.fluxiva.com.br). Garanta que o header X-Tenant-Slug (enviado pelo frontend) seja respeitado quando presente, para que requisições da SPA já informem o tenant.
  - Ajuste a validação de Host (validateHost / ALLOWED_HOST_PATTERN) para aceitar apenas o host de staging (um único host), sem subdomínios, em ambiente staging.
- **Frontend (React):**
  - Quando o hostname for exatamente o domínio de staging (ex.: staging.fluxiva.com.br), trate como **modo path-based** (igual ao desenvolvimento em localhost): o tenant deve ser extraído do primeiro segmento do path (já existe lógica em utils como getTenantFromPath, getBasePath em tenantPath.ts). Ou seja: em staging, NÃO use modo subdomínio; use o mesmo comportamento de path usado em localhost (basePath = /empresax, rotas sob esse basePath).
  - Ajuste `BasePathContext.tsx` (ou equivalente) para que, quando o hostname for o de staging, getSubdomainSlug retorne null (ou equivalente) e o tenant/basePath venham do path.
  - Ajuste `api.ts` (getTenantSlugFromUrl): em staging (host = staging.fluxiva.com.br), obter o slug do path em vez do hostname.
- **CORS:** No servidor, em ambiente staging, aceitar apenas a origem do host de staging (ex.: https://staging.fluxiva.com.br), sem curinga de subdomínio para staging.
- **Nginx (documentação/instruções):** Para staging, um único server block para `staging.fluxiva.com.br` (sem server_name com *.staging.fluxiva.com.br). O frontend é servido pelo mesmo build; as rotas são path-based (/empresax/..., /login, /sistema). Documente ou gere exemplo de configuração Nginx para esse cenário (proxy /api para a porta do staging, ex.: 3001; try_files para o SPA).

### 3. Build e deploy

- **Produção:** Build do frontend com variável de domínio de produção (ex.: VITE_APP_DOMAIN=fluxiva.com.br). O servidor Express em produção pode servir o frontend (já existe lógica em server.ts para IS_PROD) ou o Nginx pode servir os estáticos; mantenha consistência com o que já existe.
- **Staging:** Build do frontend com variável de domínio de staging (ex.: VITE_APP_DOMAIN=staging.fluxiva.com.br). O frontend precisa saber que, nesse host, o modo é path-based (isso já deve estar coberto pelo item 2).
- Garanta que os exemplos de .env (ex.: .env.production.example, .env.staging.example) e a documentação reflitam: produção = empresa.dominio; staging = staging.dominio/empresa (path). Remova ou atualize referências a empresa.staging.dominio.

### 4. Documentação e handoff

- **A cada passo relevante** (diagnóstico, alterações no backend, alterações no frontend, CORS, Nginx, PM2, variáveis de ambiente), **crie ou atualize um arquivo doc.md** (ou DOC-REFATORACAO-DEPLOY.md, DEPLOY-STAGING.md, etc.) descrevendo:
  - O que foi feito.
  - Quais arquivos foram alterados.
  - O que o usuário (ou outra IA) deve fazer em seguida para testar ou continuar.
- Isso permite que, se a sessão expirar, outra IA ou o próprio usuário assuma o trabalho com contexto claro.

### 5. Testes e validação

- Onde for possível, sugira ou execute testes (ex.: npm run test).
- Para o que não for automatizável, descreva como testar manualmente: por exemplo, acessar staging.fluxiva.com.br/empresax/login e verificar que o tenant é "empresax"; acessar empresa.fluxiva.com.br e verificar que produção continua por subdomínio.
- Se necessário, peça ao usuário que rode comandos no servidor (pm2 logs, verificação de .env) e reporte o resultado para ajustes finos.

---

## REGRAS

- Não quebrar desenvolvimento local (localhost com path ou subdomínio local).
- Não misturar credenciais ou bases entre produção e staging; cada instância usa apenas seu .env e seu DB.
- Evitar alterações desnecessárias; preferir mudanças mínimas e seguras.
- Não expor credenciais no chat; usar placeholders (ex.: fluxiva.com.br, staging.fluxiva.com.br, PORT 3000/3001).
- Se o nome do app no PM2 no servidor for diferente do que está no repositório (ex.: fluxiva-prod / fluxiva-staging em vez de task-manager / task-manager-staging), documente ambos e indique como garantir NODE_ENV e PORT corretos para cada um.

---

## ENTREGÁVEIS

1. Correção ou orientação para o processo PM2 em erro (produção).
2. Código refatorado: staging por path (backend + frontend + CORS + validação de host).
3. Atualização de documentação e exemplos de .env; exemplo de Nginx para staging (path-based).
4. Pelo menos um doc.md por etapa relevante, permitindo handoff para outra IA ou usuário.

Comece pelo diagnóstico do PM2 (por que produção está em erro) e pela leitura do código de tenant e frontend (BasePathContext, api.ts, tenantPath). Em seguida, aplique as mudanças de forma incremental e documente cada passo. Use português do Brasil.
```

---

## Resumo da mudança de esquema de URLs

| Ambiente   | Antes (problemático)              | Depois (desejado)                    |
|-----------|------------------------------------|---------------------------------------|
| Produção  | empresa.fluxiva.com.br             | **empresa.fluxiva.com.br** (igual)   |
| Staging   | empresa.staging.fluxiva.com.br     | **staging.fluxiva.com.br/empresa**   |

- **Produção:** um subdomínio por empresa; admin do sistema por subdomínio (ex.: sistema.fluxiva.com.br) ou domínio raiz, conforme já existir.
- **Staging:** um único host (staging.fluxiva.com.br); empresas por path (/empresax, /demo, etc.); sistema por path sem prefixo (/sistema, /login).

Cada instância continua com seu próprio `.env` (`.env.production` e `.env.staging`) e banco de dados dedicado.
