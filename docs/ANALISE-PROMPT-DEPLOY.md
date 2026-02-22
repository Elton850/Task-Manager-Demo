# Análise do prompt de deploy (subdomínios + VPS + domínio)

Este documento analisa se o **prompt de deploy** que você escreveu é **suficiente e funcional** para colocar o site no ar com domínio e subdomínios (empresa.meudominio.com.br), e se atende ao uso com **Claude Code** para implementação.

---

## Conclusão geral

**Sim, o prompt serve de forma funcional** para orientar a colocação do site no ar com domínio e subdomínios. A ordem das fases (diagnóstico → plano → código → deploy → DNS → checklist) é adequada e o formato (etapas, confirmação, linguagem simples) está bom.

Há **alguns pontos a incluir ou reforçar** no prompt para que a IA não perca detalhes importantes do seu projeto (CORS com subdomínios, área do sistema, link dinâmico). Abaixo: o que está ótimo, o que complementar e uma versão revisada do prompt.

---

## O que o prompt já cobre bem

| Item | Status |
|------|--------|
| Fases em ordem (diagnóstico → plano → código → deploy → DNS → checklist) | ✅ Bom |
| Linguagem para leigo, frases curtas, “o que / por quê / onde / como validar” | ✅ Bom |
| Trabalhar em etapas e pedir confirmação antes de avançar | ✅ Bom |
| Placeholders para domínio, IP, Supabase, JWT, etc. | ✅ Bom |
| Regras de segurança (não expor credenciais, avisar riscos) | ✅ Bom |
| FASE 5 (DNS) com tipo, nome, valor, wildcard | ✅ Bom |
| FASE 6 (checklist firewall, SSH, SSL, backups, testes) | ✅ Bom |
| Menção a Supabase (DB + Storage) | ✅ Bom |

---

## O que falta ou deve ser reforçado no prompt

### 1. CORS com vários subdomínios

- **Problema:** Em produção o backend usa `ALLOWED_ORIGINS` como **lista fixa**. Com subdomínios (empresa1.dominio.com.br, empresa2.dominio.com.br, …) não dá para listar todos.
- **O que a IA precisa fazer:** No diagnóstico (FASE 1), identificar que CORS precisa **aceitar origem dinamicamente** quando o `Origin` bater com um padrão (ex.: `https://[subdominio].meudominio.com.br`). No plano (FASE 2) e na execução (FASE 3), prever essa alteração (ex.: em produção, se `Origin` corresponder a um regex do domínio, retornar esse `Origin` no header `Access-Control-Allow-Origin`).
- **Sugestão no prompt:** Na FASE 1, pedir explicitamente: *“Verificar se CORS em produção suporta múltiplos subdomínios (empresa1.dominio.com.br, empresa2.dominio.com.br, …) ou se precisa de ajuste para aceitar origem por padrão/regex.”*

### 2. Área do sistema (admin) e domínio

- **Problema:** O “administrador do sistema” hoje usa o tenant **system**. Com subdomínios, é preciso definir **como** esse admin acessa: por exemplo `sistema.meudominio.com.br` ou `app.meudominio.com.br`, com o backend tratando esse host como tenant “system”.
- **No código:** O backend já faz “se não tiver slug, usa system”. Se o usuário acessar `sistema.meudominio.com.br`, o subdomínio seria `sistema` – é preciso que exista um tenant com slug `system` (já existe) **e** que o frontend, nesse host, identifique tenant “system” (hoje o frontend usa “system” para rotas reservadas; com subdomínio `sistema` o slug seria `sistema`, não `system`). Ou seja: pode ser necessário um subdomínio especial (ex.: `app`) que o backend mapeie para o tenant “system”.
- **Sugestão no prompt:** Na FASE 1/2, pedir: *“Definir como o administrador do sistema acessa a área de cadastro (ex.: app.meudominio.com.br ou sistema.meudominio.com.br) e garantir que o backend trate esse subdomínio como tenant ‘system’.”*

### 3. Link dinâmico (empresa.meudominio.com.br) na tela de cadastro

