# Deploy: Staging na mesma VPS (esquema path-based)

> **Nota (atualizado em 2026-02-24):** O staging migrou do esquema **subdomínio por empresa** (`empresa.staging.fluxiva.com.br`) para **path por empresa** (`staging.fluxiva.com.br/empresa`). Um único host, um único server block Nginx, sem wildcard DNS.
>
> Para histórico completo da refatoração e handoff, veja [DOC-REFATORACAO-STAGING.md](./DOC-REFATORACAO-STAGING.md).

---

Produção (fluxiva.com.br, empresa.fluxiva.com.br, etc.) roda na porta **3000**. Staging (`staging.fluxiva.com.br`) roda na porta **3001**, com o mesmo código e o arquivo **.env.staging**.

## 1. Arquivo .env.staging na VPS

Na pasta do projeto, crie ou copie **.env.staging** com as variáveis do ambiente de **teste** (outro projeto Supabase, JWT_SECRET de teste, etc.). Use `.env.staging.example` como modelo.

Variáveis obrigatórias:
```env
NODE_ENV=staging
PORT=3001
DB_PROVIDER=supabase
APP_DOMAIN=staging.fluxiva.com.br
ALLOWED_ORIGINS=https://staging.fluxiva.com.br
SUPABASE_URL=https://seu-projeto-staging.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-chave-staging
SUPABASE_DB_URL=postgresql://postgres.[REF]:[SENHA]@...pooler.supabase.com:5432/postgres
JWT_SECRET=string-aleatoria-min-32-chars
```

> `ALLOWED_HOST_PATTERN` não é necessário em staging — a validação usa `APP_DOMAIN` diretamente.

## 2. PM2: subir os apps

O **ecosystem.config.js** já define dois apps: **task-manager** (porta 3000) e **task-manager-staging** (porta 3001).

Na VPS, após o build:

```bash
cd ~/Task-Manager
npm run build
npm run frontend:build   # um único build serve prod e staging
pm2 start ecosystem.config.js
```

Ou, se a produção já estiver rodando e você só quer adicionar o staging:

```bash
pm2 start ecosystem.config.js --only task-manager-staging
```

Confira: `pm2 list` (os dois devem aparecer como **online**).

Nos logs de staging deve aparecer:
```
[load-env] Staging: credenciais e DB carregados somente de .env.staging (override ativo)
 Task Manager v2.0 rodando em http://localhost:3001
   Modo: staging
```

## 3. Nginx: site para staging (path-based)

Staging usa **um único host** (`staging.fluxiva.com.br`) — sem `*.staging.fluxiva.com.br`. O tenant é identificado pelo **path** da URL.

```bash
sudo nano /etc/nginx/sites-available/staging-fluxiva
```

Cole o seguinte (ajuste o **root** se sua pasta for diferente):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name staging.fluxiva.com.br;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name staging.fluxiva.com.br;   # APENAS o host exato, sem wildcard

    ssl_certificate     /etc/letsencrypt/live/fluxiva.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fluxiva.com.br/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /home/deploy/Task-Manager/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # SPA: React Router trata /empresa1/login, /empresa1/calendar, /login, etc.
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Ative e teste:

```bash
sudo ln -s /etc/nginx/sites-available/staging-fluxiva /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 4. SSL

Se o certificado já incluir **\*.fluxiva.com.br**, `staging.fluxiva.com.br` está coberto. Caso contrário:

```bash
sudo certbot --nginx -d staging.fluxiva.com.br
```

## 5. DNS

O registro `staging` (A ou CNAME para o IP da VPS) já deve existir se `*.fluxiva.com.br` estiver configurado. Não é necessário criar registros DNS para cada empresa — o tenant vai pelo path, não pelo hostname.

---

## Resumo

| Ambiente | URL de acesso | Porta | Arquivo env | PM2 app |
|---|---|---|---|---|
| Produção | `empresa.fluxiva.com.br`, `sistema.fluxiva.com.br` | 3000 | `.env.production` | `task-manager` |
| Staging  | `staging.fluxiva.com.br/empresa`, `staging.fluxiva.com.br/login` | 3001 | `.env.staging` | `task-manager-staging` |

- **Produção:** um subdomínio por empresa; tenant no hostname.
- **Staging:** host único `staging.fluxiva.com.br`; tenant no primeiro segmento do path.
- **Mesmo frontend build** (`frontend/dist`) serve ambos os ambientes.
- **Bases de dados separadas**: `.env.production` e `.env.staging` com Supabase dedicados.
