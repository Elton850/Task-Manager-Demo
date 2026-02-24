# Build e Deploy — Produção e Staging

Guia para build e deploy do Task Manager na VPS (PM2 + Nginx). Produção na porta **3000**, staging na **3001**; mesmo código, `.env` diferentes.

---

## 1. Resumo por ambiente

| Ambiente | URL | Porta | .env | PM2 app |
|----------|-----|-------|------|---------|
| **Produção** | `empresa.fluxiva.com.br`, `sistema.fluxiva.com.br` | 3000 | `.env.production` | `task-manager` |
| **Staging** | `staging.fluxiva.com.br/empresa`, `staging.fluxiva.com.br/login` | 3001 | `.env.staging` | `task-manager-staging` |

- Produção: um subdomínio por empresa (tenant no hostname).
- Staging: host único; tenant no path (`/empresa/login`, etc.).
- Um único build do frontend (`frontend/dist`) serve ambos.
- Bases de dados separadas (Supabase prod e staging).

---

## 2. Antes do deploy

- Na raiz: `.env.production` e, se for atualizar staging, `.env.staging` (não versionados) — use os `.example` como modelo.
- Opcional no frontend: `frontend/.env.production` e `frontend/.env.staging` com `VITE_APP_DOMAIN` para links corretos.

---

## 3. Build local (opcional)

```bash
npm install && cd frontend && npm install && cd ..
npm run build
npm run frontend:build
# Staging com domínio correto nos links (opcional):
# npm run frontend:build:staging  → gera frontend/dist-staging
```

---

## 4. Enviar código para o servidor

```bash
git add . && git commit -m "Deploy: atualizações" && git push origin main
```

Na VPS:

```bash
cd ~/Task-Manager   # ou /var/www/Task-Manager
git pull origin main
```

---

## 5. No servidor (VPS) — build e PM2

### 5.1 Dependências e .env

- `npm install` e `cd frontend && npm install && cd ..`
- Garantir `.env.production` e `.env.staging` na raiz (criar/ajustar manualmente; não versionar).

### 5.2 Build

```bash
npm run build
npm run frontend:build
# Opcional: npm run frontend:build:staging  (staging usa dist-staging no Nginx)
```

### 5.3 PM2

```bash
pm2 start ecosystem.config.js
# ou só staging: pm2 start ecosystem.config.js --only task-manager-staging
pm2 list   # ambos online
```

Se os nomes no servidor forem outros (ex.: `fluxiva-prod`, `fluxiva-staging`):

```bash
pm2 restart fluxiva-prod
pm2 restart fluxiva-staging
```

Logs esperados:

- Produção: `Modo: produção`, `http://localhost:3000`
- Staging: `Modo: staging`, `http://localhost:3001`, `[load-env] Staging: credenciais e DB carregados somente de .env.staging`

---

## 6. Nginx

### 6.1 Produção (subdomínios)

- `server_name fluxiva.com.br *.fluxiva.com.br`
- `proxy_pass` de `/api/` para `http://127.0.0.1:3000`
- `root` para o frontend (ex.: `.../frontend/dist`)

### 6.2 Staging (path-based, um host)

- `server_name staging.fluxiva.com.br` (sem wildcard)
- `proxy_pass` de `/api/` para `http://127.0.0.1:3001`
- `root` para `.../frontend/dist` (ou `.../frontend/dist-staging` se tiver build separado)
- `location / { try_files $uri $uri/ /index.html; }` para SPA

Exemplo mínimo staging:

```nginx
server {
    listen 443 ssl;
    server_name staging.fluxiva.com.br;
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
    location / { try_files $uri $uri/ /index.html; }
}
```

Depois: `sudo nginx -t && sudo systemctl reload nginx`.

### 6.3 SSL

Se o certificado não cobrir staging: `sudo certbot --nginx -d staging.fluxiva.com.br`.

---

## 7. Variáveis obrigatórias por ambiente

**Produção (`.env.production`):**  
`NODE_ENV=production`, `PORT=3000`, `DB_PROVIDER=supabase`, `APP_DOMAIN=fluxiva.com.br`, `ALLOWED_ORIGINS`, `ALLOWED_HOST_PATTERN`, `SUPABASE_*`, `SUPABASE_DB_URL`, `JWT_SECRET` (≥ 32 chars).

**Staging (`.env.staging`):**  
`NODE_ENV=staging`, `PORT=3001`, `DB_PROVIDER=supabase`, `APP_DOMAIN=staging.fluxiva.com.br`, `ALLOWED_ORIGINS=https://staging.fluxiva.com.br`, `SUPABASE_*` e `SUPABASE_DB_URL` do projeto Supabase de **teste**, `JWT_SECRET` (≥ 32 chars). `ALLOWED_HOST_PATTERN` não é necessário.

---

## 8. Sequência rápida após `git pull`

```bash
cd ~/Task-Manager
git pull origin main
npm install && cd frontend && npm install && cd ..
npm run build
npm run frontend:build
pm2 restart task-manager
pm2 restart task-manager-staging
# ou: pm2 restart ecosystem.config.js
```

---

## 9. Checklist

- [ ] `.env.production` e `.env.staging` existem no servidor (não no Git).
- [ ] `npm run build` e `npm run frontend:build` sem erro.
- [ ] PM2: os dois apps **online**.
- [ ] Logs sem erro de env ou banco.
- [ ] Nginx: `server_name` e `root` corretos; `proxy_pass` 3000 (prod) e 3001 (staging).
- [ ] HTTPS ativo.
- [ ] Teste: `https://empresa.fluxiva.com.br` (prod) e `https://staging.fluxiva.com.br/empresa/login` (staging).
