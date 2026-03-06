# Prompt para Claude Code - Evolucao e Hardening do Chat Realtime

Use este prompt no Claude Code:

```txt
Voce vai evoluir e endurecer (hardening) o chat realtime ja implementado, sem regressao funcional.

LEITURA OBRIGATORIA ANTES DE CODAR
1) Leia integralmente:
   - docs/GUIA-IA-AGENTES.md
   - docs/CHAT_IMPLEMENTACAO.md
   - docs/CHAT_REALTIME_AJUSTES.md
2) Registre no IMPLEMENTATION_LOG.md que os documentos foram lidos.

OBJETIVO
Aplicar melhorias pontuais de seguranca, desempenho e estabilidade no chat realtime atual.

REGRAS GERAIS
- Nao quebrar contratos de API existentes sem documentar.
- Nao enfraquecer auth, tenant isolation, CSRF, roles ou impersonation read-only.
- Nao introduzir codigo sujo; priorizar clareza e simplicidade.

EXECUCAO FASEADA

FASE 0 - Preparacao
- Atualizar STATE.json com plano de execucao.
- Registrar inicio no IMPLEMENTATION_LOG.md.

FASE 1 - Diagnostico
- Revisar `src/routes/chat.ts`, `src/ws/chat-socket.ts`, `frontend/src/hooks/useSocketChat.ts`.
- Listar riscos reais encontrados (seguranca, N+1, race condition, duplicacao de eventos).

FASE 2 - Implementacao
- Corrigir riscos encontrados com menor impacto possivel.
- Manter fallback de polling funcional quando realtime indisponivel.
- Se precisar alterar schema, criar migracoes idempotentes em:
  - scripts/migrations/chat-schema-postgres.sql
  - scripts/migrations/chat-schema-sqlite.sql

FASE 3 - Validacao
- Executar obrigatoriamente:
  - npm run test
  - npm run build
  - npm run frontend:build
- Corrigir ate estabilizar.

FASE 4 - Documentacao final
- Atualizar:
  - IMPLEMENTATION_LOG.md
  - STATE.json
  - docs/CHAT_IMPLEMENTACAO.md (se contrato/fluxo mudar)

ENTREGA FINAL
1) Resumo por fase.
2) Arquivos alterados.
3) Resultado dos testes.
4) SQL/migracoes (se aplicavel).
5) Passo a passo de deploy/rollback (se aplicavel).

REGRA DE HANDOFF
Se a sessao expirar, deixar STATE.json e IMPLEMENTATION_LOG.md prontos para continuidade por outra IA.
```

## Observacao
Este prompt e para ciclos de melhoria do realtime ja existente, nao para implementacao inicial.
