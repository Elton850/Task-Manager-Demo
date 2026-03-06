# Implementation Log — Chat Interno

## 2026-03-06 — Monitoramento de performance do chat (SystemDashboard)

### Documentos lidos obrigatoriamente
- `docs/GUIA-IA-AGENTES.md` — lido e seguido
- `docs/CHAT_IMPLEMENTACAO.md` — lido e seguido
- `docs/CHAT_REALTIME_AJUSTES.md` — lido e seguido

### Decisões técnicas
- **Sem alteração de banco**: todas as métricas derivam de tabelas existentes com índices adequados.
- **Cache em memória (30s)**: `chatMetricsCache` module-level em `system.ts`. Evita custo de queries repetidas sem infra adicional.
- **Janela configurável**: query param `?window=N` (minutos), padrão 60, máx 1440.
- **Status derivado**: `warning` se `unread.total > 500`; `healthy` caso contrário.
- **Frontend resiliente**: `ChatMetricsSection` isolada — erro não quebra o resto da página. Polling 30s independente.
- **Sem libs adicionais**: barras de progresso em CSS puro.

### Arquivos alterados
| Arquivo | Ação |
|---------|------|
| `src/routes/system.ts` | Adicionado `GET /api/system/chat-metrics` + cache + tipos inline |
| `frontend/src/services/api.ts` | Adicionado `systemApi.chatMetrics()` |
| `frontend/src/pages/SystemDashboardPage.tsx` | Adicionada `ChatMetricsSection` com 4 cards + top tenants |

### Resultados
- `npm run build`: OK (TypeScript sem erros)
- `npm run test`: 20/20 PASS
- `npm run frontend:build`: OK

---

## 2026-03-06 — Fase 0: Hardening + Realtime (início)

### Documentos lidos obrigatoriamente
- `docs/GUIA-IA-AGENTES.md` — lido e seguido
- `docs/CHAT_REALTIME_AJUSTES.md` — lido e seguido

### Problemas identificados para correção (Fase 1)
1. Subtask endpoint expõe threadId para não-participantes sem permissão adequada.
2. N+1 de queries em GET /threads (participantes buscados 1 por thread em loop).
3. N+1 de queries em GET messages (read status buscado 1 por mensagem em loop).
4. Race condition em criação de thread direta (sem transação nem constraint de unicidade).
5. Colunas canônicas participant_a/participant_b ausentes para unicidade de thread direta.

### Decisões técnicas (Fase 3–5)
- Socket.IO no namespace `/ws-chat` — autenticação por cookie JWT no handshake.
- Escrita continua via HTTP (mantém audit/rate-limit/CSRF). Socket usado apenas para push.
- Presença efêmera em memória — documentar limitação multi-instância.
- Fallback de polling mantido no frontend (30s threads/unread, 5s mensagens abertas quando socket indisponível).

---

## 2026-03-06 — Hardening, performance e realtime concluídos

### Fases implementadas

**Fase 1 — Hardening de segurança (src/routes/chat.ts)**
- Subtarefa: `canAccessSubtask()` espelha `canReadTask` de tasks.ts (ADMIN, LEADER de área, responsável, ou responsável da tarefa pai)
- ThreadId nunca exposto: não-participante sem auto-join recebe `403` sem `threadId`
- Race condition em thread direta: transação BEGIN/COMMIT + chave canônica `participant_a < participant_b` + índice único parcial
- Race condition em thread de subtarefa: transação com re-verificação interna

**Fase 2 — Performance (src/routes/chat.ts)**
- N+1 em `GET /threads` eliminado: batch query de todos os participantes por `thread_id IN (...)`
- N+1 em `GET messages` eliminado: batch query de receipts e events por `message_id IN (...)`
- N+1 em registro de "delivered" eliminado: batch check antes de inserir

**Fase 3 — Realtime backend**
- `src/ws/chat-socket.ts`: namespace `/ws-chat`, auth JWT no handshake via cookie, `join_thread` com verificação de participação, `leave_thread`, presença efêmera em memória com `chat:presence_update`
- `src/server.ts`: `http.createServer(app)` + `initChatSocket(httpServer, isOriginAllowed)` + `app.locals.io`
- `src/routes/chat.ts`: emit `chat:new_message`, `chat:thread_unread_update` em POST messages; emit `chat:message_read`, `chat:thread_unread_update` em POST read

**Fase 4 — Realtime frontend**
- `frontend/src/hooks/useSocketChat.ts`: singleton socket com reconnect, join/leave por thread, callbacks para eventos
- `frontend/src/components/chat/MessagePanel.tsx`: usa socket para novas mensagens e read status; polling reduzido (30s quando conectado, 5s como fallback); indicador visual de conexão
- `frontend/src/hooks/useChatUnread.ts`: dispara refresh imediato via `chat:thread_unread_update`
- `frontend/vite.config.ts`: proxy WebSocket `/ws-chat` para dev

