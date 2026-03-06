# Chat Interno - Estado Atual de Implementacao

## Status consolidado

Data de referencia: 2026-03-06.

O chat interno esta implementado e funcional com:
- conversas diretas e por subtarefa
- notificacao de nao lidas
- status de mensagem (sent/delivered/read)
- realtime via Socket.IO com fallback para polling
- presenca online/offline basica
- metricas agregadas no painel Master (`/sistema`)

## Backend

Arquivos principais:
- `src/routes/chat.ts`
- `src/ws/chat-socket.ts`
- `src/server.ts`
- `src/routes/system.ts`

## Endpoints de chat

| Metodo | Rota | Finalidade |
|--------|------|------------|
| GET | `/api/chat/unread-count` | Total global de nao lidas do usuario |
| GET | `/api/chat/threads` | Lista conversas do usuario |
| POST | `/api/chat/threads/direct` | Abre/cria conversa direta |
| POST | `/api/chat/threads/subtask/:subtaskId` | Abre/cria conversa vinculada a subtarefa |
| GET | `/api/chat/threads/:threadId/messages` | Lista mensagens com cursor |
| POST | `/api/chat/threads/:threadId/messages` | Envia mensagem |
| POST | `/api/chat/threads/:threadId/read` | Marca como lido |
| GET | `/api/chat/presence?userIds=...` | Presenca online/offline |

## Endpoint de metricas no Master

| Metodo | Rota | Finalidade |
|--------|------|------------|
| GET | `/api/system/chat-metrics` | Indicadores agregados de performance/uso do chat para o admin do tenant `system` |

## Realtime

Namespace Socket.IO:
- `path: /ws-chat`

Eventos usados:
- `chat:new_message`
- `chat:message_read`
- `chat:thread_unread_update`
- `chat:presence_update`

Regra de seguranca:
- handshake autenticado por cookie/JWT
- join em thread apenas com validacao de participacao
- tenant isolation preservado

## Frontend

Arquivos principais:
- `frontend/src/pages/ChatPage.tsx`
- `frontend/src/components/chat/ThreadList.tsx`
- `frontend/src/components/chat/MessagePanel.tsx`
- `frontend/src/hooks/useSocketChat.ts`
- `frontend/src/hooks/useChatUnread.ts`
- `frontend/src/pages/SystemDashboardPage.tsx` (secao de metricas)

Pontos de UX:
- atalho na subtarefa para abrir conversa
- badge de nao lidas no header e sidebar
- fallback automatico para polling quando socket indisponivel

## Banco de dados

Tabelas de chat:
- `chat_threads`
- `chat_thread_participants`
- `chat_messages`
- `chat_message_receipts`
- `chat_message_events`

Evolucoes ja aplicadas:
- colunas canonicias para conversa direta:
  - `participant_a_user_id`
  - `participant_b_user_id`
- indices de unicidade para reduzir duplicacao por corrida

Scripts:
- `scripts/migrations/chat-schema-sqlite.sql`
- `scripts/migrations/chat-schema-postgres.sql`

## Limites e parametros atuais

- tamanho maximo de mensagem: 4000 chars
- pagina de mensagens: default 50, max 100
- rate limit envio: 60 req/min (rota de envio)
- polling unread/lista: 30s
- polling mensagens abertas: fallback quando realtime falha
- cache de metricas do Master: 30s

## Seguranca e isolamento

- multi-tenant obrigatorio em queries sensiveis
- acesso a thread apenas para participante autorizado
- checks de role mantidos
- impersonation read-only respeitado para escrita
- CSRF, auth e middlewares globais preservados

## Deploy e operacao

### Desenvolvimento
- SQLite recebe schema/migrations inline no startup.

### Staging/Producao
- aplicar migracoes SQL idempotentes de chat antes do deploy backend, quando aplicavel
- executar build backend/frontend
- reiniciar processo (PM2)
- validar:
  - `/api/health`
  - `/api/chat/unread-count` (autenticado)
  - `/api/system/chat-metrics` (admin system)
  - fluxo de conversa realtime entre 2 usuarios

## Riscos residuais conhecidos

- presenca online/offline em memoria nao e global se houver varias instancias de app
- para escala horizontal, planejar Socket.IO Redis adapter (ou estrategia equivalente)

## Referencias

- plano de evolucao e backlog: `docs/CHAT_REALTIME_AJUSTES.md`
- prompt de evolucao realtime: `docs/PROMPT-CLAUDE-CHAT-REALTIME.md`
- prompt de upgrade de metricas/performance: `docs/PROMPT-CLAUDE-CHAT-PERFORMANCE-UPGRADE.md`
