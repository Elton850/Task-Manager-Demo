# Guia para IAs e Agentes — Task Manager

**Documento de referência obrigatória para qualquer IA (Cursor, Claude, ChatGPT, etc.) que vá modificar este repositório.**

---

## Prompt chave (use para referenciar este guia)

Ao pedir alterações no projeto, inclua uma destas frases para que a IA carregue e siga este guia:

```
Antes de qualquer alteração, leia e siga rigorosamente o guia em docs/GUIA-IA-AGENTES.md.
```

Ou, mais curto:

```
@docs/GUIA-IA-AGENTES.md — seguir este guia em todas as alterações.
```

Ou:

```
Siga o GUIA-IA-AGENTES: testar antes de executar, verificar com cautela, atenção crítica à base de produção. docs/GUIA-IA-AGENTES.md
```

---

## Objetivo deste guia

Garantir que toda modificação no código:

1. **Seja testada antes de ser considerada concluída** (testes existentes e build).
2. **Seja verificada com cautela** (sem introduzir bugs ou erros desnecessários).
3. **Mantenha atenção crítica à base de produção** (sem alterações destrutivas ou perigosas em banco, env ou deploy).

Este guia tem **prioridade** sobre sugestões genéricas de “melhoria” que possam colocar produção em risco.

---

## Fluxo obrigatório antes de concluir alterações

Sempre que você (a IA) fizer alterações no código:

1. **Antes de finalizar**
   - Rodar `npm run test` (e `npm run test:security` se aplicável) e garantir que **todos os testes passam**.
   - Garantir que `npm run build` (backend) e `npm run frontend:build` (frontend) **concluem sem erro**.
   - Se alterou rotas, auth, tenant ou banco: revisar mentalmente se nenhuma regra de segurança ou isolamento de tenant foi enfraquecida.

2. **Ao tocar em banco de dados, migrações ou seeds**
   - **Não** alterar esquema (tabelas, colunas, tipos) sem migração explícita e documentada.
   - **Não** remover ou renomear colunas usadas em produção.
   - **Não** introduzir DELETE/UPDATE em massa sem WHERE adequado ou sem confirmação explícita (ex.: scripts com `--confirm`).
   - Scripts de seed/migrate devem permanecer **idempotentes** e seguros quando documentados.

3. **Ao tocar em variáveis de ambiente ou credenciais**
   - **Não** remover variáveis usadas em produção (ex.: `SUPABASE_*`, `RESEND_*`, `JWT_SECRET`, `APP_DOMAIN`).
   - **Não** hardcodar credenciais ou URLs de staging/produção no código.
   - O carregamento de env está em `src/load-env.ts`; não alterar a ordem nem misturar ambientes.

4. **Ao tocar em autenticação, autorização ou multi-tenant**
   - **Não** simplificar ou remover checagens de `req.user`, `tenant_id`, `role` ou `slug`.
   - Qualquer mudança deve ser **equivalente em resultado** (mesmo acesso permitido/negado).
   - Preservar isolamento entre tenants (tenant A não acessa dados do tenant B).

---

## O que NUNCA fazer

- **Banco de produção:** alterar esquema sem migração; executar scripts destrutivos (truncate, delete em massa) em código que rode em produção.
- **Segurança:** remover validações de auth, tenant, CSRF, rate limit ou sanitização de inputs.
- **Ambiente:** misturar credenciais/URLs de staging e produção; alterar a lógica de carregamento de `.env` de forma que produção use arquivo errado.
- **Contratos:** alterar rotas públicas (login, request-reset, reset, CSRF, health) de forma que clientes ou testes existentes quebrem.
- **Testes:** remover ou alterar asserts que garantem segurança (auth, tenant, CSRF, CORS) de modo que o comportamento esperado mude.

---

## O que SEMPRE fazer

- **Testar:** após alterações, rodar `npm run test` e garantir build do backend e frontend.
- **Validar impacto:** ao refatorar queries, rotas ou middleware, manter a **mesma lógica** (mesmos WHERE, mesmos campos, mesma ordem; mesma resposta HTTP e regras de acesso).
- **Documentar exceções:** se for absolutamente necessário alterar esquema ou contrato de API, documentar a mudança e, quando houver migração, deixá-la explícita e reversível quando possível.
- **Erros e bugs:** não introduzir mudanças que quebrem fluxos existentes; em dúvida, não remover validações nem tratamento de erro.

---

## Estrutura do projeto (referência rápida)

| Área | Cuidado principal |
|------|-------------------|
| `src/routes/` | Manter contratos HTTP (method, path, body, response); preservar auth e tenant. |
| `src/db/` | Não alterar esquema; queries devem manter mesma lógica. |
| `src/middleware/` | Auth, tenant, CSRF — não alterar comportamento. |
| `frontend/src/` | Manter UI e fluxos; APIs e tipos alinhados ao backend. |
| `scripts/` | Migrations, seed, sync — idempotência e segurança. |
| `tests/` | Manter ou aumentar cobertura; não alterar comportamento assertado. |

---

## Documentos relacionados

- **[PROMPT-CLEAN-CODE-REFATORACAO.md](../PROMPT-CLEAN-CODE-REFATORACAO.md)** — Refatoração em Clean Code com as mesmas regras de produção.
- **[TESTES-E-AMBIENTES.md](./TESTES-E-AMBIENTES.md)** — Como rodar testes, seed e preparar ambientes.
- **[README-DOCS.md](./README-DOCS.md)** — Índice de toda a documentação.

---

## Critério de sucesso para a IA

Uma alteração está concluída somente quando:

- Todos os testes existentes **passam**.
- Backend e frontend **fazem build sem erro**.
- Nenhuma regra deste guia foi violada (banco, segurança, ambiente, contratos).
- O usuário não fica com bugs ou erros desnecessários após a mudança.

Em caso de dúvida sobre impacto em produção ou banco: **preferir não alterar** ou propor a alteração com migração/checklist explícita.
