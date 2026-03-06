# Prompt para Claude Code - Upgrade de Performance do Chat (Backend + Master)

Use exatamente este prompt no Claude Code:

```txt
Voce vai implementar upgrades de monitoramento e manutencao de performance do chat no backend e na pagina Master do sistema, seguindo rigorosamente a documentacao do projeto.

LEITURA OBRIGATORIA ANTES DE CODAR
1) Leia integralmente:
   - docs/GUIA-IA-AGENTES.md
   - docs/CHAT_IMPLEMENTACAO.md
   - docs/CHAT_REALTIME_AJUSTES.md
2) Registre no IMPLEMENTATION_LOG.md que os documentos foram lidos.

OBJETIVO
Adicionar indicadores de performance do chat no backend e exibir esses indicadores na pagina Master do sistema (`/sistema`), sem comprometer desempenho, mantendo seguranca e multi-tenant.

ESCOPO FUNCIONAL
1) Backend:
   - Criar endpoint de performance do chat para administracao do sistema (Master).
   - Retornar metricas agregadas (nao dados brutos pesados).
   - Exemplo de metricas:
     - requests total (janela)
     - rps medio
     - taxa de erro
     - latencia p50/p95/p99 (se disponivel por coleta)
     - mensagens enviadas
     - eventos de leitura
     - nao lidas totais
     - conexoes DB ativas (se viavel no ambiente)
     - status (healthy/warning/critical)
   - Endpoint deve ser leve, com cache curto em memoria (ex.: 15-30s) para evitar custo.

2) Frontend (Master):
   - Integrar os indicadores na pagina do Master do sistema (rota `/sistema`).
   - UI leve (sem libs pesadas de grafico).
   - Atualizacao periodica leve (ex.: 30s).
   - Tratar erro de forma resiliente sem quebrar tela.

3) Seguranca:
   - Endpoint acessivel apenas ao perfil correto de sistema (ADMIN no tenant system).
   - Nao expor dados de tenants indevidamente.
   - Nao enfraquecer auth/tenant/CSRF/roles existentes.

4) Performance:
   - Evitar queries N+1.
   - Evitar full scan sem indice quando possivel.
   - Preferir agregacoes por janela temporal.
   - Manter payload pequeno.

FASEAMENTO OBRIGATORIO (COM HANDOFF)

FASE 0 - Preparacao
- Atualizar STATE.json com fase corrente e plano.
- Registrar inicio no IMPLEMENTATION_LOG.md com timestamp.

FASE 1 - Analise tecnica
- Mapear arquivos atuais:
  - backend: src/routes/system.ts (ou equivalente)
  - frontend: pagina master (`SystemDashboardPage`)
  - services/api.ts e tipos
- Definir contrato de resposta do endpoint.
- Registrar decisoes no IMPLEMENTATION_LOG.md.

FASE 2 - Implementacao backend
- Implementar endpoint de metricas de chat.
- Adicionar qualquer helper necessario de forma limpa.
- Se precisar de suporte no banco:
  - criar SQL idempotente (migracoes) em scripts/migrations
  - atualizar docs com passos de aplicacao
- Adicionar controles de acesso e validacoes.

FASE 3 - Implementacao frontend master
- Integrar chamada no services/api.ts.
- Atualizar tipos em frontend/src/types.
- Renderizar cards de indicadores na pagina Master.
- Polling leve e resiliente.

FASE 4 - Validacao
- Rodar obrigatoriamente:
  - npm run test
  - npm run build
  - npm run frontend:build
- Corrigir erros ate estabilizar.
- Registrar resultados no IMPLEMENTATION_LOG.md e STATE.json.

FASE 5 - Documentacao final
- Atualizar:
  - IMPLEMENTATION_LOG.md
  - STATE.json
  - docs/CHAT_IMPLEMENTACAO.md (se contrato mudar)
  - docs/README-DOCS.md (se novo documento/migracao for adicionado)
- Entregar passo a passo operacional de servidor se houver alteracao de banco/backend.

REQUISITOS DE QUALIDADE
- Evitar codigo sujo e duplicacao desnecessaria.
- Preservar compatibilidade com:
  - Producao (fluxiva.com.br)
  - Staging (staging.fluxiva.com.br)
  - Desenvolvimento (localhost)
- Nao alterar comportamento de seguranca fora do escopo.

SE HOUVER ALTERACAO DE BANCO
- Entregar SQL necessario e idempotente para:
  - SQLite (dev)
  - Postgres/Supabase (staging/producao)
- Explicar passo a passo:
  1. backup recomendado
  2. aplicacao da migracao
  3. build
  4. restart
  5. validacao pos-deploy
  6. rollback seguro (quando aplicavel)

ENTREGA FINAL OBRIGATORIA
1) Resumo por fase.
2) Lista de arquivos alterados.
3) Contrato final do endpoint (request/response).
4) Evidencia dos testes executados.
5) SQL e passos de deploy (se aplicavel).
6) Riscos residuais e proximos passos.

REGRA DE CONTINUIDADE (EXPIRACAO)
- Se o limite de uso/sessao expirar:
  - deixe STATE.json atualizado com pendencias claras
  - deixe IMPLEMENTATION_LOG.md com ultimo passo concluido e proximo passo recomendado
  - nao deixe alteracao critica sem registro
```

## Observacao
- Este prompt foi feito para executar os upgrades de monitoramento/performance do chat com foco na pagina Master e seguranca operacional.
