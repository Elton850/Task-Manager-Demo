# Prompt para Claude Code: Clean Code e refatoração do projeto Task-Manager

Use este documento como prompt ao solicitar à IA (Claude Code) que **analise todo o projeto**, faça **refatoração em Clean Code**, aplique **boas práticas**, **otimize** o código, **remova o desnecessário** e **adicione ou ajuste testes**, **sem quebrar nenhum comportamento** e com **atenção crítica** a tudo que envolva a **base de produção**.

---

## Objetivo

Realizar uma refatoração ampla do código da aplicação Task-Manager (backend Node/Express/TypeScript e frontend React/Vite) para:

- Deixar o código **mais limpo**, **legível** e **mantível** (Clean Code).
- Aplicar **boas práticas** (nomenclatura clara, funções pequenas e focadas, DRY, responsabilidade única, tratamento de erros consistente).
- **Otimizar** onde for seguro (evitar duplicação, melhorar performance sem alterar comportamento).
- **Remover** código morto, comentários obsoletos, imports não usados e dependências desnecessárias.
- **Garantir qualidade** com **testes** (manter os existentes passando, adicionar ou melhorar testes para cobrir fluxos críticos e evitar regressões).
- Manter **atenção crítica** em qualquer alteração que envolva **banco de dados**, **variáveis de ambiente**, **credenciais** ou **produção** — nada que possa corromper dados ou expor ambientes.

A refatoração **não** deve alterar o comportamento funcional da aplicação do ponto de vista do usuário ou das APIs. Contratos de API (rotas, payloads, códigos de status) devem ser preservados.

---

## Atenção crítica à base de produção e ao ambiente

**Leia e siga com rigor.** Esta seção tem prioridade sobre qualquer otimização ou “melhoria” que possa afetar produção.

### O que NÃO fazer

- **Nunca** alterar esquema de banco (tabelas, colunas, tipos) sem uma migração explícita e reversível; não remover ou renomear colunas usadas em produção.
- **Nunca** introduzir lógica que misture ambientes (ex.: usar credenciais ou URLs de staging em produção). O carregamento de env já é feito em `src/load-env.ts` (staging = só `.env.staging`, production = `.env` + `.env.production`); não alterar essa ordem nem hardcodar valores.
- **Nunca** remover validações de segurança (auth, tenant, CSRF, rate limit, sanitização de inputs) ou enfraquecer checagens de permissão.
- **Nunca** alterar a semântica de rotas públicas (login, request-reset, reset, CSRF, health) de forma que clientes ou testes existentes quebrem.
- **Nunca** fazer alterações destrutivas em dados (DELETE em massa, UPDATE sem WHERE adequado, truncates) em código que rode em produção. Scripts de migração/seed devem continuar idempotentes e seguros quando documentados.

### O que fazer ao tocar em código sensível

- **Banco de dados:** ao refatorar queries ou acesso a dados, manter exatamente a mesma lógica (mesmos WHERE, mesmos campos retornados, mesma ordem). Extrair queries para funções ou módulos é permitido; mudar comportamento não é.
- **Autenticação e autorização:** não simplificar ou “enxugar” checagens de `req.user`, `tenant_id`, `role` ou `slug`; qualquer mudança deve ser equivalente em resultado (mesmo acesso permitido/negado).
- **Variáveis de ambiente:** não remover variáveis usadas em produção (ex.: `SUPABASE_*`, `RESEND_*`, `JWT_SECRET`, `APP_DOMAIN`). Documentar ou centralizar nomes em um único lugar é permitido; remover ou renomear no código sem atualizar os `.env` de deploy não é.
- **Testes existentes:** a suíte em `tests/` (ex.: `tests/security.test.ts`) deve continuar passando após a refatoração. Se um teste for refatorado, o comportamento assertado deve permanecer o mesmo.

### Validação antes de considerar concluído

- Rodar `npm run test` (e `npm run test:security` se aplicável) e garantir que todos os testes passam.
- Garantir que `npm run build` (backend) e `npm run frontend:build` (frontend) concluem sem erro.
- Se houver scripts que tocam em banco (migrate, seed, sync), não alterar seu contrato de uso sem documentar; em dúvida, não remover validações de ambiente (ex.: confirmação antes de rodar em produção).

---

## Escopo da refatoração

### Backend (`src/`)

- **Rotas** (`src/routes/`): auth, tasks, users, tenants, justifications, lookups, rules, system, holidays, etc. Extrair lógica repetida para funções ou módulos compartilhados; manter contratos HTTP (method, path, body, response).
- **Middleware** (`src/middleware/`): auth, tenant, csrf. Manter comportamento; melhorar legibilidade e nomenclatura se necessário.
- **Serviços** (`src/services/`): email, supabase-storage, holidays, etc. Funções pequenas, responsabilidade clara, tratamento de erro explícito.
- **Banco** (`src/db/`): index, pg, sqlite, types, seeds. Não alterar esquema; pode extrair queries complexas para funções nomeadas ou centralizar constantes.
- **Utilitários** (`src/utils.ts`, `src/access.ts`, etc.): eliminar duplicação; funções puras e testáveis onde fizer sentido.
- **Server** (`src/server.ts`): ordem de carregamento (load-env primeiro), CORS, rate limit, rotas. Não alterar ordem de inicialização nem remover proteções.

### Frontend (`frontend/src/`)

- **Páginas e componentes:** componentes menores e reutilizáveis onde possível; remover código morto e imports não usados; manter a mesma UI e fluxos (login, tarefas, justificativas, usuários, tenants, etc.).
- **Serviços e API** (`services/api.ts`): manter contratos de chamadas (endpoints, payloads); pode centralizar construção de URLs ou headers.
- **Contextos e hooks:** preservar comportamento (auth, tenant, base path); melhorar legibilidade e nomes.
- **Tipos e constantes:** evitar duplicação; manter tipos alinhados com o backend.

