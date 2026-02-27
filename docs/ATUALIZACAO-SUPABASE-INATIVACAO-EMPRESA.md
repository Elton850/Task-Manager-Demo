# Atualização do Supabase — Inativação de empresa em massa

Quando você **inativa uma empresa** (tenant), o sistema:

- Marca a empresa como inativa.
- **Inativa todos os usuários** (Users, Leaders e Admins) daquela empresa.
- Guarda quem estava ativo para, ao **reativar** a empresa, reativar só esses usuários (quem já estava inativo continua inativo).

Para isso, o banco precisa da coluna `active_before_tenant_deactivation` na tabela `users`.

---

## Procedimento de atualização no Supabase

Execute **uma vez** no **SQL Editor** do projeto Supabase (produção e/ou staging):

1. Acesse o **Dashboard** do Supabase → **SQL Editor**.
2. Cole e execute o script abaixo (ou o conteúdo de `scripts/migrations/add-users-active-before-tenant-deactivation.sql`):

```sql
-- Se a coluna já existir, este comando falhará; execute apenas uma vez.
ALTER TABLE users ADD COLUMN active_before_tenant_deactivation INTEGER;
```

3. Se aparecer erro de coluna já existente, ignore (a atualização já foi feita).
4. Depois disso, faça o deploy da nova versão do backend. O toggle de empresa (Cadastro de empresas → Ativar/Inativar) passará a inativar/reativar os usuários em massa conforme descrito acima.

---

## Onde ativar/inativar empresa

- **Frontend:** **Cadastro de empresas** (rota `/empresas`, apenas administrador do sistema).
- **API:** `PATCH /api/tenants/:id/toggle-active` (requer admin do sistema ou chave de serviço).
- O tenant **system** não pode ser inativado (a API retorna 400).

---

## Resumo

| Etapa | Ação |
|-------|------|
| 1 | No Supabase (prod e/ou staging): SQL Editor → `ALTER TABLE users ADD COLUMN active_before_tenant_deactivation INTEGER;` |
| 2 | Deploy do backend com a feature de toggle (inativar/reativar empresa + usuários em massa). |
| 3 | No frontend, em **Cadastro de empresas**, usar o botão **Inativar** / **Ativar** na coluna Status.
