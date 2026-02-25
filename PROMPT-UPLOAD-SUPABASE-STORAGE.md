# Prompt para Claude Code: Adaptação de uploads ao Supabase Storage por ambiente

Use este documento como prompt ao solicitar à IA (Claude Code) que implemente a adaptação dos uploads de arquivos anexados para o **Supabase Storage**, garantindo que cada ambiente use o Storage do seu respectivo projeto Supabase.

---

## Objetivo

Adaptar a aplicação Task-Manager para que **todos os anexos e arquivos enviados pelos usuários** sejam armazenados no **Supabase Storage** do ambiente correspondente:

- **Produção:** anexos e logos devem ir para o **Storage do projeto Supabase de produção** (credenciais em `.env.production` / `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` de produção).
- **Staging:** anexos e logos devem ir para o **Storage do projeto Supabase de staging** (credenciais em `.env.staging` — mesmo projeto Supabase usado para o banco em staging).

Em **desenvolvimento** (`NODE_ENV` diferente de `staging` e `production`), pode continuar usando armazenamento em disco em `data/uploads` ou, se preferir, usar um bucket de desenvolvimento no Supabase; a decisão fica a critério da implementação, desde que produção e staging fiquem corretamente isolados.

### Tudo via código — nenhum passo manual obrigatório no Supabase

A implementação deve ser **totalmente realizável por código**. O administrador **não** deve precisar criar buckets ou configurar Storage manualmente no Dashboard do Supabase (a menos que prefira fazê-lo por opção).

- **Criação de buckets:** o backend deve criar os buckets necessários **programaticamente**, usando a API do Supabase (`storage.createBucket()`). Por exemplo: na primeira utilização do Storage (ou no arranque da aplicação, se fizer sentido), verificar se o(s) bucket(s) existem e criá-los se não existirem (ex.: `getBucket` / depois `createBucket` com opções como `public: false` para evidências e `public: true` para logos, conforme a regra de negócio). Assim, em cada ambiente (produção ou staging), o primeiro deploy ou a primeira requisição de upload já deixa o Storage pronto.
- **Upload, download e exclusão:** tudo via cliente `@supabase/supabase-js` no backend (service role); não depende de configuração manual no Dashboard.
- **Políticas (RLS) do Storage:** com o backend usando `SUPABASE_SERVICE_ROLE_KEY`, as operações de Storage não dependem de políticas de usuário. Se for necessário acesso público de leitura (ex.: logos servidos por URL pública), o bucket pode ser criado com `public: true` no `createBucket()`; não é obrigatório configurar políticas à mão no Dashboard.
- **Resumo:** o administrador só precisa garantir que as variáveis de ambiente (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e, se usar, nomes de bucket) estão corretas em `.env.production` e `.env.staging`. Nenhuma criação de bucket ou configuração no Supabase Dashboard é obrigatória para a solução funcionar.

---

## Atenção a bugs e proteção da base de produção

**Leia e siga com rigor.** A implementação não pode introduzir regressões nem colocar em risco a base de produção.

### Cuidados com bugs

- **Não quebrar o que já funciona:** downloads e exclusões de arquivos antigos (caminhos em disco) devem continuar a funcionar. A detecção entre “path em disco” e “key de Storage” deve ser clara e à prova de valores inesperados (null, string vazia, path malformado).
- **Código defensivo:** validar sempre que `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` existem antes de usar o Storage em produção/staging; se faltarem, falhar de forma explícita (log + resposta de erro) em vez de comportamento indefinido. Em desenvolvimento com disco, não depender dessas variáveis para o fluxo de upload/download em disco.
- **Tratamento de erros:** falhas no upload/download no Storage devem ser tratadas (try/catch, resposta HTTP adequada, log sem expor dados sensíveis). Erros do Supabase não podem derrubar o processo nem deixar a aplicação em estado inconsistente (ex.: não inserir registro na tabela se o upload ao Storage falhar, ou reverter/compensar de forma segura).
- **Compatibilidade:** a convenção que distingue “path em disco” de “key de Storage” (ex.: prefixo `data/uploads` ou `data/` para disco) deve ser documentada no código e aplicada de forma consistente em todas as rotas (justificativas, tarefas, tenants). Evitar lógica duplicada ou divergente entre arquivos.

### Atenção crítica à base de produção

