# Planejamento: domínio, colocação no ar e subdomínios (empresa.dominio.com.br)

Este documento é um **plano de verificação e passo a passo** para:
1. Colocar o site no ar usando um domínio comprado na Hostgator.
2. Usar o padrão **empresa.dominio.com.br** (multi-tenant com subdomínios).
3. Na área do desenvolvedor (sistema), ao cadastrar uma empresa, já gerar/exibir o link dinâmico no formato **empresa.dominio.com.br**.

**Não contém implementação de código** — apenas análise do projeto atual e roteiro do que é necessário.

---

## 1. O que o projeto já suporta hoje

### 1.1 Subdomínio (empresa.dominio.com.br)

- **Backend** (`src/middleware/tenant.ts`): já resolve o tenant pelo **subdomínio** do `Host`.  
  Ex.: se o `Host` for `minhaempresa.dominio.com.br`, o slug da empresa é **minhaempresa** (primeiro segmento do host).
- **Frontend** (`frontend/src/services/api.ts`, `getTenantSlugFromUrl()`): já considera o hostname; se não for localhost e tiver pelo menos 3 partes (ex.: `minhaempresa.dominio.com.br`), usa o primeiro segmento como slug do tenant.
- **Conclusão:** o template **empresa.dominio.com.br** já está coberto pela lógica atual; falta apenas **configuração de DNS, servidor e variáveis de ambiente**.

### 1.2 Cadastro de empresa na área “desenvolvedor / sistema”

- A tela **Cadastro de empresas** (área do administrador do sistema) já existe: **Empresas** no menu do sistema (rota `/sistema` → lista de empresas).
- Ao criar uma empresa, o usuário informa **Identificador (slug)** e **Nome**. O slug é normalizado (minúsculas, apenas a-z, 0-9, hífen).
- A API `POST /api/tenants` já devolve `accessUrl`, hoje no formato **path**: `/{slug}` (ex.: `/minhaempresa`).
- Na interface, hoje aparece um texto genérico do tipo “site.com/slug”. **Não** há exibição do link completo no formato **https://slug.dominio.com.br**; isso pode ser adicionado depois com uma variável de “domínio base” (backend e/ou frontend).

### 1.3 Link dinâmico ao cadastrar empresa

- **É possível** que, ao cadastrar a empresa no sistema, o link da empresa seja exatamente **empresa.dominio.com.br** (onde `empresa` = slug cadastrado).
- O slug já define o subdomínio. Falta:
  - Definir o **domínio base** (ex.: `dominio.com.br`) em configuração (variável de ambiente).
  - Backend e/ou frontend passarem a **montar e exibir** o link completo `https://{slug}.dominio.com.br` (e, se quiser, copiar para a área de transferência).
- Nada disso exige mudança no modelo de dados: o slug já existe e já é usado como subdomínio.

---

## 2. Passo a passo para colocar o site no ar (domínio Hostgator)

### 2.1 Comprar e configurar o domínio na Hostgator

1. Comprar o domínio (ex.: **dominio.com.br**) na Hostgator.
2. Anotar onde está o **painel de DNS** (geralmente no painel da Hostgator ou no registro.br, se for .com.br).
3. Você vai precisar apontar:
   - **Domínio principal** (ex.: `dominio.com.br`) para o servidor onde o site fica (ou para uma página institucional).
   - **Subdomínios silvestres (wildcard)** `*.dominio.com.br` para o **mesmo** servidor onde roda a aplicação (Node + frontend), para que `qualquerempresa.dominio.com.br` funcione.

### 2.2 Onde hospedar a aplicação (Node + React)

- A aplicação é **Node.js (Express)** + **React (Vite)**. Hostgator em plano compartilhado normalmente **não** executa Node.js de forma adequada.
- Opções práticas:
  - **VPS** (Hostgator VPS ou outro provedor): você instala Node, sobe o backend e o build do frontend (ex.: Nginx servindo estático + proxy para a API).
  - **Plataformas que rodam Node** (ex.: Railway, Render, Fly.io, DigitalOcean App Platform): você faz deploy do backend e do frontend e usa o domínio da Hostgator apontando para esses serviços (via DNS).
