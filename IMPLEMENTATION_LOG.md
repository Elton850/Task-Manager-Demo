# Implementation Log — Chat Interno

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
