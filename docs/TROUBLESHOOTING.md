# Troubleshooting — Deploy, env e SSH

Problemas comuns ao fazer deploy ou acessar a VPS, e como resolver.

---

## 1. SUPABASE_DB_URL inválida no deploy (PM2 / VPS)

Se `pm2 logs task-manager` mostra **Invalid URL** ou `base: 'postgres://base'`, o processo não está recebendo uma `SUPABASE_DB_URL` válida.

### Conferir o que o Node enxerga na VPS

Na pasta do projeto no servidor:

```bash
cd ~/Task-Manager
NODE_ENV=production node -e "
require('dotenv').config();
require('dotenv').config({ path: '.env.production', override: true });
const u = process.env.SUPABASE_DB_URL || '';
console.log('SUPABASE_DB_URL definida:', !!u);
console.log('Comprimento:', u.length);
console.log('Começa com postgresql://', u.startsWith('postgresql://'));
console.log('Primeiros 30 chars:', u.slice(0,30) + (u.length > 30 ? '...' : ''));
"
```

- **definida: false** ou **Comprimento: 0** → `.env.production` não está na pasta ou está incorreto.
- **Começa com postgresql://: false** → valor errado (aspas, quebra de linha ou URL diferente).

### O que corrigir

- Garantir **`.env.production`** em `~/Task-Manager/` (não dentro de `dist/`).
- Uma linha por variável, **sem aspas** no valor, ex.:  
  `SUPABASE_DB_URL=postgresql://postgres.XXXX:SENHA@aws-0-region.pooler.supabase.com:5432/postgres`
- Evitar na senha: `@ # : / %` (ou usar `encodeURIComponent`).
- Depois: `git pull`, `npm run build`, `pm2 restart task-manager`.

Se o código que carrega `.env.production` foi alterado, garantir que o deploy (pull + build + restart) foi feito. Logs esperados: `[startup] SUPABASE_DB_URL: 120 chars, prefix OK`.

---

## 2. PM2 em status "errored" (produção ou staging)

### Ver logs e diagnóstico

```bash
pm2 logs task-manager --lines 100
pm2 show task-manager
```

### Causas comuns

| Sintoma no log | Causa | Solução |
|----------------|-------|---------|
| SUPABASE_* ausentes | .env.production ou .env.staging incompleto/ausente | Criar/completar o .env na raiz |
| SUPABASE_DB_URL: inválida | String não começa com `postgresql://` | Corrigir sem aspas; conferir com o script do item 1 |
| JWT_SECRET deve ter pelo menos 32 caracteres | JWT_SECRET curto | Usar string ≥ 32 caracteres |
| Cannot find module '../dist/server.js' | Build não feito | `npm run build` no servidor |
| listen EADDRINUSE 0.0.0.0:3000 | Porta em uso | `pm2 delete task-manager` e `pm2 start ecosystem.config.js --only task-manager` |
| .env.staging obrigatório em staging | NODE_ENV=staging sem .env.staging | Criar `.env.staging` na VPS |

### Reinício limpo

```bash
cd ~/Task-Manager
pm2 delete task-manager
npm run build
pm2 start ecosystem.config.js --only task-manager
pm2 logs task-manager --lines 50
```

Se o app no PM2 tiver outro nome (ex.: `fluxiva-prod`), use esse nome em `delete`/`restart` e confira no `ecosystem.config.js` os nomes `task-manager` e `task-manager-staging`.

---

## 3. SSH: Connection refused (porta 22)

Quando `ssh root@IP_DO_VPS` retorna **Connection refused**, a conexão não chega ao SSH.

### Ordem de verificação

1. **Firewall do provedor (mais comum)**  
   Em VPS (HostGator, OCI, AWS, etc.), liberar **porta 22 (TCP)** para entrada (inbound).  
   - **OCI:** VCN → Security Lists → regra Ingress: origem `0.0.0.0/0`, TCP, porta 22.  
   - **HostGator:** painel → Firewall/Security → liberar TCP 22.  
   Depois de salvar, aguardar 1–2 min e testar de novo.

2. **IP e instância**  
   Confirmar no painel o **IP público** e se a instância está **Running**.

3. **Sua rede**  
   Algumas redes bloqueiam saída na porta 22. Testar pelo celular (4G/5G); se funcionar, a rede fixa está bloqueando.

4. **Porta diferente**  
   Se o provedor usar outra porta (ex.: 2222): `ssh -p 2222 root@IP_DO_VPS`.

5. **SSH no servidor**  
   Se tiver console no navegador (Serial Console / VNC): `sudo systemctl status sshd` e, se inativo, `sudo systemctl start sshd` e `sudo systemctl enable sshd`.

---

## 4. "sudo: unable to resolve host ... Name or service not known"

O **sudo** tenta resolver o hostname da máquina e não encontra em `/etc/hosts`.

### O que fazer

1. Ver o hostname: `hostname` (anotar o nome).
2. Editar `/etc/hosts`: `sudo nano /etc/hosts` (ou como root: `nano /etc/hosts`).
3. Garantir uma linha com `127.0.1.1` e o **mesmo** nome que `hostname` retorna, ex.:  
   `127.0.1.1   vps-15025313.xxx.domain-placeholder.temp`
4. Salvar (nano: Ctrl+O, Enter, Ctrl+X) e testar de novo, ex.: `sudo systemctl start nginx`.

Se o sudo falhar por esse erro, entrar como **root** (`su -`) e editar `/etc/hosts` direto.

---

## 5. GitHub: login com Google — clonar no VPS

Quem entra no GitHub com Google não tem “senha do GitHub” para o terminal. Duas opções:

### Opção A: Token de acesso pessoal (PAT)

1. GitHub → Settings → Developer settings → Personal access tokens → Generate new token (classic).
2. Escopo **repo**; gerar e **copiar** o token.
3. No VPS, ao clonar por HTTPS, quando pedir senha: **colar o token** (não a senha do Google).
4. Opcional: `git config --global credential.helper store` para gravar (só em VPS que você controla).

### Opção B: Chave SSH

1. No VPS: `ssh-keygen -t ed25519 -C "vps-deploy" -f ~/.ssh/id_ed25519_github -N ""`
2. `cat ~/.ssh/id_ed25519_github.pub` → copiar a linha.
3. GitHub → Settings → SSH and GPG keys → New SSH key → colar e salvar.
4. No VPS: `eval "$(ssh-agent -s)"` e `ssh-add ~/.ssh/id_ed25519_github`.
5. Em `~/.ssh/config`:  
   `Host github.com`  
   `  HostName github.com`  
   `  User git`  
   `  IdentityFile ~/.ssh/id_ed25519_github`
6. Clonar por SSH: `git clone git@github.com:USUARIO/REPOSITORIO.git`.

---

Para mais detalhes de env e deploy: [ENV-REQUISITOS.md](./ENV-REQUISITOS.md) e [DEPLOY.md](./DEPLOY.md).