- Recomendações de ordem de passos:
  1. Escolher **onde** a aplicação vai rodar (VPS ou plataforma PaaS).
  2. Fazer o **deploy** da API e do frontend nesse lugar e testar com a URL que a plataforma fornece (ex.: `https://seu-app.railway.app`).
  3. Só então apontar o **domínio** (e o wildcard) da Hostgator para esse servidor/serviço.

### 2.3 DNS (resumo)

| Tipo   | Nome / Host      | Valor / Apontamento        | Uso |
|--------|------------------|----------------------------|-----|
| A ou CNAME | `@` ou `dominio.com.br` | IP ou URL do servidor da aplicação | Acesso ao domínio raiz (ex.: landing ou redirect). |
| A ou CNAME | `*` (wildcard)   | **Mesmo** IP ou URL do servidor     | Para que **empresa.dominio.com.br** funcione para qualquer slug. |

- Sem o registro **wildcard** `*`, só funcionarão subdomínios que você criar manualmente (ex.: `www`, `app`). Com wildcard, qualquer `empresa.dominio.com.br` (em que `empresa` seja o slug cadastrado) passa a resolver para o mesmo servidor.

### 2.4 Servidor (ex.: VPS com Nginx)

- Em um VPS você normalmente:
  1. Instala **Node** e roda o backend (ex.: `node dist/server.js` ou com PM2).
  2. Gera o build do frontend (`npm run build` no frontend) e coloca a pasta `dist` em um diretório servido pelo **Nginx** (ou outro servidor web).
  3. Configura o Nginx para:
     - Servir os arquivos estáticos do frontend em `https://dominio.com.br` e `https://*.dominio.com.br`.
     - Fazer **proxy** de `/api` para o processo Node (ex.: `http://127.0.0.1:3000`).
- Assim, tanto `dominio.com.br` quanto `minhaempresa.dominio.com.br` chegam ao mesmo frontend e à mesma API; o backend identifica o tenant pelo `Host` (subdomínio).

### 2.5 Variáveis de ambiente em produção

- No servidor (ou na plataforma de deploy), configurar um `.env` de produção com pelo menos:
  - `NODE_ENV=production`
  - `JWT_SECRET` (mín. 32 caracteres)
  - `ALLOWED_ORIGINS`: incluir `https://dominio.com.br` e `https://*.dominio.com.br` (ou o padrão que você usar; algumas plataformas tratam wildcard em CORS de outra forma).
  - `ALLOWED_HOST_PATTERN`: regex que aceite seus subdomínios, por exemplo:  
    `^([a-z0-9-]+\\.)?dominio\\.com\\.br$`  
    (isso permite `dominio.com.br` e `qualquercoisa.dominio.com.br`).
- Se usar Supabase/outro banco em produção, configurar as variáveis correspondentes (ex.: `DB_PROVIDER`, `SUPABASE_*`).

### 2.6 SSL (HTTPS)

- Para **empresa.dominio.com.br** funcionar em HTTPS, o certificado precisa cobrir o domínio raiz e os subdomínios.  
- **Certificado wildcard** (ex.: Let’s Encrypt `*.dominio.com.br`) cobre todos os subdomínios. No Nginx (ou na plataforma de hospedagem), usar esse certificado para os virtual hosts de `dominio.com.br` e `*.dominio.com.br`.

---

## 3. Resumo: o que falta para “empresa.dominio.com.br” e link dinâmico

| Item | Situação | O que fazer |
|------|----------|-------------|
| Resolver tenant pelo subdomínio | Já implementado (backend + frontend) | Nada. |
| Aceitar apenas hosts do seu domínio | Já existe `ALLOWED_HOST_PATTERN` | Configurar em produção com regex do tipo `^([a-z0-9-]+\\.)?dominio\\.com\\.br$`. |
| DNS wildcard `*.dominio.com.br` | Não feito | Criar registro no painel DNS (Hostgator/registro.br). |
| Hospedagem Node + frontend | Depende de você | Escolher VPS ou PaaS e fazer deploy; depois apontar domínio. |
| Exibir link “empresa.dominio.com.br” ao cadastrar | Não implementado | Adicionar configuração de “domínio base” (ex.: env) e, na tela de empresas (sistema), montar e mostrar (e opcionalmente copiar) `https://{slug}.dominio.com.br`. |

