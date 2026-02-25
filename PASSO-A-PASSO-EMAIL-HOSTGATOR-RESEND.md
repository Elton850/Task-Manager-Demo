# Passo a passo: configurar e-mail de confirmação de senha (Resend + domínio na Hostgator)

Este guia é para **administradores** que não são desenvolvedores. Ele explica como configurar o envio de e-mails da aplicação (código de redefinição de senha) usando o **Resend** e um **e-mail do seu domínio** (ex.: `noreply@seudominio.com.br`), com o DNS gerenciado na **Hostgator**.

O envio só funciona depois que:
1. Você tem uma conta no Resend e adiciona o seu domínio.
2. O Resend mostra registros DNS (TXT, MX) que você deve criar.
3. Você cria esses registros no painel da Hostgator (Zone Editor).
4. O Resend verifica o domínio e libera o envio.
5. Você coloca a chave da API e o endereço do remetente no servidor onde a aplicação roda.

---

## Parte 1 — Conta e domínio no Resend

### 1.1 Criar conta no Resend

1. Acesse **https://resend.com** e clique em **Sign Up** (ou **Login** se já tiver conta).
2. Crie a conta com seu e-mail (pode ser o mesmo do domínio que vai usar).
3. Confirme o e-mail se o Resend pedir.

### 1.2 Adicionar seu domínio

1. No painel do Resend, no menu lateral, clique em **Domains** (Domínios).
2. Clique em **Add Domain** (Adicionar domínio).
3. Digite o domínio **sem** www, por exemplo:
   - `fluxiva.com.br`  
   Ou, se quiser usar um subdomínio só para envio:
   - `enviar.fluxiva.com.br`
4. Clique em **Add** (ou **Add Domain**).

### 1.3 Ver os registros DNS que o Resend pede

Depois de adicionar o domínio, o Resend mostra uma tela com os **registros DNS** que você precisa criar no seu provedor (Hostgator). Em geral aparecem:

- **TXT** — para **SPF** (autorização de envio)
- **TXT** — para **DKIM** (assinatura do e-mail)
- **MX** — para o “return path” (receber bounces), em um subdomínio (ex.: `send.seudominio.com.br`)

**Importante:** anote ou deixe essa tela aberta. Você vai precisar **copiar exatamente** o que o Resend mostrar para cada registro (nome do host e valor). O Resend pode mostrar algo assim:

| Tipo | Nome / Host        | Valor / Conteúdo                          |
|------|--------------------|-------------------------------------------|
| TXT  | @ ou seudominio.com.br | `v=spf1 include:amazonses.com ~all`  |
| TXT  | um nome longo (DKIM)   | `p=MIGfMA0GCS...` (texto grande)     |
| MX   | send (ou outro)        | `feedback-smtp.us-east-1.amazonses.com` |

Os valores reais **são diferentes para cada conta** no Resend. Use sempre os que aparecem na **sua** tela de domínio.

### 1.4 Clicar em “Verify” no Resend

Depois de criar os registros na Hostgator (Parte 2), volte ao Resend, na página do domínio, e clique em **Verify** (ou **Verify DNS Records**). Pode levar alguns minutos (até 1–2 horas) para o DNS atualizar. Se falhar, confira se copiou certo e espere um pouco e tente de novo.

---

## Parte 2 — Criar os registros DNS na Hostgator

A Hostgator usa o **cPanel**. O lugar onde se criam os registros DNS é o **Zone Editor** (Editor de Zona).

### 2.1 Entrar no cPanel da Hostgator

