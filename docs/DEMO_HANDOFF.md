# Demo Handoff — Task Manager

Documento de transferência para outra IA ou desenvolvedor continuar o trabalho.

**Branch:** `demo-refactor`
**Estado:** Funcional para demo básica de portfólio
**Data do handoff:** 2026-03-12

---

## Estado atual

### O que está funcionando

- Backend demo em `src/server.demo.ts` rodando na porta 3000
- Persistência JSON em `data/demo/*.json` (criado automaticamente no 1º start)
- Rotas: auth, tasks, users, lookups, rules, justifications
- Frontend React existente funciona sem modificações
- Tenant "demo" resolvido por header `X-Tenant-Slug` ou query `?tenant=demo`
- Build TypeScript sem erros

### O que NÃO está na demo (mas está no repo de produção)

- Chat (Socket.io): rotas não carregadas no server.demo.ts — interface navega mas API retorna 404
- Upload de evidências: rota retorna 503 com mensagem amigável
- Reset de senha: retorna mensagem "não disponível na demo"
- Holiday sync job: não iniciado
- Rotas system/holidays: não registradas no server.demo

---

## Arquitetura resumida

```
src/
├── server.demo.ts          ← Entry point da demo
├── demo/
│   ├── json-store.ts       ← I/O JSON atômico
│   ├── repository.ts       ← CRUD entities (User, Task, Tenant, Lookup, Rule)
│   ├── seed.ts             ← Seed automático (1ª execução)
│   └── middleware.ts       ← Auth JWT + tenant simplificado
└── routes/demo/
    ├── auth.ts
    ├── tasks.ts
    ├── users.ts
    ├── lookups.ts
    ├── rules.ts
    └── justifications.ts

data/demo/                  ← Criado automaticamente
├── tenants.json
├── users.json
├── tasks.json
├── lookups.json
├── rules.json
└── justifications.json     ← Criado dinamicamente

.env.demo                   ← Backend demo env
frontend/.env.demo          ← Frontend demo env
```

---

## Pendências e próximos passos priorizados

### P1 — Alta prioridade para melhorar a demo

1. **Upload de evidências simplificado (Opção B)**
   - Implementar upload para `data/demo-uploads/` (pasta local)
   - Em `src/routes/demo/tasks.ts`, no endpoint `POST /:id/evidences`:
     - Receber base64 do frontend (como produção faz)
     - Salvar arquivo em `data/demo-uploads/{taskId}/`
     - Registrar metadados em `data/demo/task_evidences.json`
   - Esforço estimado: ~50 linhas

2. **ChatPage — tela de "não disponível" na demo**
   - Criar `frontend/src/pages/DemoChatPage.tsx` com mensagem amigável
   - Em `App.tsx`, checar `import.meta.env.VITE_DEMO_MODE` para usar a tela alternativa
   - Ou: adicionar guard no início de `ChatPage.tsx`:
     ```tsx
     if (import.meta.env.VITE_DEMO_MODE === 'true') {
       return <div>Chat não disponível na demo.</div>;
     }
     ```

3. **Performance de seed**
   - Atual: seed cria ~12 tarefas. Para demo mais rica, adicionar mais competências (2025-12, 2026-01, 2026-02, 2026-03) com mais tarefas.
   - Ver `src/demo/seed.ts`, função `makeTask()`.

### P2 — Qualidade

4. **Teste de smoke da demo**
   - Criar `tests/demo-smoke.test.ts` com SuperTest
   - Testar: login, GET /tasks, POST /tasks, GET /users

5. **Validação de schema dos JSONs**
   - Em `src/demo/json-store.ts`, adicionar validação básica com Zod ou validação manual
   - Protege contra JSONs corrompidos na leitura

6. **Concorrência**
   - Atual: escrita não é segura para múltiplas requisições simultâneas (não há lock)
   - Para demo single-user: irrelevante
   - Para melhorar: implementar lock simples com `fs.lockSync` ou fila de operações

### P3 — Features adicionais para demo mais completa

7. **Relatório PDF** (`exportTasks.ts` já existe no frontend)
   - Testar se funciona com dados demo (provavelmente funciona já)

8. **Login de múltiplos usuários simultâneos**
   - Demo atual suporta mas não tem tenants adicionais pré-configurados
   - Para adicionar empresa-alpha na demo: editar `src/demo/seed.ts`

---

## Como testar a demo do zero

```bash
git checkout demo-refactor
npm install
npm run frontend:install
npm run demo:setup   # configura .env
npm run dev:demo:all # inicia backend + frontend

# Acesso: http://localhost:5173/demo/login
# Login: admin@demo.com / 123456
```

---

## Contexto de produção (para não perder)

O projeto em produção usa:
- `src/server.ts` — entry point de produção
- `DB_PROVIDER=supabase` — Supabase PostgreSQL
- Email via Resend (`src/services/email.ts`)
- Socket.io para chat real-time
- Multi-tenant por subdomínio (empresa.fluxiva.com.br)
- Holiday sync job diário (BrasilAPI)

Nada no código de produção foi modificado. A demo é completamente paralela.

---

## Dúvidas frequentes

**Q: Por que não usar o DB_PROVIDER=sqlite que já existia?**
R: JSON é mais inspecionável para portfólio. SQLite requer ferramentas adicionais para visualizar. Ver DEMO_REFACTOR_LOG.md para decisão completa.

**Q: O frontend precisa de modificações para demo?**
R: Não. O frontend existente funciona com a demo porque:
- CSRF: endpoint retorna token dummy, demo server ignora
- Chat: polling silencioso falha, unread=0, sem crash
- Upload: retorna 503, mostra toast de erro (aceitável)

**Q: Como adicionar mais dados de exemplo?**
R: Editar `src/demo/seed.ts` e rodar `npm run demo:reset && npm run dev:demo`.
