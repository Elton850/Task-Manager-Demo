# Task Manager — Resumo do Projeto para Sócios

**Objetivo deste documento:** Apresentar o que é o sistema, o que ele oferece para clientes e para a equipe de desenvolvimento, como a segurança é tratada e quais são as possibilidades futuras. A linguagem foi pensada para quem não é da área de programação.

---

## 1. O que é o Task Manager?

O **Task Manager** é um **sistema de gestão de tarefas** voltado a empresas. Ele permite que uma empresa (ou várias empresas, cada uma no seu “espaço”) organize tarefas por calendário, por área, por responsável e por tipo, com controle de quem vê e quem edita o quê.

Em termos simples:
- **Cada empresa** tem seu próprio “ambiente” (dados isolados).
- **Dentro de cada empresa** existem usuários com papéis diferentes: quem só executa tarefas, quem lidera uma área e quem administra tudo.
- O sistema oferece **calendário**, **lista de tarefas**, **indicadores de desempenho**, **justificativas** (com anexos) e **configurações** (áreas, tipos, regras).

---

## 2. Para o cliente (empresa que usa o sistema)

### 2.1 O que o cliente pode fazer hoje

| Funcionalidade | Descrição em linguagem simples |
|----------------|---------------------------------|
| **Calendário** | Ver as tarefas no mês ou no dia; marcar como concluídas direto no calendário. |
| **Tarefas** | Criar, editar, filtrar e listar tarefas; definir responsável, área, tipo e recorrência (mensal, semanal etc.); anexar evidências (fotos, PDFs). |
| **Performance** | Ver indicadores e tabelas por responsável (quem fez o quê, em que período). |
| **Usuários** | O administrador da empresa cadastra líderes e usuários; o líder vê só os usuários da sua área. |
| **Empresa** | O administrador da empresa pode editar o nome e dados da empresa (e, quando configurado, logo). |
| **Justificativas** | Registrar justificativas ligadas a tarefas (por exemplo, por que não foi feita), com anexos e fluxo de aprovação. |
| **Configurações** | Definir áreas, tipos de tarefa, recorrências e regras por área (quem é ADMIN ou LEADER gerencia isso). |
| **Recuperação de senha** | O usuário pode pedir um código por e-mail para redefinir a senha; o administrador também pode gerar códigos para os usuários. |

### 2.2 Quem acessa o quê (papéis)

- **USER (usuário):** Vê e edita **só as tarefas das quais é responsável**; acessa calendário, tarefas, justificativas e performance dentro desse limite.
- **LEADER (líder):** Vê e gerencia **tudo da sua área** (tarefas e usuários da área); acessa usuários, configurações (regras, tipos etc.) e as mesmas telas do usuário, com visão ampliada da área.
- **ADMIN (administrador da empresa):** Vê e gerencia **toda a empresa** (todas as áreas, todos os usuários, configurações, dados da empresa).

Assim, o cliente tem controle fino: cada pessoa vê apenas o que faz sentido para o seu papel.

### 2.3 Como o cliente acessa

- **Hoje:** Por link com identificador da empresa (ex.: `site.com/demo` ou, no futuro, `empresa.dominio.com.br`).
- **Multi-tenant:** Cada empresa tem seus dados totalmente separados; um usuário da Empresa A nunca vê dados da Empresa B.

---

## 3. Para o desenvolvedor / operador do sistema

### 3.1 Área “Sistema” (administrador do sistema)

Existe um nível acima das empresas: o **administrador do sistema**. Ele acessa com o tenant **“system”** (por exemplo, por um link dedicado ou subdomínio) e tem:

| Recurso | O que faz |
|---------|-----------|
| **Cadastro de empresas** | Criar novas empresas (tenants); cada uma ganha um identificador (slug) que vira o “endereço” dela (ex.: `minhaempresa` → depois `minhaempresa.dominio.com.br`). |
| **Visão geral do sistema** | Dashboard da operação do sistema. |
| **Logs de acesso** | Consultar registros de login para auditoria. |

Ou seja: quem opera o produto pode **cadastrar novas empresas** sem mexer em código; cada empresa é um novo “tenant” com dados isolados.

### 3.2 Ferramentas e scripts úteis

- **Ambientes:** Desenvolvimento (local), Staging (teste na nuvem) e Produção, com bancos separados para não misturar dados de teste com dados reais.
- **Banco de dados:** Suporte a **SQLite** (local, simples) e **Supabase/PostgreSQL** (nuvem, para staging e produção).
- **Scripts:** Migração de dados do SQLite para Supabase; cópia de produção para staging (testar com dados reais sem alterar produção); limpeza da base de staging; validação das variáveis de ambiente; sincronização do usuário administrador do sistema.

Isso dá segurança e flexibilidade: desenvolver e testar sem risco para o cliente.

### 3.3 Recursos técnicos para o desenvolvedor

- **“Visualizar como” (impersonation):** O administrador do sistema pode “entrar” na visão de outro usuário (somente leitura), para suporte e diagnóstico, sem alterar dados.
- **Geração de códigos de reset em massa:** Enviar por e-mail códigos de redefinição de senha para vários usuários de uma vez (útil em onboarding).
- **API REST** com autenticação (JWT em cookie), CSRF e controle de tenant em todas as rotas.

---

## 4. Segurança do site

O projeto leva segurança a sério: há camadas de proteção na aplicação e testes automáticos que verificam se elas funcionam.

### 4.1 Proteções implementadas

