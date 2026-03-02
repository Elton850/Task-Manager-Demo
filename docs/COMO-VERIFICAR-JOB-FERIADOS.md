# Como verificar se o job de feriados rodou e deu certo — passo a passo para leigos

Este guia explica, em linguagem simples, como saber se o **job que atualiza os feriados** (que roda sozinho todo dia por volta das 03:00) executou e foi bem-sucedido.

---

## O que é esse “job”?

O **job de feriados** é uma tarefa automática do sistema que, uma vez por dia (por volta das 03:00), busca os feriados nacionais na internet e atualiza o banco de dados. Assim, o calendário do sistema sempre mostra os feriados corretos.

Quando alguém pergunta “o job rodou e deu certo?”, está perguntando:  
*Essa atualização automática aconteceu e terminou sem erro?*

---

## Como deixar a execução automática no servidor

Se hoje você só atualiza os feriados **manual** (rodando um comando ou pela tela) e quer que o servidor faça isso **sozinho todo dia**, siga estes passos.

### O que precisa estar certo

1. **Variável de ambiente no servidor**  
   O backend só agenda o job automático (03:00) se a variável **`HOLIDAY_SYNC_ENABLED`** estiver ligada.

2. **Backend rodando de forma contínua**  
   O processo do Node (backend) precisa estar **ligado 24 horas** no servidor (por exemplo com PM2, systemd ou outro gerenciador), para que, quando der 03:00, o job execute.

### Passo a passo (quem mexe no servidor)

1. **No servidor**, abra o arquivo de configuração do ambiente que o backend usa:
   - Produção: em geral é o `.env` na pasta do projeto (ou o arquivo que o PM2/sistema usa).
   - Pode ser também `.env.production` se o deploy copiar esse arquivo para `.env`.

2. **Adicione ou altere** esta linha (sem `#` na frente):
   ```env
   HOLIDAY_SYNC_ENABLED=true
   ```
   Se a linha já existir mas estiver comentada (`# HOLIDAY_SYNC_ENABLED=true`), remova o `#` e deixe como acima.  

3. **Reinicie o backend** para carregar a nova configuração:
   - Se usar **PM2**: `pm2 restart nome-do-app` (ou o nome do processo do Task Manager).
   - Se usar outro gerenciador, reinicie o processo do Node que sobe a API.

4. **Confirme no log** que o job foi agendado: ao subir, o backend deve escrever algo como:
   ```text
   [holiday-sync] Job agendado (diário ~03:00).
   ```
   Se essa mensagem aparecer, na próxima vez que o relógio do servidor marcar **03:00** (e até 03:01), o job deve rodar sozinho.

5. **Servidor precisa estar ligado à 03:00**  
   Se o servidor (ou o processo do Node) for desligado nesse horário, o job não roda naquele dia. Para ser automático todo dia, o backend deve ficar rodando 24/7 (PM2 ou equivalente costuma garantir isso).

### Resumo

- Coloque **`HOLIDAY_SYNC_ENABLED=true`** no `.env` (ou no arquivo de env) do **servidor**.
- **Reinicie** o backend (ex.: `pm2 restart ...`).
- Mantenha o backend **rodando 24 horas**; assim, todo dia por volta das **03:00** a atualização de feriados será feita automaticamente.

Depois disso, você pode usar as “Formas de verificar” abaixo para ver se o job rodou e deu certo.

---

## Formas de verificar (do mais simples ao mais técnico)

**Nota:** Em versões antigas, o job automático rodava só **uma vez por ano** (bug já corrigido). Agora ele roda **uma vez por dia** por volta das 03:00. Ao rodar o script manual (`npm run sync:holidays:prod`), a "última sincronização" também passa a ser registrada na tabela `holiday_sync_runs`, então a data exibida será atualizada.

---

### Opção 1: Pedir para quem cuida do sistema

Se você não mexe em servidor, banco ou código:

