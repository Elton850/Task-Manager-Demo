# Task Manager — Memória de Sessão

## Stack
- Backend: Node.js + Express + TypeScript (`src/`)
- Frontend: React + Vite (`frontend/`)
- DB: PostgreSQL via Supabase (`DB_PROVIDER=supabase`) em prod/staging; SQLite em dev
- Env carregado por `src/load-env.ts` antes de tudo

## Supabase Storage (implementado)

### Módulo principal
`src/services/supabase-storage.ts`
- Funções exportadas: `uploadFile`, `downloadFile`, `deleteFile`, `shouldUseStorage`, `isStorageKey`, `BUCKET_EVIDENCES`, `BUCKET_LOGOS`
- Usa `@supabase/supabase-js` com service role key
- Cria buckets automaticamente na primeira chamada (`ensureBucket`)
- Ativo apenas quando `NODE_ENV === "production" || "staging"`

### Convenção de paths (critical)
- **Disco**: começa com `data/` (ex: `data/uploads/tenantId/taskId/...`)
- **Storage key**: NÃO começa com `data/` (ex: `tenantId/tasks/taskId/evidenceId_nome.pdf`)
- `isStorageKey(path)` retorna `true` quando é uma chave de Storage

### Estrutura de keys no Storage
- Evidências de tarefas: `{tenantId}/tasks/{taskId}/{evidenceId}_{safeName}`
- Evidências de justificativas: `{tenantId}/justifications/{justificationId}/{evidenceId}_{safeName}`
- Logos: `{tenantId}/logo{ext}` (.png/.jpg/.gif/.webp)

### Buckets
- `task-evidences` (privado) — configurável via `SUPABASE_STORAGE_BUCKET_EVIDENCES`
- `tenant-logos` (privado, servido pelo backend) — configurável via `SUPABASE_STORAGE_BUCKET_LOGOS`

### Arquivos alterados
- `src/routes/justifications.ts` — POST evidences, GET download, DELETE evidence
- `src/routes/tasks.ts` — POST evidences, GET download, DELETE evidence
- `src/routes/tenants.ts` — POST logo, GET logo, DELETE logo
- `.env.production.example` e `.env.staging.example` — novas variáveis de Storage

### Compatibilidade
- Registros antigos (paths em disco) continuam funcionando
- Novos uploads em prod/staging vão para Supabase Storage do ambiente correto
- Em dev, tudo em disco como antes

## Serviço de E-mail (src/services/email.ts)
- Usa `resend` (pacote já em `package.json`)
- Lê `RESEND_API_KEY` e `EMAIL_FROM` em **runtime** dentro de `sendResetCodeEmail` (não no topo do módulo)
- Em produção/staging: `EMAIL_FROM` obrigatório e não pode usar `onboarding@resend.dev` — falha explícita se inválido
- Em dev: fallback para `Task Manager <onboarding@resend.dev>` se `EMAIL_FROM` não configurado
- Chamada pelas rotas em `src/routes/auth.ts`: `request-reset`, `generate-reset`, `generate-reset-bulk`
- Referência de configuração de domínio: `PASSO-A-PASSO-EMAIL-HOSTGATOR-RESEND.md`

## Variáveis de ambiente relevantes
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET_EVIDENCES=task-evidences
SUPABASE_STORAGE_BUCKET_LOGOS=tenant-logos
RESEND_API_KEY=re_...
EMAIL_FROM=Task Manager <noreply@dominio-verificado.com>
```