- **Problema:** O prompt pede que o cadastro de empresa exiba o link dinâmico. O backend já devolve `accessUrl` (hoje no formato path). Falta: variável de “domínio base” (ex.: `APP_DOMAIN` ou `FRONTEND_PUBLIC_URL`) e exibir/copiar `https://{slug}.meudominio.com.br` na tela de empresas.
- **Sugestão no prompt:** Manter como está (já está na FASE 2); só garantir que o plano inclua: *“Variável de configuração para domínio base (ex.: APP_DOMAIN) e exibição do link completo (https://{slug}.meudominio.com.br) na tela de cadastro de empresas (e opcionalmente botão copiar).”*

### 4. Cookies e subdomínios

- **Situação no projeto:** Os cookies (auth, CSRF) **não** definem `domain`. Assim, cada subdomínio (empresa.dominio.com.br) tem seus próprios cookies – o que é **correto** para isolamento entre empresas. Nada a mudar por causa de cookie entre subdomínios.
- **Sugestão no prompt:** Na FASE 1, pedir que a IA **confirme** se os cookies estão adequados para subdomínios (cada empresa no seu subdomínio, sem compartilhar cookie entre empresas). Isso evita que a IA “invente” um `domain: .dominio.com.br` e quebre o isolamento.

### 5. Referência ao repositório e documentação existente

- **Problema:** Se você usar o prompt no Claude Code em cima do repositório, a IA terá o código; mas o prompt não cita a documentação que você já tem (ex.: `docs/PLANEJAMENTO-DOMINIO-E-SUBDOMINIOS.md`, `docs/ENV-REQUISITOS.md`).
- **Sugestão:** Adicionar uma linha no início: *“O projeto já tem documentação em docs/ (PLANEJAMENTO-DOMINIO-E-SUBDOMINIOS.md, ENV-REQUISITOS.md). Use como referência; o diagnóstico e o plano devem ser consistentes com eles.”*

### 6. VPS “OCI NVMe 2” e HostGator

- **Ponto de atenção:** Você disse “VPS Cloud (OCI NVMe 2)” e “domínio na HostGator”. O **VPS** é da HostGator ou é **Oracle Cloud (OCI)**? Se for OCI, o passo a passo de “acessar VPS” e “onde está o painel” muda (HostGator = domínio/DNS; OCI = servidor). O prompt já separa “DNS na HostGator” e “Deploy no VPS”, o que está correto; só vale deixar explícito no prompt: *“O domínio está na HostGator; o servidor (VPS) pode ser HostGator ou outro (ex.: OCI). Adapte os passos de acesso ao VPS conforme o provedor (SSH, painel, etc.).”*

---

## Ajustes sugeridos no texto do prompt

Trechos para **incluir ou trocar** no seu prompt, para ficar mais preciso e funcional.

**1) Depois do “Contexto do meu projeto”, adicionar:**

- “O projeto tem documentação em docs/ (ex.: PLANEJAMENTO-DOMINIO-E-SUBDOMINIOS.md, ENV-REQUISITOS.md). Use como referência e mantenha o diagnóstico e o plano alinhados a ela.”
- “O domínio está na HostGator; o VPS pode ser HostGator ou outro (ex.: OCI). Nas instruções de deploy, adapte o acesso ao VPS (SSH, painel) ao provedor que eu estiver usando.”

**2) Na FASE 1 (Diagnóstico), incluir explicitamente:**

- “CORS: verificar se em produção o backend precisa aceitar múltiplos subdomínios (empresa1.dominio.com.br, empresa2.dominio.com.br, …). Se ALLOWED_ORIGINS for só uma lista fixa, indicar que será necessário aceitar origem por padrão/regex.”
- “Cookies: confirmar se estão adequados para subdomínios (cada subdomínio com seus próprios cookies, sem compartilhar entre empresas).”
- “Área do sistema: como o administrador do sistema acessa (ex.: app.meudominio.com.br ou sistema.meudominio.com.br) e como o backend identifica esse host como tenant ‘system’.”

**3) Na FASE 2 (Plano), incluir:**

- “Se CORS precisar de ajuste: plano para aceitar Origin dinamicamente quando coincidir com o domínio (ex.: regex).”
- “Definir variável de domínio base (ex.: APP_DOMAIN) e exibir link completo (https://{slug}.meudominio.com.br) na tela de cadastro de empresas (e opcionalmente botão copiar).”

**4) FASE 4 (Deploy no VPS):**

- Manter como está; só reforçar: “Incluir qual SO escolher na VPS (recomendação: Ubuntu Server LTS) e, se o VPS for de outro provedor que não a HostGator, indicar onde obter IP e como acessar por SSH.”

---

## Uso com Claude Code

- O prompt **serve bem** para o Claude Code: as fases estão claras, o pedido de “não avançar sem confirmar” evita mudanças em bloco, e “revise o projeto e liste o que precisa mudar” antes de alterar código combina com o fluxo de diagnóstico/plano/execução.
- Para melhor resultado:
  - Use o prompt **dentro do repositório** (Claude Code com o projeto aberto), para a IA ter acesso ao código e aos `docs/`.
  - Se quiser, na primeira mensagem além do prompt, escreva: “Comece pela FASE 1. O repositório já contém docs/PLANEJAMENTO-DOMINIO-E-SUBDOMINIOS.md e docs/ENV-REQUISITOS.md; use-os como referência.”

---

## Resumo final

| Pergunta | Resposta |
|----------|----------|
| O prompt serve para colocar o site no ar com domínio? | **Sim.** A estrutura (fases 1–6) e o conteúdo cobrem diagnóstico, código, deploy, DNS e segurança. |
| Falta algo crítico? | **CORS com vários subdomínios** (lista fixa vs. padrão/regex) e **como o admin do sistema acessa** (qual subdomínio = “system”). Incluir isso no prompt evita esquecimento. |
| Cookies/SSL/DNS estão cobertos? | **Sim.** O prompt já pede SSL, DNS com wildcard e checklist de segurança; cookies só precisam ser **verificados** (não definir domain para não compartilhar entre empresas). |
| Funciona com Claude Code? | **Sim.** Com os pequenos acréscimos acima (CORS, área sistema, link dinâmico, referência aos docs e ao tipo de VPS), o prompt fica mais preciso e funcional para implementação passo a passo. |

Com esses ajustes, o prompt fica **completo e funcional** para colocar o site no ar usando domínio e subdomínios e para guiar a IA (incluindo Claude Code) de forma segura e por etapas.