1. Acesse o painel da Hostgator (ex.: **https://painel.hostgator.com.br** ou o link que a Hostgator enviou).
2. Faça login.
3. Abra o **cPanel** da conta onde está o domínio que você adicionou no Resend.

### 2.2 Abrir o Zone Editor

1. No cPanel, procure a seção **Domínios** (ou **Domains**).
2. Clique em **Zone Editor** (Editor de Zona).
3. Na lista de domínios, encontre o domínio que você configurou no Resend (ex.: `fluxiva.com.br`).
4. Clique em **Manage** (Gerenciar) ao lado desse domínio.  
   — Assim você abre a lista de registros DNS desse domínio.

### 2.3 Adicionar cada registro que o Resend pediu

Para **cada** linha que o Resend mostrou (TXT para SPF, TXT para DKIM, MX para return path):

1. No Zone Editor, clique em **+ Add Record** (ou **+ Adicionar registro**).
2. Escolha o **Type** (Tipo):
   - **TXT** para os registros TXT (SPF e DKIM).
   - **MX** para o registro MX.
3. **Name / Host (Nome):**
   - O Resend mostra algo como “Name” ou “Host”. No Hostgator, às vezes você coloca só a parte “antes” do domínio.  
   - Exemplos: se o Resend disser `@`, use `@` ou deixe em branco (dependendo do cPanel). Se disser `send` ou `send.seudominio.com.br`, use `send` (o cPanel já adiciona o domínio).  
   - Se o Resend mostrar um nome longo para o DKIM (ex.: `resend._domainkey`), use exatamente esse nome.
4. **Value / Record / Conteúdo:**
   - **Copie e cole exatamente** o valor que o Resend mostrou para esse registro. Não mude nenhuma letra.
5. Para **MX**: além do valor (ex.: `feedback-smtp.us-east-1.amazonses.com`), o Resend pode pedir uma **prioridade** (ex.: 10). Se pedir, preencha o campo de prioridade com esse número.
6. Clique em **Save Record** (ou **Salvar**) para salvar o registro.

Repita isso para **todos** os registros que o Resend listar (SPF, DKIM, MX). Não pule nenhum.

### 2.4 Aguardar a propagação do DNS

Depois de salvar, o DNS pode levar **alguns minutos a algumas horas** para atualizar no mundo todo. Espere pelo menos 10–15 minutos e então, no Resend, clique em **Verify** no domínio. Se ainda falhar, espere mais 1–2 horas e tente de novo.

---

## Parte 3 — Obter a chave da API no Resend

1. No painel do Resend, no menu lateral, clique em **API Keys** (Chaves de API).
2. Clique em **Create API Key** (Criar chave de API).
3. Dê um nome (ex.: “Task Manager Produção”).
4. Escolha a permissão **Sending access** (acesso de envio).
5. Clique em **Add** (ou **Create**).  
6. **Copie a chave** na hora. Ela começa com `re_` e **só aparece uma vez**. Se perder, terá que criar outra chave.

Guarde essa chave em um lugar seguro (ex.: bloco de notas) para colar no servidor na Parte 5.

---

## Parte 4 — Definir o endereço do remetente (EMAIL_FROM)

O e-mail que aparece como “remetente” nos códigos de senha deve ser um endereço **do domínio que você verificou** no Resend. Exemplos:

- `noreply@fluxiva.com.br`
- `taskmanager@fluxiva.com.br`
- `senha@fluxiva.com.br`

Não use um e-mail de outro domínio (ex.: @gmail.com) nem o de teste do Resend (`onboarding@resend.dev`) em produção. O formato que a aplicação espera é:

```text
Nome que aparece <email@seudominio.com.br>
```

Exemplo:

```text
Task Manager <noreply@fluxiva.com.br>
```

Anote exatamente o que você vai usar (nome e endereço) para a Parte 5.

---

## Parte 5 — Configurar no servidor onde a aplicação roda

A aplicação lê duas variáveis do ambiente do servidor (arquivo `.env` ou painel da VPS/hosting):

1. **RESEND_API_KEY** — a chave que você copiou no Resend (começa com `re_`).
2. **EMAIL_FROM** — o remetente no formato `Nome <email@seudominio.com.br>`.

### Onde colocar (em resumo)

- Se o servidor usar um arquivo **.env** na pasta do projeto:
  - Abra o arquivo `.env.production` (produção) ou `.env.staging` (staging).
  - Adicione ou edite estas linhas (troque pelos seus valores reais):

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=Task Manager <noreply@fluxiva.com.br>
```

- Se o servidor usar painel (ex.: variáveis de ambiente da VPS):
  - Crie ou edite as variáveis `RESEND_API_KEY` e `EMAIL_FROM` com os mesmos valores.
  - Reinicie a aplicação depois de salvar.

**Segurança:** não compartilhe a `RESEND_API_KEY` e não coloque esse arquivo em rede pública ou em repositório de código. O arquivo `.env.production` já deve estar no `.gitignore`.

---

## Parte 6 — Testar o envio

1. Reinicie a aplicação no servidor (se ainda não reiniciou após configurar as variáveis).
2. Acesse a aplicação (produção ou staging) e vá até a tela de **login**.
3. Clique em **Esqueci minha senha** (ou equivalente) e informe um e-mail de usuário que exista e esteja ativo.
4. Verifique a caixa de entrada (e o spam) desse e-mail. Deve chegar um e-mail com o **código** para redefinir a senha, com remetente igual ao que você definiu em `EMAIL_FROM` (ex.: `Task Manager <noreply@fluxiva.com.br>`).

Se o e-mail **não** chegar:

- Confira se o domínio está **Verified** (verificado) no Resend.
- Confira se `RESEND_API_KEY` e `EMAIL_FROM` estão corretos no servidor e se a aplicação foi reiniciada.
- No Resend, em **Emails** ou **Logs**, veja se o envio aparece e se há algum erro.
- Confirme que os registros DNS na Hostgator foram criados exatamente como o Resend pediu (principalmente os TXT de SPF e DKIM).

---

## Resumo rápido

| Onde        | O que fazer |
|------------|--------------|
| **Resend** | Criar conta → Domains → Add domain → Anotar registros DNS → Depois de criar na Hostgator: Verify → API Keys: criar chave e copiar `re_...` |
| **Hostgator** | cPanel → Zone Editor → Manage no domínio → Add Record para cada TXT (SPF, DKIM) e MX que o Resend mostrou |
| **Servidor** | Colocar `RESEND_API_KEY` e `EMAIL_FROM` no `.env.production` (ou painel) e reiniciar a aplicação |
| **Teste**  | “Esqueci minha senha” com um e-mail válido e verificar se o e-mail chegou com o remetente do seu domínio |

Se seguir todos os passos, o e-mail de confirmação de senha será enviado com sucesso usando o domínio configurado na Hostgator e no Resend.
