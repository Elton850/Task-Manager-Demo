# Relatório de Segurança — Task Manager (Produção)

**Data da varredura:** fevereiro 2025  
**Escopo:** backend (Express), autenticação, banco de dados, uploads, env e dependências.  
**Status:** projeto em produção; correções aplicadas são **não invasivas** (sem alteração de schema ou dados em produção).

---

## Resumo executivo

| Prioridade | Quantidade | Ação |
|------------|------------|------|
| **Alta** | 2 itens | ✅ Corrigidos (logs com senhas) |
| **Média** | 5 itens | ✅ Corrigidos (JWT, path traversal, logs produção, URL DB) + 1 recomendação (CSP / ALLOWED_HOST_PATTERN) |
| **Baixa** | 5 itens | Documentados; ações opcionais |
| **Dependências** | 2 vulnerabilidades | `npm audit` — recomenda-se `npm audit fix` em staging antes de produção |

---

## 1. Correções já aplicadas (sem impacto em produção)

### 1.1 Logs expondo senhas (risco alto) — **CORRIGIDO**

- **Arquivos:** `src/db/seed.ts`, `src/db/seedLocal.ts`
- **Problema:** `console.log` exibia senha do admin demo. Em ambiente compartilhado ou se logs forem capturados, a senha vazava.
- **Correção:** Removida qualquer exibição de senha nos logs. Mensagens genéricas: "defina a senha no primeiro acesso", "senha definida no seed".

### 1.2 JWT sem algoritmo explícito (risco médio) — **CORRIGIDO**

- **Arquivo:** `src/middleware/auth.ts`
- **Problema:** `jwt.sign`/`jwt.verify` sem `algorithm` explícito; aceitação de outros algoritmos poderia ser explorada.
- **Correção:** Uso de `algorithm: "HS256"` em `sign` e `algorithms: ["HS256"]` em `verify`.

### 1.3 Path traversal no DELETE de evidência (risco médio) — **CORRIGIDO**

- **Arquivo:** `src/routes/justifications.ts`
- **Problema:** Ao apagar evidência em disco, `ev.file_path` era usada em `path.resolve` + `fs.unlinkSync` sem validar se o path ficava dentro de `data/uploads`. Um registro malicioso com `../` poderia permitir exclusão fora do diretório.
- **Correção:** Validação antes de `unlinkSync`: o path resolvido deve estar contido em `data/uploads` (mesmo padrão já usado no download de justifications e tasks).

### 1.4 Logs em produção (risco médio) — **CORRIGIDO**

- **Arquivos:** `src/server.ts`, `src/middleware/tenant.ts`
- **Problema:** Em produção, `console.error(err.message)` e `console.error(..., err)` podiam logar mensagens com dados internos (connection strings, paths, stack).
- **Correção:**
  - Handler global de erro: em produção só loga `err.name` (ex.: "Error"); em dev mantém `err.message` e stack.
  - Tenant middleware: em produção loga apenas o nome do erro; em dev mantém o objeto completo.

### 1.5 Exposição do prefixo de SUPABASE_DB_URL (risco baixo) — **CORRIGIDO**

- **Arquivo:** `src/server.ts`
- **Problema:** Quando `SUPABASE_DB_URL` era inválida, o log mostrava os primeiros 24 caracteres da URL.
- **Correção:** Mensagem genérica: "inválida (N chars). Use postgresql://... ou postgres://... sem aspas."

---

## 2. Recomendações (configuração / melhorias futuras)

### 2.1 ALLOWED_HOST_PATTERN em produção (médio)

- **Onde:** `src/middleware/tenant.ts` — em produção, se `ALLOWED_HOST_PATTERN` não estiver definido, qualquer host é aceito (Host Header Injection / cache poisoning).
- **Ação:** Definir em `.env.production` um regex restritivo, por exemplo:  
  `ALLOWED_HOST_PATTERN=^([a-z0-9-]+\\.)?seudominio\\.com$`  
  Documentado em `docs/ENV-REQUISITOS.md` (variável opcional).

### 2.2 CSP e unsafe-inline (médio)

- **Onde:** `src/server.ts` — Helmet CSP com `scriptSrc` e `styleSrc` usando `'unsafe-inline'`, o que reduz proteção contra XSS.
- **Ação:** Avaliar remover `unsafe-inline` usando nonces ou hashes para os scripts/estilos necessários no frontend. Requer teste para não quebrar a UI.

### 2.3 Dependências — npm audit (médio)

- **Situação atual:** `npm audit` reporta 2 vulnerabilidades:
  - **minimatch** (alta): ReDoS via padrão com wildcards.
  - **qs** (baixa): arrayLimit bypass — DoS.
- **Ação:** Rodar `npm audit fix` **primeiro em staging** e validar testes e deploy; depois aplicar em produção. Evitar `npm audit fix --force` sem análise.

### 2.4 Outros itens (baixa)

- **JWT_SECRET:** Validação de presença/comprimento no arranque já existe em produção (`server.ts`). Opcional: validar também em dev para falhar cedo.
- **Busca LIKE (tasks):** O parâmetro `search` é parametrizado (sem SQL injection). Caracteres `%` e `_` podem ampliar resultados; opcional: escape ou limite de tamanho.
- **SSL PostgreSQL:** `rejectUnauthorized: false` no pool pg (comum com Supabase). Documentar que a connection string é confiável; para máxima segurança, usar certificado válido e `rejectUnauthorized: true` se possível.
- **Staging:** Garantir que `APP_DOMAIN` esteja definido em `.env.staging` para restringir host em staging.

---

## 3. Pontos positivos (já adotados no projeto)

- **Autenticação:** Senhas com bcrypt (custo 12); cookies com `httpOnly`, `sameSite: 'lax'`, `secure` em HTTPS.
- **Impersonation:** Restrito a ADMIN do tenant system; escrita bloqueada quando em modo "visualizar como".
- **Super admin:** Acesso por `X-Super-Admin-Key` com `crypto.timingSafeEqual`.
- **SQL:** Queries parametrizadas (placeholders); nenhuma concatenação de entrada do usuário.
- **Uploads:** Lista de MIME permitidos; tamanho máximo 10MB; nome de arquivo sanitizado; path de download validado (uploads base).
- **API:** CORS com lista de origens (sem `*`); rate limit (login, reset, API); Helmet com CSP e HSTS em produção; `trust proxy` para Nginx.
- **Erros:** Em produção a resposta ao cliente é genérica ("Erro interno do servidor"); stack não é enviada.
- **Env:** `.env.development`, `.env.staging`, `.env.production` no `.gitignore`; load-env por ambiente.

---

## 4. Base de produção — atenção crítica

- **Nenhuma alteração de schema ou de dados** foi feita na base de produção por esta varredura.
- As correções aplicadas são apenas em **código** (logs, JWT, validação de path, sanitização de logs).
- **Migrações e seeds:** Executar apenas em ambientes controlados (staging primeiro). Não rodar `seed` ou `migrate:supabase` em produção sem planejamento.
- **npm audit fix:** Aplicar em staging, validar e depois em produção.

---

## 5. Próximos passos sugeridos

1. **Imediato:** Revisar este relatório e garantir que `.env.production` não tenha arquivos commitados.
2. **Curto prazo:** Definir `ALLOWED_HOST_PATTERN` em produção; rodar `npm audit fix` em staging e validar.
3. **Médio prazo:** Avaliar endurecimento do CSP (nonces/hashes) sem quebrar o frontend.
4. **Contínuo:** Manter dependências atualizadas e repetir `npm audit` periodicamente.
