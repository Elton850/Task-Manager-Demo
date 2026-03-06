# Chat Interno - Ajustes e Backlog de Evolucao

## Objetivo
Manter o chat seguro, performatico e facil de operar em desenvolvimento, staging e producao.

## Escopo deste documento
Este documento nao descreve a implementacao base ja concluida.
Ele descreve manutencao periodica, backlog tecnico e evolucoes futuras.

Base atual implementada: ver `docs/CHAT_IMPLEMENTACAO.md`.

## Checkpoint atual (2026-03-06)

Itens ja implementados:
- hardening principal de permissao e tenant isolation no chat
- mitigacao de corrida para criacao de thread direta/subtask
- realtime com Socket.IO + fallback para polling
- presenca online/offline basica
- metricas agregadas no Master (`/api/system/chat-metrics`)

## Manutencao periodica recomendada

### Semanal
- validar erro e latencia dos endpoints de chat
- revisar logs de excecao em `chat.ts` e `chat-socket.ts`
- checar comportamento de unread e markRead

### Mensal
- revisar crescimento das tabelas de chat
- revisar uso de indices principais
- revisar custos das queries agregadas de metricas

### Trimestral
- executar teste de carga em staging
- reavaliar limites de rate-limit e polling
- revisar necessidade de escalabilidade horizontal

## Backlog tecnico prioritario

1. Presenca em multi-instancia
- problema: presenca em memoria nao e global quando existem varias instancias
- acao sugerida: Socket.IO Redis adapter

2. Telemetria de latencia por rota
- hoje o endpoint de metricas depende de dados agregados disponiveis
- acao sugerida: middleware leve de medicao com buckets p50/p95/p99 em memoria + flush periodico

3. Politica de retencao para eventos
- `chat_message_events` pode crescer rapidamente
- acao sugerida: job de arquivamento/limpeza por janela (ex.: 90-180 dias), com documentacao de compliance

4. Eliminacao de polling duplicado na UI
- validar se Header e Sidebar disparam polling redundante em paralelo
- acao sugerida: provider central unico de unread no frontend

5. Endpoint de capacidade operativa
- criar endpoint tecnico de capacidade com indicadores minimos para operacao

## Indicadores operacionais recomendados

- p95 de resposta do chat
- taxa de erro 4xx/5xx por rota
- total de nao lidas
- volume de mensagens por janela
- conexoes DB ativas
- conexoes websocket ativas por tenant

## Capacidade e testes de carga (sem afetar producao)

Ambiente:
- rodar em staging com volume de dados representativo

Ferramenta:
- k6 ou Artillery

Cenarios minimos:
1. usuario passivo (threads + unread)
2. usuario com conversa aberta (realtime + markRead)
3. pico de envio de mensagens

Criterios de aceite (referencia inicial):
- p95 < 300-500ms para rotas de chat
- taxa de erro < 1%
- sem saturacao de conexao DB

## Seguranca (sempre validar em mudancas)

- manter checks de tenant em rotas e socket
- nunca expor dados de thread para nao participante
- manter bloqueio de escrita em modo impersonation
- validar payload e tamanho maximo de mensagem

## Processo de mudanca com handoff

Sempre que houver mudanca em chat:
1. atualizar `IMPLEMENTATION_LOG.md`
2. atualizar `STATE.json`
3. atualizar `docs/CHAT_IMPLEMENTACAO.md` se contrato/fluxo mudar
4. executar:
   - `npm run test`
   - `npm run build`
   - `npm run frontend:build`

## Referencias de execucao

- prompt de evolucao realtime: `docs/PROMPT-CLAUDE-CHAT-REALTIME.md`
- prompt de upgrade de metricas/performance: `docs/PROMPT-CLAUDE-CHAT-PERFORMANCE-UPGRADE.md`
