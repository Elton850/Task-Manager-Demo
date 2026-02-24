# Documentação — Task Manager

Índice da documentação do projeto. Use este arquivo para localizar o guia certo.

---

## Guias operacionais

| Documento | Conteúdo |
|-----------|----------|
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

- **Fazer deploy** → [DEPLOY.md](./DEPLOY.md)
- **Resolver erro no servidor / PM2 / env** → [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Configurar .env (dev/staging/prod)** → [ENV-REQUISITOS.md](./ENV-REQUISITOS.md)
- **Rodar testes e preparar ambientes** → [TESTES-E-AMBIENTES.md](./TESTES-E-AMBIENTES.md)
- **Entender domínio e subdomínios** → [PLANEJAMENTO-DOMINIO-E-SUBDOMINIOS.md](./PLANEJAMENTO-DOMINIO-E-SUBDOMINIOS.md)
- **Apresentar o projeto (sócios)** → [RESUMO-PROJETO-PARA-SOCIO.md](./RESUMO-PROJETO-PARA-SOCIO.md)
