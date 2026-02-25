# Prompt para Claude Code: E-mail de confirmação de senha com Resend e domínio próprio

Use este documento como prompt ao solicitar à IA (Claude Code) que garanta a implementação do **e-mail de confirmação de senha** (código para definir/redefinir senha) usando a **API do Resend** e **e-mail do domínio** da aplicação, com configuração correta por ambiente (produção e staging).

---

## Objetivo

Garantir que os e-mails de **confirmação de senha** (código de acesso inicial ou redefinição de senha) sejam enviados com sucesso pela aplicação Task-Manager usando:

- **Resend** como provedor de envio (API).
- **E-mail do domínio** (ex.: `noreply@seudominio.com` ou `taskmanager@seudominio.com`), e não o endereço de teste `onboarding@resend.dev`, em produção e, se desejado, em staging.

Cada ambiente deve usar suas próprias variáveis de ambiente (`RESEND_API_KEY`, `EMAIL_FROM`) já carregadas por `load-env.ts`, de forma que **produção** envie com o domínio de produção e **staging** possa usar o mesmo domínio ou um subdomínio (ex.: `noreply@staging.seudominio.com`), conforme configurado no `.env` de cada ambiente.

---

## Tudo via código e variáveis de ambiente

A solução deve depender **apenas de configuração no servidor** (variáveis de ambiente). O administrador:

- Cria conta no Resend, adiciona e verifica o domínio no painel do Resend (DNS na Hostgator ou onde o domínio estiver), e obtém a API Key (documentação passo a passo para leigos está em outro arquivo do projeto).
- Preenche no servidor, em `.env.production` e `.env.staging`, as variáveis `RESEND_API_KEY` e `EMAIL_FROM`. O formato de `EMAIL_FROM` deve ser: `Nome Exibido <email@seudominio.com>` (o domínio do e-mail deve ser o domínio verificado no Resend).
- Não é necessário alterar código para trocar de domínio ou ambiente; basta ajustar as variáveis e reiniciar a aplicação.

---

## Atenção a bugs e proteção da base de produção

**Leia e siga com rigor.** A implementação não pode introduzir regressões nem colocar em risco a base de produção.

### Cuidados com bugs

- **Não quebrar o fluxo atual:** o envio de código de redefinição já existe (`src/services/email.ts` com `sendResetCodeEmail`, chamado em `src/routes/auth.ts` em `request-reset`, `generate-reset` e `generate-reset-bulk`). Qualquer alteração deve manter o contrato (destinatário, assunto, corpo com código e validade) e o comportamento das rotas (resposta genérica em `request-reset`, resposta com `sentByEmail` / `emailError` em `generate-reset`, etc.).
- **Código defensivo:** validar `RESEND_API_KEY` (ex.: não vazia e começando com `re_`) e `EMAIL_FROM` (não vazio, formato aceitável) antes de enviar. Se em **produção** o e-mail estiver habilitado mas a configuração for inválida, falhar de forma explícita (log claro e, se aplicável, resposta de erro ao administrador em `generate-reset`) em vez de enviar silenciosamente para fallback ou falhar de forma obscura.
- **Tratamento de erros:** erros da API do Resend devem ser capturados e logados (sem expor a API key); a resposta ao usuário ou ao admin deve ser genérica quando apropriado (ex.: "Falha ao enviar e-mail") e específica apenas onde fizer sentido (ex.: `emailError` no `generate-reset` para o admin corrigir a configuração).
- **Ambiente:** em desenvolvimento, pode ser opcional configurar Resend (fallback para `onboarding@resend.dev` ou mensagem "E-mail não configurado" conforme já existente). Em **produção** e **staging**, quando o recurso de e-mail for usado, a aplicação deve usar sempre as variáveis do ambiente atual (já garantido por `load-env.ts`).

### Atenção crítica à base de produção

- **Isolamento por ambiente:** produção usa apenas `.env.production` (após `.env`); staging usa apenas `.env.staging`. O serviço de e-mail deve ler `process.env.RESEND_API_KEY` e `process.env.EMAIL_FROM` em tempo de execução, nunca valores fixos no código. Assim, produção nunca usará a API key ou o remetente de staging, e vice-versa.
- **Domínio verificado:** o Resend só envia com domínio próprio após o domínio ser verificado (registros DNS SPF/DKIM no provedor do domínio, ex.: Hostgator). O código não pode "forçar" o envio com um domínio não verificado; a IA pode documentar no código ou nos `.env.example` que o endereço em `EMAIL_FROM` deve ser de um domínio já verificado no Resend.
- **Sem alterações destrutivas:** não alterar a estrutura das tabelas de usuário ou de reset (ex.: `reset_code_hash`, `reset_code_expires_at`); não mudar a lógica de geração ou validação do código. Apenas garantir que o envio use Resend e domínio configurado por env.

