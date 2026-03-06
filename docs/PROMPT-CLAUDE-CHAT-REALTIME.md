# Prompt para Claude Code - Hardening + Realtime do Chat

Use exatamente este prompt no Claude Code:

```txt
Voce vai implementar ajustes de seguranca/performance no chat atual e evoluir para realtime, seguindo estritamente o que esta documentado em:
- docs/GUIA-IA-AGENTES.md
- docs/CHAT_REALTIME_AJUSTES.md

INSTRUCAO INICIAL OBRIGATORIA
1) Antes de qualquer alteracao, leia integralmente:
   - docs/GUIA-IA-AGENTES.md
   - docs/CHAT_REALTIME_AJUSTES.md
2) Registre no IMPLEMENTATION_LOG.md que os documentos foram lidos.

OBJETIVO
Corrigir pontos criticos do chat atual e implementar realtime seguro/performatico com fallback, mantendo compatibilidade com:
- Producao (fluxiva.com.br)
- Staging (staging.fluxiva.com.br)
- Desenvolvimento (localhost)

ESCOPO OBRIGATORIO (FASEADO)

FASE 0 - Preparacao e rastreabilidade
- Atualizar STATE.json com:
  - current_phase
  - completed_steps
  - pending_steps
  - blockers
  - next_actions
- Iniciar log detalhado em IMPLEMENTATION_LOG.md (timestamp + acao + resultado).

FASE 1 - Hardening de seguranca e consistencia
- Corrigir autorizacao no endpoint de chat por subtarefa.
- Eliminar vazamento de threadId para nao participantes.
- Evitar duplicacao de threads por condicao de corrida:
  - implementar chave canonica para direct chat
  - adicionar constraints/indices de unicidade
  - usar transacao no fluxo de criacao
- Reforcar filtros de tenant em queries sensiveis.

FASE 2 - Performance backend
- Remover N+1 na listagem de threads (participantes em lote).
- Remover N+1 na leitura de status de mensagens (receipts/events em lote).
- Preservar unread_count denormalizado para eficiencia.

FASE 3 - Realtime backend (Socket.IO)
- Integrar Socket.IO no servidor existente.
- Implementar autenticacao no handshake com cookie/JWT atual.
- Implementar validacao tenant + participacao antes de join em sala.
- Manter escrita por HTTP (send/read) e emitir eventos realtime:
  - chat:new_message
  - chat:message_read
  - chat:thread_unread_update

FASE 4 - Realtime frontend + fallback
- Criar cliente socket com reconexao.
- Assinar thread ativa com join seguro.
- Atualizar UI por eventos em tempo real.
- Manter fallback de polling quando socket indisponivel.
- Evitar loops, duplicacoes e flicker de estado.

FASE 5 - Presenca online/offline (somente se seguro e sem impacto)
- Implementar status online/offline leve, sem degradar sistema.
- Preferencia: presenca efemera por conexoes de socket no backend.
- Expor endpoint/evento para atualizar UI.
- Documentar limitacao de presenca em memoria para multi-instancia.
- Nao implementar solucao que comprometa estabilidade.

REQUISITOS DE SEGURANCA
- Nunca enfraquecer auth, tenant isolation, CSRF, role checks.
- Nao expor eventos/dados de threads para nao participantes.
- Respeitar bloqueio de impersonation para escrita.
- Aplicar rate limit tambem para eventos de socket, se necessario.

REQUISITOS DE QUALIDADE
- Codigo limpo, sem duplicacao desnecessaria.
- Sem quebrar contratos de API existentes.
- SQL idempotente para migracoes.
- Garantir compatibilidade SQLite + Supabase/Postgres.

ARQUIVOS E DOCUMENTACAO OBRIGATORIOS AO LONGO DA EXECUCAO
- IMPLEMENTATION_LOG.md (append continuo)
- STATE.json (estado sempre atualizado)
- docs/CHAT_IMPLEMENTACAO.md (atualizar arquitetura/endpoints se mudar)
- scripts/migrations/chat-schema-postgres.sql (incrementar para novos ajustes)
- scripts/migrations/chat-schema-sqlite.sql (manter equivalente)

TESTES OBRIGATORIOS ANTES DE FINALIZAR
- npm run test
- npm run build
- npm run frontend:build
- Se houver teste adicional de seguranca, executar tambem.

ENTREGA FINAL
Ao concluir, entregar:
1) Resumo do que foi feito por fase.
2) Lista de arquivos alterados.
3) SQL final necessario para staging/producao/dev.
4) Passo a passo de deploy no servidor (staging e producao), com validacao e rollback.
5) Resultado dos testes.
6) Riscos residuais e proximos passos.

REGRAS DE EXECUCAO
- Se houver expiracao de sessao, deixe STATE.json e IMPLEMENTATION_LOG.md prontos para continuidade por outra IA.
- Se encontrar bloqueio, registre claramente no log e proponha proximo passo objetivo.
```

## Observacao de uso
- Este prompt ja presume que a base atual de chat foi implementada.
- Se o Claude detectar divergencias entre codigo e documentacao, ele deve registrar no `IMPLEMENTATION_LOG.md` e seguir com a correcao mais segura.
