# Chat Interno - Ajustes de Seguranca, Performance e Realtime

## Objetivo
Definir os ajustes obrigatorios para evoluir o chat atual para tempo real com seguranca, performance e compatibilidade com os 3 ambientes:
- Producao (`fluxiva.com.br`, subdominio)
- Staging (`staging.fluxiva.com.br`, path-based)
- Desenvolvimento (localhost, path-based)

Este documento deve ser usado como base da implementacao.

## Contexto Atual
- Chat ja implementado com polling.
- Estrutura base existente:
  - `chat_threads`
  - `chat_thread_participants`
  - `chat_messages`
  - `chat_message_receipts`
  - `chat_message_events`
- Endpoints existentes em `src/routes/chat.ts`.

## Ajustes Criticos Antes de Realtime

### 1. Correcao de autorizacao em thread de subtarefa
Problema atual:
- `POST /api/chat/threads/subtask/:subtaskId` cria/retorna thread sem validar corretamente se o usuario pode acessar a subtarefa.

Correcao:
- Reaproveitar regra de permissao de tarefa/subtarefa ja existente em `tasks.ts` (ou extrair helper compartilhado).
- Permitir abrir thread apenas se usuario:
  - for responsavel da subtarefa, ou
  - for responsavel da tarefa principal relacionada, ou
  - for `LEADER/ADMIN` com permissao de area/tenant equivalente.

### 2. Evitar vazamento de `threadId`
Problema atual:
- Endpoint pode retornar `threadId` para quem nao e participante.

Correcao:
- Se nao participante e sem permissao para auto-join (caso permitido por regra), retornar `403` sem expor `threadId`.

### 3. Evitar duplicacao de threads por corrida
Problema atual:
- Fluxo "busca e depois cria" permite duplicacao sob concorrencia.

Correcao:
- Envolver criacao em transacao e adicionar restricoes de unicidade no banco.

## Ajustes de Schema Recomendados

### PostgreSQL/Supabase (migracao incremental)
Adicionar colunas para chave canonica de chat direto:
- `chat_threads.participant_a_user_id TEXT NULL REFERENCES users(id)`
- `chat_threads.participant_b_user_id TEXT NULL REFERENCES users(id)`

Regra:
- Em thread `direct`, gravar sempre os dois ids em ordem lexicografica (`min`, `max`).

Indices/restricoes:
- Unicidade por subtarefa:
  - `UNIQUE (tenant_id, subtask_id)` com filtro `WHERE type='subtask'`.
- Unicidade por conversa direta:
  - `UNIQUE (tenant_id, type, participant_a_user_id, participant_b_user_id)` com filtro `WHERE type='direct'`.
- Indice para nao lidas:
  - `chat_thread_participants(user_id, unread_count)`.
- Indice para leitura por mensagem:
  - `chat_message_events(message_id, user_id, event_type)`.

Observacao:
- Criar migracao idempotente (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).

### SQLite (dev)
- Aplicar os mesmos campos/indices no bloco de migration inline em `src/db/sqlite.ts`.
- Criar script equivalente em `scripts/migrations/chat-schema-sqlite.sql`.

## Performance no Backend

### 1. Remover N+1 de threads
Problema:
- Lista de threads busca participantes em loop.

Ajuste:
- Buscar participantes em lote por `thread_id IN (...)` e montar mapa em memoria.

### 2. Remover N+1 de read status
Problema:
- Status de leitura/entrega e carregado mensagem a mensagem.

Ajuste:
- Buscar receipts e delivered events em lote para os `message_id` da pagina.

### 3. Manter contadores denormalizados
- Continuar usando `unread_count` em `chat_thread_participants`.
- Evitar `COUNT(*)` pesado em toda requisicao.

### 4. Limites e protecoes
- Manter limite de tamanho de mensagem (4000).
- Rate limit dedicado para envio.
- Opcional: idempotencia por `client_msg_id` para evitar duplicado em reenvio de rede.

## Realtime Seguro e Performatico

## Abordagem recomendada
Implementar Socket.IO no backend atual (sem expor escrita direta no Supabase a partir do frontend).

Motivo:
- Mantem regras de auth/tenant/CSRF/roles centralizadas no backend.
- Evita duplicar logica sensivel no cliente.
- Mais previsivel para producao/staging path/subdominio.

