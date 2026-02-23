# SUPABASE_DB_URL inválida no deploy (PM2 / VPS)

Se `pm2 logs task-manager` mostra **Invalid URL** e `base: 'postgres://base'`, o processo na VPS não está recebendo uma `SUPABASE_DB_URL` válida.

## 1. Conferir o que o Node enxerga na VPS

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

- Se aparecer **definida: false** ou **Comprimento: 0**, o arquivo `.env.production` não está na pasta ou está vazio/incorreto.
- Se **Começa com postgresql://** for **false**, a linha no `.env.production` está errada (aspas, quebra de linha ou valor diferente de `postgresql://...`).

## 2. O que corrigir

- Garanta que **`.env.production`** existe em `~/Task-Manager/` na VPS (não dentro de `dist/`).
- Conteúdo: uma linha por variável, **sem aspas** na volta do valor, por exemplo:
  - `SUPABASE_DB_URL=postgresql://postgres.XXXX:SUA_SENHA@aws-0-region.pooler.supabase.com:5432/postgres`
- Senha **sem** caracteres `@ # : / %` (ou codifique com `encodeURIComponent`).
- Depois de alterar o código: `git pull`, `npm run build` e `pm2 restart task-manager`.

## 3. Garantir que o código novo está no servidor

O servidor precisa do código que carrega `.env.production` quando `NODE_ENV=production`. Se você ainda não fez deploy depois dessa alteração:

1. No seu PC: commit e push das alterações.
2. Na VPS: `cd ~/Task-Manager`, `git pull`, `npm run build`, `pm2 restart task-manager`.

Após o restart, os logs devem mostrar uma linha como:
`[startup] SUPABASE_DB_URL: 120 chars, prefix OK`
Se aparecer `inválida` ou o erro de Invalid URL, use o comando do passo 1 para inspecionar o valor.