### Scripts e testes

- **Scripts** (`scripts/`): migração, seed, sync, etc. Não alterar comportamento destrutivo; pode melhorar mensagens de erro e validações.
- **Testes** (`tests/`): Jest, `tests/setup.ts`, `tests/security.test.ts`. Manter ou aumentar cobertura; não remover asserts que garantem segurança (auth, tenant, CSRF, CORS). Adicionar testes para novos módulos ou fluxos críticos refatorados quando fizer sentido.

---

## Princípios de Clean Code a aplicar

1. **Nomenclatura:** nomes que revelem intenção (variáveis, funções, arquivos). Evitar abreviações obscuras; manter termos do domínio (tenant, task, justification, evidence).
2. **Funções pequenas:** uma função faz uma coisa; preferir funções curtas e composáveis. Extrair blocos longos em funções nomeadas.
3. **DRY (Don’t Repeat Yourself):** identificar código duplicado (ex.: parsing de host/tenant, normalização de MIME type, construção de paths) e extrair para helpers compartilhados.
4. **Responsabilidade única:** módulos e funções com responsabilidade clara; separar lógica de negócio de acesso a dados (onde for viável sem reescrever tudo).
5. **Tratamento de erros:** usar try/catch onde apropriado; retornar ou propagar erros de forma consistente; não engolir exceções; logs sem dados sensíveis (sem senhas, tokens ou PII em excesso).
6. **Evitar efeitos colaterais ocultos:** funções que só leem env ou só transformam dados são mais fáceis de testar; evitar mutação desnecessária de objetos compartilhados.
7. **Comentários:** remover comentários obsoletos ou que apenas repetem o código; manter comentários que explicam “porquê” ou restrições de negócio/domínio.
8. **Imports e dependências:** remover imports não usados; não adicionar dependências novas sem necessidade; manter dependências atuais (package.json) a menos que seja substituição segura e documentada.

---

## Otimizações permitidas (sem mudar comportamento)

- Reduzir duplicação de código (extrair para funções ou módulos).
- Simplificar condições complexas com variáveis ou funções bem nomeadas.
- Evitar workarounds desnecessários ou código redundante (ex.: múltiplas checagens idênticas no mesmo fluxo).
- Melhorar performance de trechos claramente ineficientes (ex.: loops desnecessários, chamadas repetidas ao mesmo recurso), desde que o resultado (output, side effects) permaneça idêntico.
- Reorganizar arquivos muito longos (quebrar em módulos menores) mantendo as mesmas exportações e comportamento.

---

## O que remover

- Código morto (funções, variáveis ou branches nunca usados).
- Imports não utilizados.
- Comentários obsoletos ou que não agregam.
- Dependências não utilizadas no `package.json` (backend e frontend).
- Duplicação que for consolidada em um único lugar (após a consolidação, remover as cópias).

Não remover: validações, checagens de segurança, tratamento de erro necessário, variáveis de ambiente usadas em produção/staging, ou testes que garantem regras de negócio ou segurança.

---

## Testes

- **Manter:** todos os testes existentes em `tests/` devem continuar passando. A refatoração não pode quebrar `npm run test` nem `npm run test:security`.
- **Adicionar ou melhorar:** onde a refatoração introduzir novos módulos, funções puras ou fluxos críticos (ex.: helpers de tenant, normalização de dados, validações), adicionar testes unitários ou de integração quando fizer sentido para evitar regressões.
- **Não alterar comportamento assertado:** se um teste verifica que “sem auth retorna 401” ou “tenant A não acessa task do tenant B”, o resultado esperado deve permanecer o mesmo após a refatoração.

O projeto usa Jest (`jest.config.js`), testes em `tests/`, e `tests/setup.ts` para configuração. O comando principal é `npm run test`.

---

## Ordem sugerida de trabalho (para a IA)

1. **Análise:** percorrer o projeto (backend e frontend), listar duplicações, arquivos muito longos, pontos de melhoria e trechos sensíveis (DB, auth, env).
2. **Refatorações de baixo risco primeiro:** utils, helpers, tipos, constantes; extração de funções puras; remoção de código morto e imports não usados.
3. **Consolidação de duplicação:** identificar padrões repetidos (ex.: parsing de host, MIME type, paths) e criar módulos ou funções compartilhadas; atualizar todos os call sites.
4. **Rotas e serviços:** refatorar mantendo contrato; extrair lógica para funções ou serviços; não alterar respostas HTTP nem regras de auth/tenant.
5. **Frontend:** componentes e páginas; manter UI e fluxos; remover código morto e melhorar nomes e estrutura.
6. **Testes:** rodar suíte; corrigir quebras; adicionar testes onde a refatoração introduzir lógica nova ou crítica.
7. **Verificação final:** `npm run test`, `npm run build`, `npm run frontend:build`; garantir que nenhuma alteração envolve risco para produção (revisar mudanças em db, auth, env).

---

## Critério de sucesso

- Código mais limpo e legível, com menos duplicação e melhor organização.
- Boas práticas de Clean Code aplicadas (nomenclatura, funções pequenas, DRY, responsabilidade única, tratamento de erros).
- Nenhum comportamento funcional alterado (APIs, rotas, autenticação, autorização, tenant isolation).
- Todos os testes existentes passando; testes adicionados para fluxos críticos refatorados quando aplicável.
- Nenhuma alteração destrutiva ou perigosa para produção (sem mudança de esquema sem migração, sem remoção de validações de segurança, sem mistura de ambientes).
- Build do backend e do frontend concluem sem erros.

Use este prompt ao pedir à Claude Code que analise todo o projeto e faça a refatoração em Clean Code conforme descrito acima.
