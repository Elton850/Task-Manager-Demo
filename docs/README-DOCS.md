# Documentação — Task Manager

Índice da documentação do projeto. Use este arquivo para localizar o guia certo.

---

## Guia para IAs e agentes (obrigatório em alterações)

| Documento | Conteúdo |
|-----------|----------|
| **[GUIA-IA-AGENTES.md](./GUIA-IA-AGENTES.md)** | **Guia de referência para qualquer IA que modifique o projeto.** Regras obrigatórias: testar antes de executar, verificar com cautela, atenção crítica à base de produção. Inclui o **prompt chave** para você referenciar o guia ao pedir alterações. |

**Prompt chave (copie e use ao pedir alterações a uma IA):**  
*"Antes de qualquer alteração, leia e siga rigorosamente o guia em docs/GUIA-IA-AGENTES.md."*

---

## Guias operacionais

| Documento | Conteúdo |
|-----------|----------|
| **[COMO-VERIFICAR-JOB-FERIADOS.md](./COMO-VERIFICAR-JOB-FERIADOS.md)** | Passo a passo para leigos: como verificar se o job de feriados rodou e foi bem-sucedido (banco, API, logs). |
| **[DEPLOY.md](./DEPLOY.md)** | Build e deploy (local + VPS): produção e staging na mesma VPS, PM2, Nginx, .env, checklist. |
| **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** | Problemas comuns: SUPABASE_DB_URL inválida, PM2 errored, SSH connection refused, sudo/hostname, clone Git no VPS. |
| **[ENV-REQUISITOS.md](./ENV-REQUISITOS.md)** | Variáveis de ambiente por ambiente (dev/staging/prod), arquivos `.env`, Supabase, checklist. |
| **[TESTES-E-AMBIENTES.md](./TESTES-E-AMBIENTES.md)** | Como rodar testes (`npm run test`), seed "demo", preparar dev/staging/produção, criar staging no Supabase. |

## Planejamento e produto

| Documento | Conteúdo |
|-----------|----------|
| **[PLANEJAMENTO-DOMINIO-E-SUBDOMINIOS.md](./PLANEJAMENTO-DOMINIO-E-SUBDOMINIOS.md)** | Domínio e subdomínios (`empresa.dominio.com.br`), DNS, SSL, link dinâmico no cadastro de empresas. |
| **[RESUMO-PROJETO-PARA-SOCIO.md](./RESUMO-PROJETO-PARA-SOCIO.md)** | Resumo do sistema para sócios: o que é, para o cliente, para o dev, segurança, possibilidades futuras. |

## Referência técnica (migração)

| Documento | Conteúdo |
|-----------|----------|
| **[PROMPT-MIGRACAO-SUPABASE.md](./PROMPT-MIGRACAO-SUPABASE.md)** | Referência da migração SQLite → Supabase (fases 0–5, schema, abstração, script de migração). Uso com IA ou consulta. |

---

## Resumo rápido por tarefa

- **IA vai modificar o projeto** → [GUIA-IA-AGENTES.md](./GUIA-IA-AGENTES.md) (use o prompt chave)
- **Fazer deploy** → [DEPLOY.md](./DEPLOY.md)
- **Resolver erro no servidor / PM2 / env** → [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Configurar .env (dev/staging/prod)** → [ENV-REQUISITOS.md](./ENV-REQUISITOS.md)
- **Rodar testes e preparar ambientes** → [TESTES-E-AMBIENTES.md](./TESTES-E-AMBIENTES.md)
- **Entender domínio e subdomínios** → [PLANEJAMENTO-DOMINIO-E-SUBDOMINIOS.md](./PLANEJAMENTO-DOMINIO-E-SUBDOMINIOS.md)
- **Apresentar o projeto (sócios)** → [RESUMO-PROJETO-PARA-SOCIO.md](./RESUMO-PROJETO-PARA-SOCIO.md)

## Chat (implementacao e evolucao)

| Documento | Conteudo |
|-----------|----------|
| **[CHAT_IMPLEMENTACAO.md](./CHAT_IMPLEMENTACAO.md)** | Arquitetura e contratos da implementacao atual de chat (polling). |
| **[CHAT_REALTIME_AJUSTES.md](./CHAT_REALTIME_AJUSTES.md)** | Ajustes necessarios (seguranca, performance, concorrencia) e plano para evoluir para realtime com fallback. |
| **[PROMPT-CLAUDE-CHAT-REALTIME.md](./PROMPT-CLAUDE-CHAT-REALTIME.md)** | Prompt pronto para Claude Code executar correcao + realtime por fases com handoff em `IMPLEMENTATION_LOG.md` e `STATE.json`. |
| **[PROMPT-CLAUDE-CHAT-PERFORMANCE-UPGRADE.md](./PROMPT-CLAUDE-CHAT-PERFORMANCE-UPGRADE.md)** | Prompt para upgrades de monitoramento/performance do chat no backend e pagina Master (`/sistema`). |