---

## 4. Fluxo desejado: cadastrar empresa e já ter o link

1. Administrador do sistema acessa a área **Sistema** → **Empresas** (já existe).
2. Clica em “Nova empresa” e preenche:
   - **Identificador (slug):** ex. `minhaempresa` (será o subdomínio).
   - **Nome:** ex. `Minha Empresa Ltda`.
3. Ao salvar:
   - A API já cria o tenant com esse slug e hoje devolve `accessUrl: "/minhaempresa"`.
   - O que falta (planejamento, sem codar aqui):
     - Backend e/ou frontend terem uma configuração de “domínio público” (ex.: `APP_DOMAIN=dominio.com.br` ou `FRONTEND_URL=https://dominio.com.br`).
     - Backend passar a devolver também algo como `subdomainUrl: "https://minhaempresa.dominio.com.br"` (ou o frontend montar esse link a partir do slug + domínio configurado).
     - Na tela de empresas, exibir esse link (e, se quiser, botão “Copiar link”) para o desenvolvedor/administrador repassar ao cliente.

Isso é **possível** e compatível com a arquitetura atual; o slug já é o subdomínio.

---

## 5. Ordem sugerida de trabalho (checklist)

1. **Domínio**
   - [ ] Comprar domínio na Hostgator (ex.: dominio.com.br).
   - [ ] Anotar painel de DNS (Hostgator e/ou registro.br).

2. **Hospedagem da aplicação**
   - [ ] Definir onde a aplicação vai rodar (VPS ou PaaS com Node).
   - [ ] Fazer deploy do backend e do frontend e testar pela URL padrão do serviço.

3. **DNS**
   - [ ] Apontar o domínio raiz (`@` ou `dominio.com.br`) para o servidor/serviço.
   - [ ] Criar registro **wildcard** `*` para `*.dominio.com.br` apontando para o mesmo destino.

4. **Servidor / Nginx (se VPS)**
   - [ ] Configurar virtual host para `dominio.com.br` e para `*.dominio.com.br`.
   - [ ] Servir o build do frontend e fazer proxy de `/api` para o Node.
   - [ ] Configurar SSL (idealmente wildcard) para HTTPS.

5. **Variáveis de ambiente**
   - [ ] Definir `ALLOWED_ORIGINS` e `ALLOWED_HOST_PATTERN` (ex.: `^([a-z0-9-]+\\.)?dominio\\.com\\.br$`).
   - [ ] Garantir `JWT_SECRET` e demais vars de produção.

6. **Link dinâmico na tela do desenvolvedor (futuro)**
   - [ ] Definir variável de “domínio base” (backend e/ou frontend).
   - [ ] Ao cadastrar empresa, exibir (e opcionalmente retornar pela API) o link `https://{slug}.dominio.com.br`.

---

## 6. Observações importantes

- **Hostgator:** costuma ser usado para **domínio** e, em alguns planos, para site estático ou PHP. Para **Node.js**, use VPS (da própria Hostgator ou de outro provedor) ou uma plataforma que suporte Node (Railway, Render, etc.) e apenas **aponte o domínio** comprado na Hostgator para esse serviço.
- **Slug = subdomínio:** o identificador da empresa (slug) já é usado como subdomínio. Evite caracteres especiais; o sistema já normaliza para a-z, 0-9 e hífen. Ex.: “Minha Empresa” → slug `minha-empresa` → subdomínio `minha-empresa.dominio.com.br`.
- **Admin do sistema:** o administrador do sistema (tenant “system”) acessa hoje sem subdomínio (ex.: pelo path ou por um host dedicado, conforme sua configuração). Em produção, você pode usar algo como `app.dominio.com.br` ou `sistema.dominio.com.br` para a área do desenvolvedor, desde que o backend trate esse host (e o slug “system”) corretamente; a lógica atual já suporta isso.

Com isso, você tem um roteiro claro para comprar o domínio na Hostgator, colocá-lo no ar e, em seguida, habilitar e exibir o link dinâmico **empresa.dominio.com.br** a partir do cadastro de empresas na área do desenvolvedor.