## Fluxo
1. Cliente autentica via cookie JWT atual.
2. Socket conecta em namespace `/ws-chat`.
3. Servidor valida usuario/tenant no handshake.
4. Cliente solicita `join_thread` com `threadId`.
5. Servidor valida participacao no thread antes de `socket.join(room)`.
6. Ao enviar mensagem via API HTTP (mantido), backend publica evento Socket para sala da thread:
   - `chat:new_message`
   - `chat:thread_unread_update`
7. Ao marcar leitura:
   - `chat:message_read`
   - `chat:thread_unread_update`

Observacao importante:
- Escrita continua via HTTP para manter auditoria/rate limit/consistencia.
- Socket usado para "push" de atualizacao.

## Fallback resiliente
- Manter polling leve:
  - threads/unread: 30s
  - mensagens abertas: 5-10s
- Se socket cair, UI continua funcional.

## Status online/offline
E possivel implementar sem impacto relevante, com modelo leve.

Modelo recomendado (fase 1):
- Presenca efemera em memoria no backend:
  - mapa `tenantId:userId -> conexoes ativas`.
  - status `online` se conexoes > 0.
- Expor endpoint:
  - `GET /api/chat/presence?userIds=...`
- Emitir eventos:
  - `chat:presence_update` em mudanca de estado.

Limite:
- Em multipla instancia/cluster, presenca em memoria nao e globalmente consistente.

Quando houver mais de 1 instancia:
- usar Redis adapter para Socket.IO ou
- usar Supabase Realtime Presence apenas para presenca (sem escrita de mensagens).

Recomendacao pratica:
- Se producao roda 1 instancia PM2, fase 1 e aceitavel.
- Para escalar horizontalmente, planejar fase 2 com Redis adapter.

## Seguranca em Realtime
- Validar tenant e usuario no handshake.
- Nunca confiar em `threadId` enviado pelo cliente sem checagem de participacao.
- Nao emitir dados de thread para sockets nao autorizados.
- Reaproveitar bloqueio de impersonation para escrita.
- Limitar frequencia de eventos de socket por conexao (anti-abuso).
- Sanitizar payload e logar erro sem vazar stack para cliente.

## Plano de Implementacao (passo a passo)

### Fase 0 - Preparacao
1. Ler `docs/GUIA-IA-AGENTES.md`.
2. Atualizar `STATE.json` com fase atual.
3. Registrar inicio em `IMPLEMENTATION_LOG.md`.

### Fase 1 - Hardening
1. Corrigir autorizacao do endpoint de subtarefa.
2. Corrigir vazamento de `threadId`.
3. Criar migracoes de unicidade.
4. Refatorar queries N+1.
5. Testes backend.

### Fase 2 - Infra Realtime
1. Integrar Socket.IO no servidor Express.
2. Implementar auth/tenant handshake.
3. Implementar join seguro por thread.
4. Emitir eventos em envio/leitura.

### Fase 3 - Frontend Realtime
1. Cliente Socket com reconexao automatica.
2. Assinatura da thread ativa.
3. Atualizacao otimista + reconciliacao por evento.
4. Fallback para polling.

### Fase 4 - Presenca online/offline (opcional controlado)
1. Implementar mapa de conexao em memoria.
2. Endpoint/evento de presenca.
3. Exibir status no UI sem bloquear experiencia.

### Fase 5 - Validacao final
1. `npm run test`
2. `npm run build`
3. `npm run frontend:build`
4. Checklist manual:
   - abrir thread direta
   - abrir por subtarefa
   - receber mensagem em tempo real
   - badge de nao lidas atualiza
   - mark read atualiza status
   - tenant isolation validado

## Entregaveis obrigatorios
- Codigo com ajustes e realtime.
- SQL incremental para PostgreSQL/Supabase e SQLite.
- Atualizacao de:
  - `IMPLEMENTATION_LOG.md`
  - `STATE.json`
  - `docs/CHAT_IMPLEMENTACAO.md` (se contrato mudar)
- Passos de deploy seguros para staging/producao.

## Riscos e mitigacoes
- Risco: regressao de permissao.
  - Mitigacao: testes de autorizacao por role/tenant.
- Risco: duplicacao de thread.
  - Mitigacao: unique constraints + transacao.
- Risco: custo alto por polling+socket.
  - Mitigacao: reduzir polling quando socket conectado.
- Risco: presenca inconsistente em multi-instancia.
  - Mitigacao: documentar limitacao e prever Redis adapter.
