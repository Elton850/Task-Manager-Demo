# Documentacao - Task Manager

Indice oficial da documentacao ativa do projeto.

## Guia obrigatorio para IA

| Documento | Conteudo |
|-----------|----------|
| **[GUIA-IA-AGENTES.md](./GUIA-IA-AGENTES.md)** | Regras obrigatorias para qualquer IA que altere o repositorio (seguranca, testes e cautela em producao). |

Prompt chave:
`Antes de qualquer alteracao, leia e siga rigorosamente o guia em docs/GUIA-IA-AGENTES.md.`

## Operacao e ambiente

| Documento | Conteudo |
|-----------|----------|
| **[DEPLOY.md](./DEPLOY.md)** | Build e deploy para desenvolvimento, staging e producao. |
| **[ENV-REQUISITOS.md](./ENV-REQUISITOS.md)** | Variaveis de ambiente e requisitos por ambiente. |
| **[TESTES-E-AMBIENTES.md](./TESTES-E-AMBIENTES.md)** | Como executar testes e preparar ambientes. |
| **[COMO-VERIFICAR-JOB-FERIADOS.md](./COMO-VERIFICAR-JOB-FERIADOS.md)** | Validacao operacional do job de feriados. |

## Chat (estado atual e evolucao)

| Documento | Conteudo |
|-----------|----------|
| **[CHAT_IMPLEMENTACAO.md](./CHAT_IMPLEMENTACAO.md)** | Estado atual do chat (schema, endpoints, realtime, presenca e metricas no Master). |
| **[CHAT_REALTIME_AJUSTES.md](./CHAT_REALTIME_AJUSTES.md)** | Backlog tecnico do chat (hardening extra, escala, manutencao e capacidade). |
| **[PROMPT-CLAUDE-CHAT-REALTIME.md](./PROMPT-CLAUDE-CHAT-REALTIME.md)** | Prompt faseado para evolucao/correcao de realtime com handoff. |
| **[PROMPT-CLAUDE-CHAT-PERFORMANCE-UPGRADE.md](./PROMPT-CLAUDE-CHAT-PERFORMANCE-UPGRADE.md)** | Prompt faseado para melhorias de observabilidade/performance do chat no backend e no Master. |

## Planejamento e contexto de produto

| Documento | Conteudo |
|-----------|----------|
| **[PLANEJAMENTO-DOMINIO-E-SUBDOMINIOS.md](./PLANEJAMENTO-DOMINIO-E-SUBDOMINIOS.md)** | Direcionamento de dominio e subdominios por tenant. |
| **[RESUMO-PROJETO-PARA-SOCIO.md](./RESUMO-PROJETO-PARA-SOCIO.md)** | Visao executiva do produto para socios. |

## Referencia tecnica adicional

| Documento | Conteudo |
|-----------|----------|
| **[PROMPT-MIGRACAO-SUPABASE.md](./PROMPT-MIGRACAO-SUPABASE.md)** | Guia faseado de migracao SQLite para Supabase/PostgreSQL. |
| **[RELATORIO-SEGURANCA.md](./RELATORIO-SEGURANCA.md)** | Referencia de controles e verificacoes de seguranca. |
