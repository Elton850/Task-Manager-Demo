# Prompt para Claude Code - Upgrade de Observabilidade e Performance do Chat no Master

Use este prompt no Claude Code:

```txt
Voce vai evoluir o monitoramento de performance do chat no backend e na pagina Master (`/sistema`), sem degradar desempenho.

LEITURA OBRIGATORIA ANTES DE CODAR
1) Leia integralmente:
   - docs/GUIA-IA-AGENTES.md
   - docs/CHAT_IMPLEMENTACAO.md
   - docs/CHAT_REALTIME_AJUSTES.md
2) Registre no IMPLEMENTATION_LOG.md que os documentos foram lidos.

OBJETIVO
Aprimorar os indicadores de performance do chat com baixo custo computacional e alta confiabilidade operacional.

ESCOPO
1. Backend
- Evoluir `GET /api/system/chat-metrics` com metricas agregadas e leves.
- Manter controle de acesso restrito ao admin do tenant system.
- Adotar cache curto em memoria (se necessario, ajustar TTL).

2. Frontend Master
- Evoluir cards/indicadores em `SystemDashboardPage` sem bibliotecas pesadas.
- Polling leve e resiliente.
- Fallback seguro em erro (nao quebrar dashboard).

3. Qualidade e seguranca
- Nao quebrar rotas existentes.
- Nao introduzir consulta pesada sem indice.
- Nao expor dado sensivel de tenant indevido.

EXECUCAO FASEADA

FASE 0 - Preparacao
- Atualizar STATE.json e registrar inicio no IMPLEMENTATION_LOG.md.

FASE 1 - Analise
- Revisar implementacao atual de metricas em `src/routes/system.ts` e frontend relacionado.
- Identificar gargalos e melhorias objetivas.

FASE 2 - Implementacao
- Aplicar melhorias com menor impacto.
- Se houver necessidade de banco, criar migracoes idempotentes e documentar.

FASE 3 - Validacao
- Executar obrigatoriamente:
  - npm run test
  - npm run build
  - npm run frontend:build

FASE 4 - Documentacao final
- Atualizar:
  - IMPLEMENTATION_LOG.md
  - STATE.json
  - docs/CHAT_IMPLEMENTACAO.md (se contrato mudar)

ENTREGA FINAL
1) Resumo das melhorias.
2) Arquivos alterados.
3) Resultado dos testes.
4) SQL/migracoes (se aplicavel).
5) Passo a passo de deploy (se aplicavel).

REGRA DE HANDOFF
Se houver expiracao de sessao, deixar STATE.json e IMPLEMENTATION_LOG.md consistentes para continuidade.
```

## Observacao
Este prompt e para ciclos de manutencao/evolucao, considerando que o endpoint de metricas do chat no Master ja existe.
