# Deixar o Staging no ar na mesma VPS

Produção (fluxiva.com.br, sistema.fluxiva.com.br, etc.) roda na porta **3000**. Staging (staging.fluxiva.com.br) roda na porta **3001**, com o mesmo código e o arquivo **.env.staging** (Supabase de teste).

## 1. Arquivo .env.staging na VPS

Na pasta do projeto, crie ou copie **.env.staging** com as variáveis do ambiente de **teste** (outro projeto Supabase, JWT_SECRET de teste, etc.). Use o mesmo formato do .env.production.example.

## 2. PM2: subir o app de staging

O **ecosystem.config.js** já define dois apps: **task-manager** (porta 3000) e **task-manager-staging** (porta 3001).

Na VPS, após o build:

```bash
cd ~/Task-Manager
npm run build
pm2 start ecosystem.config.js
```

Ou, se a produção já estiver rodando e você só quer adicionar o staging:

```bash
pm2 start ecosystem.config.js --only task-manager-staging
```

Confira: `pm2 list` (os dois devem aparecer como **online**).

## 3. Nginx: site para staging.fluxiva.com.br

Crie um novo site que aponta a **staging.fluxiva.com.br** para a porta **3001**:

```bash
sudo nano /etc/nginx/sites-available/staging-fluxiva
```

Cole (ajuste o **root** se sua pasta for diferente, ex.: **task-manager** em minúsculo):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name staging.fluxiva.com.br;

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

## 4. SSL (Certbot) para staging.fluxiva.com.br

Se o certificado já incluir **\*.fluxiva.com.br**, **staging.fluxiva.com.br** já está coberto. Caso contrário:

```bash
sudo certbot --nginx -d staging.fluxiva.com.br
```

## 5. DNS

O curinga **\*.fluxiva.com.br** já aponta para a VPS, então **staging.fluxiva.com.br** costuma resolver sem alteração. Se não resolver, crie um **A** ou **CNAME** para **staging** apontando para o IP da VPS.

---

**Resumo**

| Ambiente | URL principal      | Porta | Arquivo env        | PM2 app               |
|----------|--------------------|------|--------------------|------------------------|
| Produção | fluxiva.com.br, …   | 3000 | .env.production    | task-manager           |
| Staging  | staging.fluxiva.com.br | 3001 | .env.staging       | task-manager-staging   |

O mesmo **frontend** (frontend/dist) é servido pelos dois; a diferença é o **Host**: Nginx envia produção para 3000 e staging para 3001.