**Fase 5 — Presença**
- Mapa efêmero em memória em `chat-socket.ts`: `tenantId:userId → Set<socketId>`
- `GET /api/chat/presence?userIds=...` retorna `{ [userId]: "online" | "offline" }`
- `chat:presence_update` emitido em connect/disconnect
- Limitação documentada: multi-instância requer Redis adapter

**Migrações SQL incrementais**
- `scripts/migrations/chat-schema-sqlite.sql`: ADD COLUMN IF NOT EXISTS para participant_a/b + 4 índices
- `scripts/migrations/chat-schema-postgres.sql`: idem idempotente
- `src/db/sqlite.ts`: migração inline já aplicada em sessão anterior

### Resultados finais
- `npm run build`: OK (TypeScript sem erros)
- `npm run test`: 20/20 PASS (sem regressão de segurança)
- `npm run frontend:build`: OK (bundle sem erros TypeScript)

---

## 2026-03-06 — Implementação inicial completa

### Decisões técnicas

**Polling vs WebSocket**
- Adotado polling leve (30s para lista de threads e contadores; 5s para mensagens abertas).
- Motivo: WebSocket requer infraestrutura adicional (Redis pub/sub ou sticky sessions) incompatível com PM2 multi-process sem coordenação. Polling é adequado para o volume atual e permite fallback natural.

**Tabelas separadas de recibos e eventos**
- `chat_message_receipts`: confirmação de leitura por mensagem/usuário (UNIQUE constraint).
- `chat_message_events`: log de auditoria imutável (sent/delivered/read). Permite reconstruir histórico.
- `unread_count` denormalizado em `chat_thread_participants` para evitar COUNT global em loops.

**Soft delete de mensagens**
- `deleted_at` em `chat_messages`: mensagem deletada exibe "[mensagem removida]" sem destruir histórico de recibos.

**Rate limiting**
- `chatSendLimiter`: 60 mensagens/min por IP (mais permissivo que `/api/auth/login` mas protege contra spam).
- `apiLimiter` geral (120 req/min) também se aplica.

**Atalho de subtarefa**
- Botão "Conversar com responsável" (ícone `MessageCircle`) em cada linha de subtarefa no TaskModal.
- Cria/reabre thread `type='subtask'` com participantes: responsável + criador da tarefa + usuário atual.
- Admins/Leaders que acessam por esta rota são adicionados como participantes automaticamente.

### Arquivos alterados

| Arquivo | Ação | Motivo |
|---------|------|--------|
| `src/db/sqlite.ts` | Adicionado | Schema chat + migrations inline |
| `src/server.ts` | Atualizado | Import e registro de chatRoutes + chatSendLimiter |
| `src/routes/chat.ts` | Criado | 7 endpoints de chat |
| `scripts/migrations/chat-schema-sqlite.sql` | Criado | SQL para dev/local |
| `scripts/migrations/chat-schema-postgres.sql` | Criado | SQL para staging/prod |
| `frontend/src/types/index.ts` | Atualizado | Tipos Chat* |
| `frontend/src/services/api.ts` | Atualizado | chatApi |
| `frontend/src/hooks/useChatUnread.ts` | Criado | Polling de não lidas |
| `frontend/src/pages/ChatPage.tsx` | Criado | Página principal de chat |
| `frontend/src/components/chat/ThreadList.tsx` | Criado | Lista de conversas |
| `frontend/src/components/chat/MessagePanel.tsx` | Criado | Painel de mensagens |
| `frontend/src/components/layout/Header.tsx` | Atualizado | Badge não lidas + link |
| `frontend/src/components/layout/Sidebar.tsx` | Atualizado | Item Mensagens + badge |
| `frontend/src/components/tasks/TaskModal.tsx` | Atualizado | Botão chat em subtarefa |
| `frontend/src/App.tsx` | Atualizado | Rota /chat |

### Resultados esperados de build/test
- `npm run build` deve compilar sem erros.
- `npm run test` deve manter todos os 20+ testes de segurança passando (sem alteração de auth/tenant/CSRF).
- `npm run frontend:build` deve gerar bundle sem erros de TypeScript.

### Pendências / Próximos passos

1. **Deploy produção/staging**: ver passos no `docs/CHAT_IMPLEMENTACAO.md`.
2. **Busca de usuários**: a tela de Nova Conversa usa `usersApi.list()` que já existe. Para ADMIN que gerencie múltiplos tenants, garantir que o tenant correto esteja no header X-Tenant-Slug.
3. **Notificações push** (futuro): o polling pode ser substituído por Server-Sent Events (SSE) sem mudança de contrato de API, apenas adicionando um endpoint `/api/chat/events`.
4. **Deleção de mensagem**: endpoint não implementado nesta fase (soft delete existe na DB). Pode ser adicionado via `DELETE /api/chat/threads/:threadId/messages/:messageId`.
