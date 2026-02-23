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

**Importante:** o staging **precisa** ser iniciado pelo `ecosystem.config.js` para que o PM2 injete `NODE_ENV=staging`. Se o processo foi iniciado com `npm run dev` ou sem o ecosystem, ele usará `.env` (ou modo desenvolvimento) em vez de `.env.staging`. Após um `pull` e `build`, reinicie com o ecosystem para aplicar o env:

```bash
pm2 delete task-manager-staging
pm2 start ecosystem.config.js --only task-manager-staging
```

Nos logs deve aparecer **Modo: staging** e **\[startup] Loaded .env.staging**. Se aparecer "Modo: desenvolvimento", o NODE_ENV não está staging — inicie de novo com o comando acima.

Confira: `pm2 list` (os dois devem aparecer como **online**).

## 3. Nginx: site para staging (igual à produção, na porta 3001)

Staging usa a **mesma estrutura de URLs** que produção: **staging.fluxiva.com.br** = área do sistema (admin) e **demo.staging.fluxiva.com.br** = empresa demo (e assim por diante). O Nginx deve enviar **todos** esses hosts para a porta **3001**:

```bash
sudo nano /etc/nginx/sites-available/staging-fluxiva
```

Cole (ajuste o **root** se sua pasta for diferente). Use **server_name** com curinga para aceitar qualquer subdomínio de staging:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name staging.fluxiva.com.br *.staging.fluxiva.com.br;

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

Se já tiver SSL (certificado com \*.fluxiva.com.br cobre \*.staging.fluxiva.com.br), inclua o bloco `listen 443 ssl` com os mesmos `ssl_certificate` da produção (fluxiva.com.br).

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

| Ambiente | URLs (mesma lógica da produção) | Porta | Arquivo env     | PM2 app               |
|----------|----------------------------------|------|-----------------|------------------------|
| Produção | fluxiva.com.br, sistema.fluxiva.com.br, demo.fluxiva.com.br, … | 3000 | .env.production | task-manager           |
| Staging  | staging.fluxiva.com.br (system), demo.staging.fluxiva.com.br, … | 3001 | .env.staging    | task-manager-staging   |

- **staging.fluxiva.com.br** = área do sistema (admin) em staging.
- **demo.staging.fluxiva.com.br** = tenant "demo" em staging (base populada).
- O mesmo **frontend** (frontend/dist) é servido; Nginx envia pelo **Host** para 3000 (produção) ou 3001 (staging).
