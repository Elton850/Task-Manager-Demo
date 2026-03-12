# Demo Refactor Log

**Branch:** `demo-refactor`
**Data:** 2026-03-12
**Objetivo:** Versão demo de portfólio, sem dependências externas, sem Supabase/e-mail/jobs.

---

## Arquitetura da Demo

### Decisão central: JSON como persistência

**Decisão:** Persistência em arquivos JSON (`data/demo/*.json`) em vez de SQLite.

**Motivo:** Para portfólio, JSON é:
- Inspecionável diretamente no editor de texto
- Sem necessidade de ferramentas de banco (DB Browser, psql, etc.)
- Resetável com `npm run demo:reset`
- Mais claro para recrutadores/avaliadores verem os dados do sistema

**Trade-off:** Para produção, SQLite/PostgreSQL continuam sendo usados via `server.ts`.

### Separação de contextos

| Contexto | Entry point | Persistência |
|----------|------------|--------------|
| Produção | `src/server.ts` | Supabase (PostgreSQL) |
| Desenvolvimento | `src/server.ts` + `.env.development` | SQLite |
| **Demo** | `src/server.demo.ts` | **JSON (`data/demo/*.json`)** |

---

## O que foi criado (demo-specific)

### Backend
| Arquivo | Descrição |
|---------|-----------|
| `src/demo/json-store.ts` | I/O JSON com escrita atômica (.tmp + rename) |
| `src/demo/repository.ts` | CRUD para User, Task, Tenant, Lookup, Rule |
| `src/demo/seed.ts` | Seed automático na 1ª execução (2 tenants, 7 users, 12 tasks, lookups, rules) |
| `src/demo/middleware.ts` | Auth JWT + tenant simplificado, CSRF no-op |
| `src/server.demo.ts` | Servidor Express simplificado (sem socket.io, sem jobs) |
| `src/routes/demo/auth.ts` | Login/logout/me (sem reset por e-mail) |
| `src/routes/demo/tasks.ts` | CRUD tarefas + subtarefas (upload desabilitado) |
| `src/routes/demo/users.ts` | CRUD usuários |
| `src/routes/demo/lookups.ts` | CRUD lookups (áreas, recorrências, tipos) |
| `src/routes/demo/rules.ts` | CRUD regras por área |
| `src/routes/demo/justifications.ts` | CRUD justificativas (sem upload) |
| `.env.demo` | Variáveis mínimas para demo |
| `frontend/.env.demo` | Frontend em modo demo (VITE_DEMO_MODE=true) |

### Scripts adicionados ao package.json
| Script | Ação |
|--------|------|
| `npm run dev:demo` | Inicia backend demo |
| `npm run dev:demo:all` | Backend + Frontend em paralelo |
| `npm run demo:setup` | Copia `.env.demo` para `.env` e frontend |
| `npm run demo:reset` | Remove JSONs em `data/demo/` → seed é recriado no próximo start |

---

## O que foi removido/desativado na demo

### Removido do fluxo demo (permanece no repo)
| Feature | Motivo |
|---------|--------|
| **Supabase** (pg, @supabase/supabase-js) | Dependência de nuvem. Demo usa JSON local. |
| **E-mail (Resend)** | Requer API key externa. Reset de senha mostra mensagem amigável na demo. |
| **Holiday sync job** | Requer BrasilAPI e agendamento. Sem feriados na demo. |
| **Chat (Socket.io)** | Complexidade de WebSocket desnecessária. Pollings falham silenciosamente (sem crash). |
| **Rotas `system`** | Área de admin mestre não é escopo da demo. |
| **Rotas `holidays`** | Sem feriados na demo. |
| **CSRF verification** | Desabilitado para demo local (sem risco). Frontend ainda chama /api/csrf e recebe token dummy. |
| **Rate limiting** | Sem necessidade em demo local. |
| **Host validation** | Sem necessidade em demo local. |
| **Impersonação** | Feature avançada fora do escopo da demo. |

### Upload de evidências
- **Decisão:** Desabilitado na demo (retorna HTTP 503 com mensagem clara).
- **Motivo:** Upload real exige Supabase Storage (produção) ou pasta local + streaming (staging). Para uma demo de portfólio, não agrega valor vs. complexidade de implementação.
- **Alternativa futura:** Opção B (`data/demo-uploads/`) pode ser implementada em `src/routes/demo/tasks.ts` com 5–10 linhas de código.

---

## Decisões arquiteturais

### Por que não reutilizar SQLite?
O projeto já funcionava localmente com `DB_PROVIDER=sqlite`. Optamos por JSON porque:
1. Seed visível como arquivos editáveis (melhor para demo/portfólio)
2. Reset instantâneo sem ferramentas de banco
3. Simplicidade de depuração para avaliadores
4. O SQLite continua sendo o provider de desenvolvimento normal

### Por que não modificar o server.ts principal?
Para manter integridade do fluxo de produção e facilitar merge futuro. O `server.demo.ts` é um entry point separado que reutiliza os tipos e middleware de produção onde possível.

### Tenant único na demo
A demo usa um único tenant ("demo"). Multi-tenancy completo está preservado no `server.ts` de produção.

---

## Impacto no código de produção

- **Zero**: nenhum arquivo de produção foi modificado.
- `package.json`: adicionados scripts `dev:demo`, `dev:demo:all`, `demo:setup`, `demo:reset` (aditivos, não quebram scripts existentes).
- `package.json`: removida linha duplicada `dev:all` (consolidado no bloco correto).

---

## Checklist de aceitação

- [x] Projeto roda local sem Supabase
- [x] Dados persistem em JSON após reinício
- [x] Login funciona (admin@demo.com / 123456)
- [x] CRUD de tarefas funciona
- [x] Listagem de usuários funciona
- [x] Calendário carrega (usa dados de tasks)
- [x] Lookups (áreas, recorrências, tipos) funcionam
- [x] Regras por área funcionam
- [x] Justificativas funcionam (sem upload)
- [x] Build TypeScript sem erros (`tsc --noEmit`)
- [x] Frontend não crasha sem chat/socket.io
- [x] Documentação criada