1. Envie este texto para a pessoa que administra o servidor ou o banco (dev/suporte):

   *“Preciso saber se o job de sincronização de feriados rodou e foi bem-sucedido. Pode verificar no banco na tabela `holiday_sync_runs`, a última linha (ordenando por `started_at` decrescente), e me dizer o valor da coluna `status`? Se for `success`, deu certo; se for `failure`, deu erro e a coluna `error_message` tem o motivo.”*

2. Se a pessoa tiver acesso à API do sistema, ela também pode chamar o endpoint **GET /api/holidays/sync/status** (com usuário ADMIN) e ver o `status` da última execução.

---

### Opção 2: Você tem acesso ao painel do Supabase (banco na nuvem)

Se o sistema usa **Supabase** e você entra no painel (site do Supabase):

1. Acesse o projeto do seu sistema no Supabase.
2. No menu lateral, clique em **“Table Editor”** (ou “Editor de tabelas”).
3. Abra a tabela **`holiday_sync_runs`**.
4. Veja a **última linha** da tabela (a que tem a data/hora mais recente na coluna **`started_at`**).
5. Olhe a coluna **`status`** dessa linha:
   - **`success`** → o job rodou e deu certo.
   - **`failure`** → o job rodou mas deu erro; a coluna **`error_message`** explica o que aconteceu.
   - **`running`** → o job estava rodando (se já passou muito tempo e continua “running”, pode ter travado).

**Resumo:** última linha → coluna `status` → `success` = tudo certo.

---

### Opção 3: Você tem acesso ao servidor onde o sistema roda (terminal)

Se você consegue abrir um **terminal** (prompt de comando) **no servidor** onde o backend está rodando:

#### Se o banco for SQLite (arquivo no servidor)

1. No terminal, vá até a pasta do projeto (onde está o sistema).
2. Rode o comando abaixo (ajuste o caminho do banco se for diferente):

   **Windows (PowerShell):**
   ```powershell
   sqlite3 data/taskmanager.db "SELECT started_at, status, error_message FROM holiday_sync_runs ORDER BY started_at DESC LIMIT 1;"
   ```

   **Linux/macOS:**
   ```bash
   sqlite3 data/taskmanager.db "SELECT started_at, status, error_message FROM holiday_sync_runs ORDER BY started_at DESC LIMIT 1;"
   ```

3. O comando mostra **uma linha**: data/hora da última execução, o **status** e a mensagem de erro (se houver).
   - **status = success** → job rodou e deu certo.
   - **status = failure** → deu erro; veja o que aparece em **error_message**.

#### Se o banco for PostgreSQL (Supabase ou outro)

Quem tem acesso ao banco pode rodar esta consulta (no cliente SQL do Supabase, ou em qualquer programa que acesse o PostgreSQL):

```sql
SELECT started_at, finished_at, status, error_message, tenants_count, inserted_total, updated_total
FROM holiday_sync_runs
ORDER BY started_at DESC
LIMIT 1;
```

A última linha é a última execução do job. De novo: **status = success** significa que rodou e deu certo.

---

### Opção 4: Ver os logs do servidor

Se o job está habilitado (`HOLIDAY_SYNC_ENABLED=true`), quando ele roda o servidor escreve uma linha no log:

- Se deu certo: algo como *“Concluído: X tenant(s), Y inseridos, Z atualizados.”*
- Se deu erro: algo como *“Erro: [mensagem].”*

Quem tiver acesso aos logs do processo do Node (por exemplo, log do PM2 ou do sistema) pode procurar por **“holiday-sync”** no horário por volta das 03:00 e ver se apareceu a mensagem de sucesso ou de erro.

---

## Resumo em uma frase

- **No banco:** olhe a tabela **`holiday_sync_runs`**, a **última linha**, coluna **`status`**: **success** = rodou e deu certo; **failure** = rodou mas deu erro (veja **error_message**).
- **Na API:** quem for ADMIN pode chamar **GET /api/holidays/sync/status** e ver o mesmo resultado em JSON.
- **Para leigos:** o mais simples é pedir a quem cuida do sistema ou do banco para fazer essa verificação e te dizer o resultado.
