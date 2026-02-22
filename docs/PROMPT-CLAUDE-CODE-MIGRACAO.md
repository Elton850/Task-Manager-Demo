# Prompt para Claude Code — Migração Task-Manager → Supabase

Use este arquivo no **Claude Code** (ou outra IA de código) para realizar a migração do banco de dados de **SQLite** para **Supabase** de forma segura e passo a passo.

---

## Antes de colar o prompt

1. **Testes verdes:** rode `npm run test` e confirme que os 16 testes passam (Fase 0 já foi validada).
2. **Documento de referência:** o Claude deve usar **`docs/PROMPT-MIGRACAO-SUPABASE.md`** como referência completa (schema, tabelas, arquivos que importam `db`, fases, checklist de segurança).
3. **Caminho do projeto:** substitua `[CAMINHO_RAIZ]` pelo caminho absoluto da pasta do projeto (ex.: `c:\Users\elton\OneDrive\Documentos\Task-Manager` ou `/home/user/Task-Manager`).
4. **Fase:** escolha executar uma fase, várias em sequência ou todas. Ex.: `Fase 1` / `Fases 1 e 2` / `Fases 0 a 5`.

---

## Prompt para colar no Claude Code

Copie o bloco abaixo **inteiro** e cole no chat do Claude Code. Ajuste apenas **CAMINHO_RAIZ** e **FASE** conforme indicado.

```
O projeto Task-Manager está em: "C:\Users\elton\OneDrive\Documentos\Task-Manager"

Leia o documento docs/PROMPT-MIGRACAO-SUPABASE.md na raiz do projeto. Ele contém o contexto completo (stack, banco atual SQLite em src/db/index.ts, tabelas, arquivos que importam db, variáveis de ambiente), as fases da migração (0 a 5), os objetivos, as regras e o checklist de segurança.

Siga estritamente esse documento:
1. Execute as fases na ordem (0 → 1 → 2 → 3 → 4 opcional → 5).
2. Não pule fases; valide cada uma antes de avançar (testes, contagens, documentação).
3. Não altere a lógica de negócio das rotas; apenas o meio de acesso aos dados.
4. Mantenha suporte a DB_PROVIDER=sqlite; quando DB_PROVIDER=supabase use Supabase.
5. Nunca exponha SUPABASE_SERVICE_ROLE_KEY no frontend; use sempre parâmetros em queries.

Agora execute a(s) seguinte(s) fase(s): Fases 0 a 5 (exceto Fase 4 opcional, a menos que eu queira migrar arquivos para Storage)

Ao final de cada fase, indique o que foi feito e o que validar (ex.: rodar npm run test, executar script SQL no Supabase, rodar script de migração de dados). Se for Fase 0, confirme que os testes passam e que .env.example e docs/ENV-REQUISITOS.md estão adequados. O projeto tem um script opcional npm run validate:supabase para validar variáveis quando DB_PROVIDER=supabase.
```

---

## Exemplos de uso

- **Só validar pré-requisitos (Fase 0):**  
  Substitua `[FASE]` por: `Fase 0`

- **Criar o schema no Supabase (Fase 1):**  
  Substitua `[FASE]` por: `Fase 1`

- **Fases 1 e 2 (schema + abstração no backend):**  
  Substitua `[FASE]` por: `Fases 1 e 2`

- **Migração completa (todas as fases):**  
  Substitua `[FASE]` por: `Fases 0 a 5 (exceto Fase 4 opcional, a menos que eu queira migrar arquivos para Storage)`

- **Só script de migração de dados (Fase 3):**  
  Substitua `[FASE]` por: `Fase 3`

---

## Após a migração

- Rode `npm run test` com `DB_PROVIDER=sqlite` (padrão nos testes) e confirme que continua passando.
- Quando for usar Supabase: defina `DB_PROVIDER=supabase` e as variáveis `SUPABASE_*` no `.env`, rode `npm run validate:supabase` e teste login e listagem no app.
- Não commite `.env` nem chaves Supabase no repositório.

---

## Status da migração (atualizado)

| Fase | Descrição | Status |
|------|-----------|--------|
| **0** | Pré-requisitos e validações (.env.example, validate:supabase, docs/ENV-REQUISITOS.md, testes) | ✅ Concluída |
| **1** | Schema PostgreSQL no Supabase (`scripts/supabase-schema.sql`) | ✅ Concluída |
| **2** | Abstração de acesso (src/db/index.ts, sqlite.ts, pg.ts, types.ts, withDbContext) | ✅ Concluída |
| **3** | Script de migração de dados (`npm run migrate:supabase`) | ✅ Concluída |
| **4** | Arquivos/evidências no Storage | ⏭️ Opcional |
| **5** | Validação de env no server, testes, documentação | ✅ Concluída |

**Última revisão:** seed `seedSystemAdminIfNeeded` convertido para async (compatível com Supabase); tipos em `src/db/sqlite.ts` ajustados para compilação. Testes: 16/16 passando com `DB_PROVIDER=sqlite`.
