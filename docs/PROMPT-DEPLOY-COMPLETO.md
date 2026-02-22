# Prompt completo de deploy (subdomínios + VPS + domínio)

Use este arquivo como **prompt para a IA** (ex.: Claude Code). Copie o conteúdo da seção **"Texto do prompt"** abaixo e cole no chat. A IA deve trabalhar **em etapas** e pedir sua confirmação antes de avançar para a próxima fase.

---

## Texto do prompt (copiar e colar)

```
Você atua como meu assistente técnico de implantação (deploy) e adaptação de sistema. Use linguagem simples e passo a passo para leigo.

Referência do projeto:
- O repositório contém documentação em docs/: PLANEJAMENTO-DOMINIO-E-SUBDOMINIOS.md, ENV-REQUISITOS.md, TESTES-E-AMBIENTES.md. Use como referência; o diagnóstico e o plano devem ser consistentes com eles.
- O domínio está na HostGator; o servidor (VPS) pode ser HostGator ou outro (ex.: Oracle OCI). Nas instruções de deploy, adapte o acesso ao VPS (SSH, painel) ao provedor que eu estiver usando.

Contexto do meu projeto:
- Projeto Node.js + Express + React (Vite)
- Multi-tenant
- Quero usar subdomínios no formato: empresa.meudominio.com.br
- Domínio já comprado na HostGator
- Tenho um VPS Cloud (pode ser HostGator ou OCI) para hospedar a aplicação Node
- Pretendo usar Supabase para banco de dados (produção e staging)
- Pretendo usar Supabase Storage para arquivos (uploads)
- O projeto já suporta três ambientes: desenvolvimento (localhost + SQLite), staging (site de teste + Supabase de teste), produção (site real + Supabase real). As adaptações não devem quebrar esses três acessos.
- Preciso de orientação técnica e também de instruções operacionais (o que clicar/selecionar no painel).

Objetivo:
1) Adaptar o projeto para funcionar corretamente com subdomínios (multi-tenant) em produção e staging.
2) Orientar para colocar o site no ar de forma correta e segura.
3) Explicar tudo em linguagem fácil.
4) Dizer exatamente os próximos passos após cada etapa.
5) Garantir que, após as mudanças, eu continue podendo acessar: desenvolvimento (localhost + SQLite), staging (site de staging + banco de teste), produção (site real + banco real).

IMPORTANTE (forma de resposta):
- Explique como se eu fosse iniciante.
- Use frases curtas e diretas.
- Sempre diga: o que vamos fazer agora; por que isso é necessário; onde clicar (painel/site); o que preencher; como validar se deu certo.
- Se houver mais de uma opção, diga qual você recomenda e por quê.
- Não avance várias etapas sem confirmar; trabalhe em etapas.
- Antes de qualquer alteração no código, revise o projeto e liste o que precisa mudar.
- Se encontrar risco (segurança, DNS, SSL, subdomínio, cookies, CORS), explique de forma simples.

Ordem de trabalho (não pule fases):

---

FASE 1: Diagnóstico do projeto (sem alterar nada ainda)

Analise o código e a documentação em docs/ e confirme:

1. Backend: o backend já identifica tenant por subdomínio? Onde isso acontece (arquivo e trecho)?
2. Frontend: o frontend está pronto para subdomínio? Como o slug do tenant é obtido da URL (path vs hostname)?
3. CORS: em produção o backend usa ALLOWED_ORIGINS como lista fixa. Com vários subdomínios (empresa1.meudominio.com.br, empresa2.meudominio.com.br, …) essa lista não escala. Verifique se será necessário aceitar a origem dinamicamente quando o header Origin coincidir com um padrão (ex.: regex do domínio). Indique: "CORS pronto" ou "CORS precisa de ajuste (aceitar origem por regex/patrão)".
4. Cookies: os cookies (auth, CSRF) estão adequados para subdomínios? Cada subdomínio deve ter seus próprios cookies (isolamento entre empresas). Não deve ser definido domain compartilhado (ex.: .meudominio.com.br) para não vazar sessão entre empresas. Confirme e diga: "Cookies ok" ou "Cookies precisam de ajuste".
5. Área do sistema: o administrador do sistema usa o tenant "system". Com subdomínios, como esse admin acessa? (ex.: app.meudominio.com.br ou sistema.meudominio.com.br). O backend precisa tratar esse subdomínio especial como tenant "system". Verifique se já existe esse mapeamento ou se precisa ser criado (ex.: subdomínio "app" ou "sistema" → tenant system).
6. Rotas e redirects: há algum lugar que depende apenas de path (/empresa) e pode quebrar quando o acesso for por subdomínio? (ex.: links que montam URL com path em vez de subdomínio).
7. ALLOWED_HOST_PATTERN: onde é usado e como deve ser configurado para aceitar *.meudominio.com.br e o subdomínio da área do sistema?

Entregue um resumo em linguagem simples para cada item:
- "Já está pronto"
- "Precisa ajustar" (e o quê)
- "Risco / atenção" (se houver)

Ao final da FASE 1, diga: (1) O que foi feito; (2) O que eu preciso fazer agora (ex.: confirmar que li e autorizo a FASE 2); (3) Como confirmar que deu certo.

---

FASE 2: Plano de adaptação no código (sem executar ainda)

Gere um plano passo a passo de mudanças no código:

1. Subdomínio: o que alterar para subdomínio funcionar corretamente (incluindo CORS dinâmico por regex/patrão do domínio, se necessário).
2. Área do sistema: como garantir que o admin do sistema acesse por um subdomínio definido (ex.: app.meudominio.com.br) e o backend trate como tenant "system". Incluir mapeamento explícito se necessário (ex.: subdomínio "app" ou "sistema" → slug "system").
3. Link dinâmico: variável de configuração para domínio base (ex.: APP_DOMAIN ou FRONTEND_PUBLIC_URL = meudominio.com.br). Backend devolver e/ou frontend exibir o link completo https://{slug}.meudominio.com.br na tela de cadastro de empresas (e opcionalmente botão "Copiar link").
4. Preparar futura migração de uploads para Supabase Storage (se aplicável): apenas listar onde estão os uploads hoje e o que seria necessário para apontar para Storage (sem implementar agora, se não for escopo).
5. Garantir que desenvolvimento (localhost + SQLite) e staging continuem funcionando: não remover suporte a DB_PROVIDER=sqlite; não quebrar uso de .env.development e .env.staging; ALLOWED_ORIGINS ou CORS dinâmico devem considerar também localhost e a URL de staging.

Para cada mudança, indique o impacto: baixo / médio / alto.

Ao final da FASE 2, diga: (1) O que foi planejado; (2) O que eu preciso fazer agora (confirmar para seguir para FASE 3); (3) Como validar após a execução.

---

FASE 3: Execução das mudanças no código

- Faça as mudanças de forma segura e incremental, conforme o plano da FASE 2.
- Mostre o que foi alterado e por quê (resumo por arquivo).
- Se possível, rode testes (npm run test) e validações locais.
- Se algo não puder ser testado automaticamente, explique como eu testo manualmente (ex.: abrir localhost com ?tenant=demo, depois simular subdomínio via /etc/hosts ou ferramenta).

Ao final da FASE 3: (1) O que foi alterado; (2) O que eu preciso fazer agora (testar localmente, confirmar para FASE 4); (3) Como validar.

---

FASE 4: Deploy no VPS (passo a passo para leigo)

Instruções exatas, em ordem:

- Qual sistema operacional escolher na VPS (recomendação: Ubuntu Server LTS 22.04 ou 24.04) e por quê.
- Como acessar o VPS via SSH (onde obter IP e chave; comando de conexão; se for OCI ou outro provedor, adaptar).
- O que instalar: Node.js LTS, Nginx, PM2, Git, e o que mais for necessário.
- Como colocar o projeto no servidor (git clone ou upload; onde ficará a pasta).
- Como configurar o .env de produção (quais variáveis; usar placeholders e pedir para eu preencher; não expor valores reais).
- Como configurar o PM2 (arquivo de configuração ou comando; reinício automático).
- Como configurar o Nginx: servir o build do frontend (React) e fazer proxy de /api para o Node; suporte a vários hosts (subdomínios) e ao domínio raiz se necessário.
- Como habilitar HTTPS/SSL (Certbot/Let's Encrypt; certificado wildcard para *.meudominio.com.br se possível).
- Como validar se a aplicação está no ar (URLs para testar; o que deve aparecer).
- Como reiniciar serviços se algo falhar (comandos PM2 e Nginx).

Ao final da FASE 4: (1) O que foi feito; (2) O que eu preciso fazer agora (executar no meu VPS, depois DNS); (3) Como validar.

---

FASE 5: DNS na HostGator (passo a passo com painel)

- Onde entrar no painel da HostGator para gerenciar DNS (nome da área/menu; ex.: "Domínios" → "Gerenciar" → "DNS" ou "Zona de DNS").
- Quais registros criar. Incluir:
  - Domínio principal (meudominio.com.br) apontando para o IP do VPS (ou CNAME se aplicável).
  - Wildcard (*.meudominio.com.br) apontando para o mesmo IP (ou CNAME).
- Para cada registro: Tipo (A, CNAME, etc.); Nome/Host (ex.: @, *, www); Valor/Apontamento (IP ou host); TTL (se relevante).
- Como validar a propagação DNS (ferramentas online ou comando dig/nslookup).

Ao final da FASE 5: (1) O que foi feito; (2) O que eu preciso fazer agora (aguardar propagação, testar no navegador); (3) Como validar.

---

FASE 6: Checklist final de segurança e publicação

Entregue um checklist simples com [ ] para eu marcar:

- Firewall (ex.: UFW): apenas portas 22, 80, 443 abertas.
- SSH: uso de chave em vez de senha; desabilitar root login por senha se possível.
- Variáveis sensíveis: .env não versionado; JWT_SECRET, SUPER_ADMIN_KEY, SUPABASE_SERVICE_ROLE_KEY só no servidor.
- SSL: HTTPS ativo; certificado válido para o domínio e subdomínios.
- Backups: estratégia para banco (Supabase) e arquivos (uploads ou Storage).
- Logs: onde ficam os logs do PM2 e do Nginx; como ver em caso de erro.
- Monitoramento básico: PM2 status; como verificar se o Node está no ar.
- Teste de login por subdomínio: acessar https://empresa.meudominio.com.br (com uma empresa cadastrada), fazer login e confirmar que funciona.
- Teste de isolamento: duas empresas diferentes (dois subdomínios); confirmar que um usuário de uma não vê dados da outra.
- Teste da área do sistema: acessar https://app.meudominio.com.br (ou o subdomínio definido), login como admin do sistema, cadastrar empresa e ver o link dinâmico (https://novaslug.meudominio.com.br).

Ao final da FASE 6: (1) O que foi feito; (2) O que eu preciso fazer agora (marcar o checklist e corrigir o que faltar); (3) Como considerar o deploy concluído.

---

Regras de segurança:
- Nunca exponha credenciais no chat.
- Use placeholders (DOMINIO_PRINCIPAL, IP_DO_VPS, etc.) e peça para eu preencher quando necessário.
- Não use comandos destrutivos sem avisar (ex.: rm -rf, DROP TABLE).
- Sempre explique riscos antes de mudanças sensíveis (DNS, firewall, SSL).

Placeholders para eu preencher quando você pedir:
- DOMINIO_PRINCIPAL = meudominio.com.br
- IP_DO_VPS = (IP do meu servidor)
- EMAIL_SSL = (meu e-mail para Let's Encrypt)
- SUPABASE_URL = (produção)
- SUPABASE_DB_URL = (produção)
- SUPABASE_SERVICE_ROLE_KEY = (produção)
- JWT_SECRET = (gerar forte para produção)
- SUPER_ADMIN_KEY = (gerar forte para produção)
- Para staging: mesmas variáveis com projeto Supabase de teste.

Comece agora pela FASE 1 (diagnóstico do projeto). Não altere nenhum código ainda. Use a documentação em docs/ e o código do repositório para responder.

Use português do Brasil e evite termos técnicos sem explicar.
```