- **Isolamento absoluto:** em **produção**, o backend deve usar **apenas** as credenciais carregadas quando `NODE_ENV=production` (ou seja, `.env.production`). Em **staging**, usar **apenas** as de `.env.staging`. Nunca misturar: nenhum código pode usar URL/key de staging quando estiver rodando em produção, nem o contrário. O cliente Supabase do Storage deve ser instanciado **sempre** com `process.env.SUPABASE_URL` e `process.env.SUPABASE_SERVICE_ROLE_KEY` (já definidos por `load-env.ts` por ambiente), nunca com valores fixos ou hardcoded.
- **Produção não é ambiente de teste:** a base e o Storage de produção contêm dados reais. Não fazer alterações destrutivas em dados existentes (ex.: não sobrescrever ou apagar em massa `file_path`/`logo_path`). A migração de arquivos antigos de disco para o Storage **não** é obrigatória nesta tarefa; se for feita, deve ser opcional, auditada e segura.
- **Rollback seguro:** as mudanças devem permitir que, em caso de problema, seja possível voltar a uma versão anterior sem corromper dados. Ou seja: manter compatibilidade com registros em disco; não assumir que todo `file_path`/`logo_path` é key de Storage.
- **Verificação antes de deploy:** documentar ou sugerir que, antes de aplicar em produção, a implementação seja validada em staging (upload, download, exclusão, e leitura de registros antigos em disco) e que as variáveis de ambiente de produção (bucket, URL, service role) estejam corretas e apontando para o projeto Supabase de produção.

---

## Contexto do projeto

### Stack e estrutura

- **Backend:** Node.js, Express, TypeScript. Banco: PostgreSQL via Supabase (`SUPABASE_DB_URL`) quando `DB_PROVIDER=supabase`; SQLite em dev.
- **Frontend:** React (Vite). Chamadas de upload são feitas para a API do backend (JSON com `fileName`, `mimeType`, `contentBase64`); não há uso direto do Supabase no frontend para arquivos.
- **Variáveis de ambiente:** carregadas em `src/load-env.ts`:
  - **Staging:** apenas `.env.staging` (override).
  - **Produção:** `.env` + `.env.production` (override).
  - Já existem `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` nos exemplos `.env.production.example` e `.env.staging.example`. O backend hoje **não** instancia o cliente `@supabase/supabase-js`; usa apenas `pg` com `SUPABASE_DB_URL`.

### Situação atual dos uploads (tudo em disco)

Atualmente **não há uso do Supabase Storage**. Todos os anexos são gravados no sistema de arquivos em `data/uploads` e os caminhos são guardados nas tabelas. Detalhes:

| Fluxo | Rota (backend) | Arquivo | Armazenamento atual | Tabela / campo |
|-------|----------------|---------|---------------------|----------------|
| Evidência de justificativa | `POST /api/justifications/:id/evidences` | `src/routes/justifications.ts` | Disco: `data/uploads/{tenantId}/justification_evidences/{justificationId}/{evidenceId}_{safeName}` | `justification_evidences.file_path` |
| Download evidência justificativa | `GET /api/justifications/:id/evidences/:eid/download` | `src/routes/justifications.ts` | `res.sendFile` / `res.download` a partir de `evidence.file_path` | — |
| Evidência de tarefa | `POST /api/tasks/:id/evidences` | `src/routes/tasks.ts` | Disco: `data/uploads/{tenantId}/{taskId}/{evidenceId}_{safeName}` | `task_evidences.file_path` |
| Download evidência tarefa | `GET /api/tasks/:id/evidences/:evidenceId/download` | `src/routes/tasks.ts` | Idem, path no disco | — |
| Logo do tenant | `POST /api/tenants/:id/logo` | `src/routes/tenants.ts` | Disco: `data/uploads/tenants/{tenantId}/logo{ext}` | `tenants.logo_path` |
| Leitura logo | `GET /api/tenants/logo/:slug` | `src/routes/tenants.ts` | `res.sendFile` a partir de `tenants.logo_path` | — |

- Constantes de diretório: `uploadsBaseDir = path.resolve(process.cwd(), "data", "uploads")` em `justifications.ts`, `tasks.ts` e `tenants.ts`; em cada rota há `fs.mkdirSync`, `fs.writeFileSync` e, no download, resolução do path absoluto e checagem de que está dentro de `data/uploads`.
- Validações atuais: tamanho (ex.: evidências 10MB, logo 2MB), MIME permitido, `sanitizeFileName`; essas regras devem ser mantidas antes de enviar ao Storage.

---

## O que a IA deve fazer

### 1. Módulo de Storage no backend

- Criar um módulo (ex.: `src/storage/supabase-storage.ts` ou `src/services/supabase-storage.ts`) que:
  - Use `@supabase/supabase-js` com `createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)`.
  - Leia **sempre** do ambiente atual (já carregado por `load-env.ts`), de forma que em **produção** use URL e key de produção e em **staging** use URL e key de staging — assim, cada ambiente usa o Storage do seu próprio projeto Supabase.
  - **Crie os buckets por código** quando não existirem: antes do primeiro upload (ou no arranque), chamar `storage.getBucket(name)` e, se o bucket não existir, `storage.createBucket(name, options)` (ex.: bucket de evidências privado, bucket de logos público se for o caso). Assim o administrador não precisa criar nada no Dashboard do Supabase.
  - Exponha funções para: **upload** (buffer + path no bucket, retornando key ou URL conforme combinado), **download** (obter arquivo por key), e, se necessário, **delete** (para exclusão de evidência/logo).
  - Defina nomes de buckets (ou um único bucket com prefixos) por ambiente; pode usar variáveis como `SUPABASE_STORAGE_BUCKET` ou buckets separados (ex.: `evidences`, `logos`) e documentar nos `.env.*.example`.