| Medida | O que significa em linguagem simples |
|--------|--------------------------------------|
| **Isolamento por empresa (multi-tenant)** | Os dados de uma empresa **nunca** aparecem para outra. O sistema verifica em toda requisição se o usuário pertence à empresa correta; tentativas de acessar dados de outra empresa são bloqueadas (404 ou 403). |
| **Autenticação obrigatória** | Áreas sensíveis (tarefas, usuários, configurações etc.) exigem login; sem login válido o usuário recebe 401 (não autorizado). |
| **Controle por papel (role)** | Mesmo logado, o usuário só acessa o que seu papel permite (USER, LEADER, ADMIN). Tentativas de acessar rotas de outro papel retornam 403 (proibido). |
| **Proteção CSRF** | Evita que um site malicioso externo execute ações em nome do usuário logado (ex.: criar ou apagar tarefas). As mutações exigem um token que só o próprio site conhece. |
| **CORS** | O servidor só aceita requisições de origens permitidas (ex.: seu domínio). Requisições de outros domínios são bloqueadas. |
| **Rate limiting** | Limite de tentativas de login e de redefinição de senha por tempo (ex.: 20 logins em 15 minutos); reduz risco de ataques de força bruta e abuso. |
| **Headers de segurança (Helmet)** | O servidor envia cabeçalhos que orientam o navegador a não executar conteúdos inseguros e a aplicar políticas de conteúdo (CSP, HSTS em produção, etc.). |
| **Senhas** | Armazenadas com hash (bcrypt); nunca em texto puro. |
| **JWT em cookie httpOnly** | O token de sessão fica em cookie marcado como httpOnly (não acessível por JavaScript), o que reduz risco de roubo por script malicioso. |
| **Host válido** | Em produção, o servidor só atende requisições para domínios configurados (ex.: seu domínio e subdomínios), evitando uso indevido do servidor. |

### 4.2 Testes automáticos de segurança

Existem **16 testes** que rodam com o comando `npm run test` (ou `npm run test:security`). Eles verificam, entre outras coisas:

- Endpoints públicos (health, CSRF) se comportam como esperado.
- Rotas protegidas retornam 401 sem login.
- Mutações sem token CSRF retornam 403.
- Requisições sem tenant válido são rejeitadas.
- **Isolamento entre tenants:** com login da Empresa A, acessar recurso da Empresa B retorna 404; usar header de tenant B com token da Empresa A retorna 403 (TENANT_MISMATCH).
- CORS: origem não permitida não recebe permissão de acesso.
- Respostas incluem headers de segurança.
- Usuário com papel USER não acessa rotas restritas a ADMIN (403).

Isso dá confiança de que as regras de segurança continuam valendo quando o código muda.

---

## 5. Possibilidades futuras (já planejadas ou compatíveis)

Com base na estrutura atual do projeto e na documentação existente:

### 5.1 Colocação no ar e domínio

- **Subdomínio por empresa:** O sistema **já está preparado** para usar o formato `empresa.dominio.com.br`. Falta configurar DNS (incluindo wildcard `*.dominio.com.br`), servidor/hospedagem e variáveis de ambiente (domínio base, origens permitidas, etc.). Documento de apoio: `docs/PLANEJAMENTO-DOMINIO-E-SUBDOMINIOS.md`.
- **Link dinâmico ao cadastrar empresa:** Na tela de Cadastro de empresas (área sistema), é possível exibir o link completo da nova empresa (ex.: `https://minhaempresa.dominio.com.br`) assim que ela for criada, usando uma variável de “domínio base” e o slug já existente.

### 5.2 Funcionalidades de produto

- **Notificações:** Já existem componentes e hooks no frontend (ex.: notificações, cards); podem ser expandidos para lembretes de prazo, tarefas atrasadas, aprovações de justificativas, etc.
- **Relatórios e exportação:** Já há utilitário de exportação de tarefas; pode evoluir para relatórios em PDF/Excel e filtros avançados.
- **App mobile:** A API REST permite que um aplicativo mobile (futuro) consuma os mesmos endpoints, mantendo a mesma lógica de segurança e multi-tenant.
- **Integrações:** Possibilidade de integração com e-mail, calendário externo ou ferramentas de gestão, usando a API e o controle de tenant.

### 5.3 Operação e negócio

- **Vários ambientes:** Staging e produção já estão pensados (bases separadas, scripts de cópia e limpeza), permitindo testar releases antes de ir ao ar.
- **Escalabilidade:** Uso de Supabase/PostgreSQL em produção permite crescer em número de empresas e usuários; o modelo multi-tenant segue o mesmo.
- **White-label / personalização:** Logo por tenant e nome da empresa já existem; no futuro dá para ampliar (cores, tema) por empresa.

---

## 6. Resumo executivo (uma página)

- **O que é:** Sistema de gestão de tarefas multi-empresa (multi-tenant), com calendário, tarefas, desempenho, justificativas e configurações, e três papéis (USER, LEADER, ADMIN).
- **Para o cliente:** Cada empresa tem seu espaço isolado; usuários veem só o que seu papel permite; há recuperação de senha por e-mail e possibilidade de o admin gerar códigos.
- **Para o desenvolvedor/operador:** Área “Sistema” para cadastrar empresas; ambientes dev/staging/produção; suporte a SQLite e Supabase; scripts de migração, cópia e limpeza; “visualizar como” e reset em massa.
- **Segurança:** Isolamento por tenant, autenticação, autorização por papel, CSRF, CORS, rate limit, senhas com hash, cookie httpOnly, validação de host e 16 testes automáticos de segurança.
- **Futuro:** Colocação no ar com subdomínio por empresa (`empresa.dominio.com.br`), link dinâmico no cadastro de empresas, notificações, relatórios, possibilidade de app mobile e integrações, mantendo a mesma base segura e multi-tenant.

Este documento pode ser usado como base para uma reunião com o sócio: cada seção pode ser resumida verbalmente, e a seção 6 serve como “uma página” para impressão ou slide.
