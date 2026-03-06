# Chat Interno — Documentação de Implementação

## Arquitetura

### Modelo de dados

```
chat_threads
  id          TEXT PK
  tenant_id   TEXT → tenants(id)   [isolamento multi-tenant]
  type        TEXT  CHECK IN ('direct','subtask')
  subtask_id  TEXT → tasks(id)     [NULL para type='direct']
  created_at  TEXT
  updated_at  TEXT                  [atualizado a cada nova mensagem]

chat_thread_participants
  id            TEXT PK
  thread_id     TEXT → chat_threads(id)
  user_id       TEXT → users(id)
  unread_count  INTEGER DEFAULT 0   [denormalizado para performance]
  last_read_at  TEXT
  joined_at     TEXT
  UNIQUE(thread_id, user_id)

chat_messages
  id          TEXT PK
  tenant_id   TEXT → tenants(id)
  thread_id   TEXT → chat_threads(id)
  sender_id   TEXT → users(id)
  content     TEXT                  [max 4000 chars]
  created_at  TEXT
  deleted_at  TEXT                  [soft delete — exibe "[mensagem removida]"]

chat_message_receipts
  id          TEXT PK
  tenant_id   TEXT
  message_id  TEXT → chat_messages(id)
  user_id     TEXT → users(id)
  read_at     TEXT
  UNIQUE(message_id, user_id)

chat_message_events
  id          TEXT PK
  tenant_id   TEXT
  message_id  TEXT → chat_messages(id)
  user_id     TEXT
  event_type  TEXT  CHECK IN ('sent','delivered','read')
  event_at    TEXT
```

### Índices criados
- `idx_chat_threads_tenant` — busca de threads por tenant
- `idx_chat_threads_updated` — ordenação por recência
- `idx_chat_participants_thread` — participantes de um thread
- `idx_chat_participants_user` — threads de um usuário
- `idx_chat_messages_thread` — mensagens de um thread (com cursor)
- `idx_chat_messages_tenant` — mensagens por tenant
- `idx_chat_receipts_message` — recibos de uma mensagem
- `idx_chat_receipts_user` — recibos de um usuário
- `idx_chat_events_message` — eventos de uma mensagem

---

## Endpoints

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/api/chat/unread-count` | Contagem global de não lidas | requireAuth |
| GET | `/api/chat/threads` | Lista threads do usuário | requireAuth |
| POST | `/api/chat/threads/direct` | Abre/cria thread direta | requireAuth |
| POST | `/api/chat/threads/subtask/:subtaskId` | Abre/cria thread de subtarefa | requireAuth |
| GET | `/api/chat/threads/:threadId/messages` | Lista mensagens (cursor) | requireAuth + participante |
| POST | `/api/chat/threads/:threadId/messages` | Envia mensagem | requireAuth + participante |
| POST | `/api/chat/threads/:threadId/read` | Marca como lido | requireAuth + participante |

### Rate limiting
- Envio de mensagens (`POST .../messages`): 60 msg/min por IP
- Geral: 120 req/min por IP (apiLimiter)

### Paginação de mensagens (cursor-based)
```
GET /api/chat/threads/:threadId/messages?before=<ISO_DATE>&limit=50
Resposta:
{
  messages: ChatMessage[],
  readStatuses: { [messageId]: { readBy: string[], deliveredTo: string[] } },
  nextCursor: string | null,
  hasMore: boolean
}
```

---

## Regras de permissão

1. **Isolamento de tenant**: todas as queries incluem `tenant_id = ?`. Nunca há acesso cruzado.
2. **Acesso a threads**: usuário só lê/envia mensagens se for participante verificado pela função `assertParticipant`.
3. **Criação de thread direta**: alvo deve ser usuário ativo do mesmo tenant.
4. **Thread de subtarefa**: subtarefa deve existir e pertencer ao tenant. Participantes iniciais: responsável + criador + solicitante. ADMIN/LEADER são adicionados ao acessar.
5. **Impersonation**: respeita `blockWritesWhenImpersonating` do server (POST bloqueado em read-only).

---

## Estratégia de notificação

- **Contadores**: `unread_count` denormalizado em `chat_thread_participants`. Atualizado atomicamente ao enviar mensagem.
- **Polling**: 30s para lista de threads e contagem global; 5s para mensagens quando a conversa está aberta.
- **Leitura automática**: ao abrir uma conversa, `markRead` é chamado automaticamente → zera `unread_count` e insere recibos.
- **Status de mensagem**:
  - `enviada`: evento `sent` ao criar mensagem
  - `entregue`: evento `delivered` quando receptor carrega a lista de mensagens
  - `lida`: evento `read` + receipt quando receptor abre a conversa

---

## Limites e performance

| Parâmetro | Valor |
|-----------|-------|
| Tamanho máximo de mensagem | 4000 caracteres |
| Mensagens por página | 50 (max 100) |
| Threads listadas | 100 (ordenadas por updated_at DESC) |
| Polling threads/contadores | 30 segundos |
| Polling mensagens abertas | 5 segundos |
| Rate limit envio | 60 msg/min por IP |

---

## Passos de deploy por ambiente

### Desenvolvimento (SQLite local)
Nenhuma ação necessária — schema criado automaticamente ao reiniciar o servidor (`src/db/sqlite.ts`).

```bash
npm run dev
```

### Staging (Supabase)
```bash
# 1. Backup recomendado (via Supabase Dashboard > Database > Backups)

# 2. Aplicar migração SQL
# Conectar ao banco staging e executar:
psql $SUPABASE_DB_URL_STAGING < scripts/migrations/chat-schema-postgres.sql

# 3. Build e restart
npm run build
npm run frontend:build:staging
pm2 restart task-manager-staging

# 4. Validação
curl https://staging.fluxiva.com.br/api/chat/unread-count \
  -H "X-Tenant-Slug: empresateste" \
  # deve retornar 401 sem cookie (correto — requer auth)
```

### Produção (Supabase)
```bash
# 1. BACKUP OBRIGATÓRIO
# Supabase Dashboard > Database > Backups > Create backup

# 2. Janela de manutenção recomendada (baixo tráfego)

# 3. Aplicar migração — todas as tabelas são CREATE IF NOT EXISTS (seguro, idempotente)
psql $SUPABASE_DB_URL_PROD < scripts/migrations/chat-schema-postgres.sql

# 4. Build
npm run build
npm run frontend:build

# 5. Restart
pm2 restart task-manager

# 6. Validação pós-deploy
# - Verificar logs: pm2 logs task-manager | grep -i chat
# - Testar endpoint: GET /api/health → { status: "ok" }
# - Testar unread: GET /api/chat/unread-count com cookie válido → { unread: 0 }
# - Testar UI: abrir /chat e verificar lista de conversas
```

### Rollback
Se necessário reverter antes de qualquer dado ser inserido:
```sql
-- EXECUTAR APENAS SE NECESSÁRIO E COM ZERO DADOS NAS TABELAS DE CHAT
DROP TABLE IF EXISTS chat_message_events;
DROP TABLE IF EXISTS chat_message_receipts;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_thread_participants;
DROP TABLE IF EXISTS chat_threads;
```

**ATENÇÃO**: não fazer rollback se já houver dados de chat em produção — perda de dados.