### 2. Variáveis de ambiente

- Nos arquivos `.env.production.example` e `.env.staging.example` (raiz do projeto), **adicionar** variáveis necessárias para o Storage (ex.: `SUPABASE_STORAGE_BUCKET_EVIDENCES`, `SUPABASE_STORAGE_BUCKET_LOGO`, ou uma única variável de bucket). Garantir que a mesma lógica de carregamento (`load-env.ts`) já aplica o ficheiro correto por ambiente — não é preciso alterar a ordem de carregamento, apenas documentar as novas variáveis.

### 3. Rotas de upload e download

- **Justificativas** (`src/routes/justifications.ts`):  
  - No POST de evidências: em vez de gravar em disco, enviar o buffer para o Supabase Storage (path no bucket por tenant/justificativa/evidência), e guardar na tabela `justification_evidences` o **object key** (ou path no bucket) em `file_path` (ou em campo dedicado se preferir migração mais explícita).  
  - No GET de download: se o registro for de Storage (ex.: key não começa com `data/uploads`), buscar o arquivo no Storage e enviar na resposta (stream ou buffer); se for path antigo em disco, manter comportamento atual com `sendFile`/`download` para compatibilidade.

- **Tarefas** (`src/routes/tasks.ts`):  
  - Mesmo padrão: POST de evidências → upload no Storage, gravar key em `task_evidences.file_path`; GET de download (e qualquer DELETE de evidência) → usar o módulo de Storage quando for key de Storage, senão servir/remover do disco.

- **Tenants** (`src/routes/tenants.ts`):  
  - POST logo → upload no Storage, gravar key em `tenants.logo_path`.  
  - GET logo e DELETE logo → usar Storage quando `logo_path` for key de Storage; caso contrário, manter lógica atual em disco.

### 4. Compatibilidade e migração

- Registros antigos podem ter `file_path` (ou `logo_path`) como caminho relativo em disco (ex.: `data/uploads/...`). A implementação deve **reconhecer** esse formato e continuar a servir/remover do disco quando for path em disco, e usar o Storage apenas quando o valor for uma key de Storage (por exemplo, sem prefixo `data/` ou com um prefixo definido como convenção para Storage).
- Não é obrigatório migrar arquivos já existentes de disco para o Storage nesta tarefa; o requisito é que **novos** uploads em produção e staging usem o Storage do ambiente correto.

### 5. Segurança e boas práticas

- **Service role** só no backend; nunca expor no frontend.
- Manter validações atuais: tamanho máximo, tipos MIME permitidos, sanitização de nome de arquivo, e que o recurso (tarefa, justificativa, tenant) pertence ao tenant do usuário.
- No Supabase, configurar políticas (RLS) ou permissões de bucket conforme necessário (leitura pública ou signed URLs, conforme regra de negócio).

### 6. Frontend

- O frontend hoje envia JSON com `fileName`, `mimeType`, `contentBase64` para as rotas existentes. **Não é necessário alterar o contrato** da API: o backend continua recebendo o mesmo payload e, internamente, grava no Storage em vez do disco. Se a IA optar por signed URLs ou upload direto do frontend para o Storage, deve documentar e garantir que usa o domínio/credenciais corretos por ambiente (ex.: backend gera signed URL do Supabase do ambiente atual).

---

## Resumo de arquivos a tocar

- **Criar:** módulo de Storage (ex.: `src/storage/supabase-storage.ts` ou `src/services/supabase-storage.ts`).
- **Alterar:**  
  - `src/routes/justifications.ts` (POST evidences, GET download).  
  - `src/routes/tasks.ts` (POST evidences, GET download, DELETE evidence se houver).  
  - `src/routes/tenants.ts` (POST logo, GET logo, DELETE logo).  
  - `.env.production.example` e `.env.staging.example` (novas variáveis de Storage).  
- **Opcional:** `package.json` — adicionar dependência `@supabase/supabase-js` se ainda não existir.

---

## Critério de sucesso

- Em **produção** (`NODE_ENV=production` e `.env.production` com projeto Supabase de produção), todos os novos anexos de justificativas, evidências de tarefas e logos de tenant são armazenados no **Storage do projeto Supabase de produção**.
- Em **staging** (`NODE_ENV=staging` e `.env.staging` com projeto Supabase de staging), todos os novos anexos são armazenados no **Storage do projeto Supabase de staging**.
- Downloads e exclusões continuam a funcionar para arquivos novos (Storage) e, quando aplicável, para arquivos antigos ainda em disco (compatibilidade por valor de `file_path` / `logo_path`).
- **Sem regressões:** fluxos atuais de upload/download em disco (desenvolvimento e registros antigos) continuam funcionando; não há mistura de ambientes (produção nunca usa credenciais ou Storage de staging, e vice-versa).
- **Produção protegida:** código usa apenas variáveis de ambiente carregadas por ambiente; não há alterações destrutivas em dados existentes na base de produção.

Use este prompt ao pedir à Claude Code que implemente a adaptação dos uploads para o Supabase Storage por ambiente.