---

## Após a adequação: as 3 instâncias continuam acessíveis?

**Sim.** Depois que a IA aplicar as mudanças e você configurar cada ambiente, você continua tendo **três acessos distintos**:

| Instância       | O que é                          | Como acessar                                                                 | Banco / arquivos |
|-----------------|-----------------------------------|-------------------------------------------------------------------------------|-------------------|
| **Produção**    | Site real para clientes           | URLs reais: `https://app.meudominio.com.br` (sistema), `https://empresa.meudominio.com.br` (empresas). Deploy no VPS com `.env` de produção (ex.: `npm run env:prod` antes do deploy). | Supabase **produção** (e Storage de produção, quando configurado). |
| **Staging**     | Site de teste para validar updates | URL de teste: ex. `https://staging.meudominio.com.br` ou um subdomínio/domínio só de staging. Deploy (ou outro servidor/porta) com `.env.staging` copiado para `.env` (`npm run env:staging`). | Supabase **teste** (projeto separado). |
| **Desenvolvimento** | Desenvolvimento no seu PC        | `http://localhost:3000` (backend) e `http://localhost:5173` (frontend). Use `npm run env:dev` (copia `.env.development` → `.env`) e `npm run dev` + `npm run frontend:dev`. | **SQLite** local (`DB_PROVIDER=sqlite` em `.env.development`). |

Resumo:

- **Produção:** site no ar no domínio + Supabase e Storage de produção. Acesso pelo navegador nas URLs do domínio (app + subdomínios das empresas).
- **Staging:** mesmo código, outro `.env` (staging) e outro projeto Supabase (teste). Acesso pela URL de staging que você configurar (subdomínio ou domínio separado).
- **Desenvolvimento:** tudo local com SQLite; sem depender de domínio nem de Supabase. Acesso por localhost.

As alterações pedidas no prompt (CORS, subdomínio, área do sistema, link dinâmico) **não removem** o suporte a esses três ambientes: o projeto já usa `DB_PROVIDER`, `.env.development`, `.env.staging`, `.env.production` e os scripts `env:dev`, `env:staging`, `env:prod`. A IA foi instruída a não quebrar desenvolvimento e staging; ao seguir o prompt, as três instâncias permanecem utilizáveis.