---

## Contexto do projeto

### Fluxo atual de e-mail de confirmação de senha

- **Serviço:** `src/services/email.ts` — função `sendResetCodeEmail(options)` que usa o pacote `resend` e as variáveis `RESEND_API_KEY` e `EMAIL_FROM` (fallback atual: `Task Manager <onboarding@resend.dev>`).
- **Rotas que enviam o código:**
  - `POST /api/auth/request-reset` — usuário solicita código (sem auth); sempre resposta genérica; chama `sendResetCodeEmail` se o e-mail existir e estiver ativo.
  - `POST /api/auth/generate-reset` — admin envia código para um usuário; retorna `sentByEmail: true/false` e opcionalmente `emailError`.
  - `POST /api/auth/generate-reset-bulk` — admin mestre envia para vários usuários; retorna por usuário `sent` e `error`.
- **Variáveis de ambiente:** já referenciadas em `.env.production.example` e `.env.staging.example` como `RESEND_API_KEY` e `EMAIL_FROM`. Carregamento por ambiente em `src/load-env.ts` (staging = só `.env.staging`; production = `.env` + `.env.production`).

### O que deve ser garantido ou melhorado

1. **Uso de domínio em produção e staging:** o `EMAIL_FROM` em produção (e, se configurado, em staging) deve usar o domínio da aplicação (ex.: `Task Manager <noreply@fluxiva.com.br>`), não `onboarding@resend.dev`. O fallback para `onboarding@resend.dev` pode permanecer apenas para desenvolvimento ou quando as variáveis não estiverem definidas.
2. **Validação em produção:** se `NODE_ENV === "production"` e a aplicação for configurada para enviar e-mails (ex.: existe rota que chama `sendResetCodeEmail`), considerar validar ao arranque ou na primeira chamada que `RESEND_API_KEY` e `EMAIL_FROM` estão definidos e em formato aceitável; em caso contrário, logar aviso claro ou falhar de forma controlada (conforme critério de “código defensivo” acima).
3. **Documentação nos exemplos de env:** em `.env.production.example` e `.env.staging.example`, deixar explícito o formato de `EMAIL_FROM` (ex.: `Task Manager <noreply@seudominio.com>`) e que o domínio deve estar verificado no Resend. Incluir link curto para a documentação de domínios do Resend ou referência ao passo a passo do projeto (ex.: `PASSO-A-PASSO-EMAIL-HOSTGATOR-RESEND.md`).
4. **Mensagens e logs:** manter mensagens em português; logs de falha de envio não devem incluir a API key nem dados sensíveis do usuário (e-mail pode ser logado com cuidado em ambiente de diagnóstico, conforme política do projeto).

---

## Resumo de arquivos envolvidos

- **Alterar ou revisar:**  
  - `src/services/email.ts` (validação de env, fallback de `EMAIL_FROM`, tratamento de erro).  
  - `src/routes/auth.ts` (apenas se for necessário expor melhor o resultado de `sendResetCodeEmail`; não mudar a lógica de negócio de reset).  
  - `.env.production.example` e `.env.staging.example` (documentar `RESEND_API_KEY`, `EMAIL_FROM` e referência ao passo a passo de configuração do domínio).
- **Opcional:** `src/server.ts` ou um módulo de health/startup — aviso ou falha controlada se, em produção, e-mail for esperado mas `RESEND_API_KEY` ou `EMAIL_FROM` estiverem ausentes ou inválidos.
- **Já existente:** pacote `resend` no `package.json`; não é necessário trocar de provedor.

---

## Critério de sucesso

- Em **produção**, quando `RESEND_API_KEY` e `EMAIL_FROM` estiverem configurados com domínio verificado no Resend, os e-mails de código de redefinição/confirmação de senha são enviados com o remetente do domínio (ex.: `noreply@seudominio.com`), e não com `onboarding@resend.dev`.
- Em **staging**, o mesmo comportamento quando as variáveis de staging estiverem configuradas (mesmo domínio ou subdomínio verificado).
- Em **desenvolvimento**, o envio pode continuar funcionando com fallback ou com variáveis opcionais, sem obrigar configuração de domínio.
- Não há regressão: fluxos de "Esqueci minha senha", "Gerar código de acesso" (um usuário) e "Gerar código em massa" continuam funcionando; respostas e códigos permanecem corretos.
- A documentação nos `.env.*.example` e, se aplicável, no código deixa claro que o domínio do `EMAIL_FROM` deve ser verificado no Resend (e que o passo a passo para configuração na Hostgator e no Resend está em `PASSO-A-PASSO-EMAIL-HOSTGATOR-RESEND.md`).

Use este prompt ao pedir à Claude Code que implemente ou ajuste o e-mail de confirmação de senha com Resend e e-mail do domínio.
