# Planejamento: domínio e subdomínios (empresa.dominio.com.br)

Roteiro para colocar o site no ar com domínio (ex.: HostGator) e usar **empresa.dominio.com.br** (multi-tenant). Sem implementação de código — apenas o que configurar.

---

## 1. O que o projeto já suporta

- **Backend** (`src/middleware/tenant.ts`): resolve o tenant pelo **subdomínio** do `Host` (ex.: `minhaempresa.dominio.com.br` → slug `minhaempresa`).
- **Frontend** (`api.ts`, `getTenantSlugFromUrl()`): considera o hostname; com 3+ partes usa o primeiro segmento como slug.
- **Conclusão:** o formato empresa.dominio.com.br já está coberto; falta **DNS, servidor e variáveis de ambiente**.

### Cadastro de empresas e link dinâmico

- Tela **Cadastro de empresas** (área sistema) já existe; a API devolve `accessUrl` em formato path (`/{slug}`).
- Para exibir **https://slug.dominio.com.br**: definir variável de “domínio base” (ex.: `APP_DOMAIN`) e montar o link no backend/frontend (e opcionalmente botão “Copiar link”).

---

## 2. Passo a passo (resumo)

### Domínio e hospedagem

1. Comprar/gerenciar domínio (ex.: HostGator); anotar painel de DNS.
2. Hospedar a aplicação em **VPS** ou PaaS com Node (HostGator VPS, OCI, Railway, etc.). Em compartilhado PHP normalmente não roda Node.
3. Fazer deploy da API e do frontend e testar pela URL do serviço; só depois apontar o domínio.

### DNS

| Tipo   | Nome/Host | Valor        | Uso |
|--------|-----------|--------------|-----|
| A/CNAME | `@`       | IP do servidor | Domínio raiz |
| A/CNAME | `*` (wildcard) | Mesmo IP   | Para **empresa.dominio.com.br** para qualquer slug |

Sem wildcard `*`, só subdomínios criados manualmente funcionam.

### Servidor (ex.: VPS com Nginx)

- Node (backend) na porta 3000; build do frontend em pasta servida pelo Nginx.
- Nginx: servir estáticos em `https://dominio.com.br` e `https://*.dominio.com.br`; **proxy** de `/api` para o Node (ex.: `http://127.0.0.1:3000`).
- Backend identifica o tenant pelo `Host` (subdomínio).

### Variáveis em produção

- `NODE_ENV=production`, `JWT_SECRET` (≥ 32 chars), `ALLOWED_ORIGINS`, `ALLOWED_HOST_PATTERN` (ex.: `^([a-z0-9-]+\\.)?dominio\\.com\\.br$`).
- Se usar Supabase: `DB_PROVIDER`, `SUPABASE_*`, `SUPABASE_DB_URL`.

### SSL (HTTPS)

- Certificado wildcard (ex.: Let’s Encrypt `*.dominio.com.br`) cobre domínio raiz e subdomínios.

---

## 3. O que falta (resumo)

| Item | Situação | Ação |
|------|----------|------|
| Tenant por subdomínio | Implementado | Nada. |
| Aceitar só hosts do domínio | Existe `ALLOWED_HOST_PATTERN` | Configurar em produção com regex do domínio. |
| DNS wildcard `*.dominio.com.br` | A fazer | Criar registro no painel DNS. |
| Hospedagem Node + frontend | A definir | VPS ou PaaS; depois apontar domínio. |
| Link “empresa.dominio.com.br” ao cadastrar | Não implementado | Variável de domínio base + montar e exibir (e opcionalmente copiar) na tela de empresas. |

---

## 4. Ordem sugerida (checklist)

1. [ ] Comprar/gerenciar domínio; anotar painel DNS.
2. [ ] Definir onde a app roda (VPS/PaaS); deploy e testar pela URL do serviço.
3. [ ] DNS: apontar raiz e wildcard `*` para o servidor/serviço.
4. [ ] Nginx: virtual host para dominio.com.br e *.dominio.com.br; proxy /api; SSL.
5. [ ] Variáveis: `ALLOWED_ORIGINS`, `ALLOWED_HOST_PATTERN`, `JWT_SECRET`, Supabase se for o caso.
6. [ ] (Futuro) Variável de domínio base e exibir link completo (https://{slug}.dominio.com.br) no cadastro de empresas.

---

- **Slug = subdomínio:** o identificador da empresa já é o subdomínio (normalizado para a-z, 0-9, hífen).
- **Admin do sistema:** tenant "system" pode usar subdomínio dedicado (ex.: `app.dominio.com.br` ou `sistema.dominio.com.br`) desde que o backend trate esse host como "system"; a lógica atual suporta.

Detalhes de deploy na VPS: [DEPLOY.md](./DEPLOY.md). Variáveis: [ENV-REQUISITOS.md](./ENV-REQUISITOS.md).
