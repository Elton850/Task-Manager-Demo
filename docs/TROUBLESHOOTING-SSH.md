# SSH: Connection refused (porta 22)

Quando `ssh root@IP_DO_VPS` retorna **Connection refused**, a conexão nem chega ao SSH. Confira as causas abaixo **nesta ordem**.

---

## 1. Firewall / lista de segurança do provedor (mais comum em nuvem)

Em **VPS na nuvem** (HostGator Cloud, Oracle OCI, AWS, etc.), existe um **firewall do provedor** que pode bloquear a porta 22 antes do tráfego chegar ao seu servidor.

### O que fazer

- **HostGator (VPS):** no painel da Hostgator, procure por **Firewall**, **Security** ou **Rede**. Verifique se a porta **22 (TCP)** está **liberada** para entrada (inbound). Libere para o seu IP ou, só para testar, para **0.0.0.0/0** (qualquer IP). Depois restrinja de novo ao seu IP se quiser.
- **Oracle Cloud (OCI):** no console OCI → sua VCN → **Security Lists** → lista vinculada à subnet da sua instância. Inclua uma regra **Ingress**: origem `0.0.0.0/0`, protocolo TCP, porta de destino **22**. Salve e espere 1–2 minutos. Também confira **Network Security Groups (NSG)** se a instância usar NSG.
- **Outros provedores:** procure por “Security Group”, “Firewall”, “Network rules” e libere **TCP 22** (entrada/inbound).

Depois de salvar, teste de novo:

```bash
ssh root@IP_DO_VPS
```

---

## 2. SSH não está instalado ou não está rodando no VPS

Se o VPS for novo ou a imagem não tiver SSH por padrão, o serviço pode não estar ativo.

- **Como verificar (só é possível se você tiver outro modo de acesso):** painel do provedor que ofereça **console no navegador** (Serial Console, “Acessar console”, “VNC”, etc.). Logue por lá e rode:
  - Linux: `sudo systemctl status sshd` ou `sudo systemctl status ssh`
  - Se estiver “inactive”, ative: `sudo systemctl start sshd` e `sudo systemctl enable sshd`
- Se não tiver console no navegador, use a etapa 1 (liberar porta 22) primeiro; em muitos VPS novos o SSH já vem ativo e o bloqueio é só no firewall do provedor.

---

## 3. Porta 22 bloqueada no seu provedor de internet ou rede

Algumas redes (empresa, universidade, celular) bloqueiam saída na porta 22.

- **Teste:** use os dados do celular (4G/5G) e tente de novo `ssh root@IP_DO_VPS`. Se funcionar, a sua rede fixa está bloqueando.
- **Solução:** usar outra rede ou pedir ao administrador da rede para liberar saída TCP para a porta 22.

---

## 4. IP do VPS errado ou instância parada

- Confirme no painel (HostGator, OCI, etc.) qual é o **IP público** da instância e se a instância está **Running** (ligada).
- Se o IP mudou (ex.: parou e iniciou de novo no OCI) ou estiver digitado errado, o “connection refused” pode aparecer se houver outro serviço naquele IP. Use sempre o IP mostrado no painel.

---

## 5. SSH ouvindo em outra porta

Alguns provedores ou imagens usam outra porta (ex.: 2222).

- No painel do provedor, veja se há menção a “SSH port” ou “porta de acesso”.
- Teste:

```bash
ssh -p 2222 root@IP_DO_VPS
```

(substitua 2222 pela porta indicada).

---

## Ordem prática de verificação

1. **Liberar porta 22** no firewall/security list do provedor (HostGator ou OCI).
2. **Confirmar IP e se a instância está ligada** no painel.
3. **Testar de outra rede** (ex.: 4G) para descartar bloqueio na sua rede.
4. Se o provedor tiver **console no navegador**, conferir se o serviço SSH está ativo e em qual porta.

Depois de liberar a porta 22 no provedor, aguarde 1–2 minutos e tente novamente:

```bash
ssh root@IP_DO_VPS
```

Se ainda falhar, diga qual é o provedor do VPS (HostGator, OCI, outro) e qual mensagem de erro aparece agora (ex.: “Connection timed out” é diferente de “Connection refused” e indica outro tipo de bloqueio).

---

## Erro: "sudo: unable to resolve host ... Name or service not known"

Isso **não é erro do comando** que você rodou (ex.: `nginx`). O **sudo** tenta resolver o hostname da máquina (ex.: `vps-15025313.xxx.domain-placeholder.temp`) e não acha esse nome em `/etc/hosts` nem no DNS, então falha.

### O que fazer

1. **Ver o hostname atual:**
   ```bash
   hostname
   ```
   Anote o nome que aparecer (ex.: `vps-15025313.eltonalves1771778893088.domain-placeholder.temp`).

2. **Editar `/etc/hosts`** (precisa de root; use `su` se não tiver sudo funcionando, ou faça login como root):
   ```bash
   nano /etc/hosts
   ```
   Ou, se tiver sudo: `sudo nano /etc/hosts` (se der o mesmo erro, use `su -` para virar root e depois `nano /etc/hosts`).

3. **Garantir que a primeira linha tenha `127.0.0.1` e o hostname.** Exemplo:
   ```
   127.0.0.1   localhost
   127.0.1.1   vps-15025313.eltonalves1771778893088.domain-placeholder.temp
   ```
   Ou, se quiser um nome curto, use o hostname que apareceu no `hostname`:
   ```
   127.0.0.1   localhost
   127.0.1.1   vps-15025313.eltonalves1771778893088.domain-placeholder.temp
   ```
   (Use o **mesmo** nome que `hostname` retorna; senão o erro continua.)

4. Salvar (no nano: Ctrl+O, Enter, Ctrl+X).

5. Testar de novo:
   ```bash
   sudo systemctl start nginx
   ```

Se você **não conseguir usar sudo** por causa desse erro, entre como **root** (`su -` com a senha de root, ou SSH como root) e edite `/etc/hosts` direto; depois o sudo volta a funcionar.

---

## GitHub: login com Google — como clonar no VPS (Ubuntu)

Se você entra no GitHub **com a conta do Google**, não existe “senha do GitHub” para usar no terminal. O Git no VPS precisa de outra forma de autenticação. Duas opções:

### Opção A: Token de acesso pessoal (PAT) — mais rápido

1. No seu **PC**, abra o navegador, entre no GitHub (pode ser pelo Google).
2. GitHub → canto superior direito (foto) → **Settings**.
3. No menu da esquerda, no final: **Developer settings**.
4. **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**.
5. Dê um nome (ex.: `VPS deploy`), marque o escopo **repo** (acesso a repositórios privados). Gere o token.
6. **Copie o token** e guarde em lugar seguro (ele não aparece de novo).

No **VPS**, ao clonar por HTTPS:

```bash
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
```

Quando pedir:
- **Username:** seu usuário do GitHub (ex.: `eltonalves`).
- **Password:** **cole o token** (não a senha do Google).

Para não digitar toda vez, pode gravar a credencial (no VPS):

```bash
git config --global credential.helper store
```

Na próxima vez que o Git pedir usuário/senha, use o token como senha; depois disso ele fica salvo (em texto no home do usuário — só use em VPS que você controla).

---

### Opção B: Chave SSH — sem senha depois de configurar

1. **No VPS**, gere uma chave SSH (se ainda não tiver):

   ```bash
   ssh-keygen -t ed25519 -C "vps-deploy" -f ~/.ssh/id_ed25519_github -N ""
   ```

2. Mostre a **chave pública**:

   ```bash
   cat ~/.ssh/id_ed25519_github.pub
   ```

   Copie toda a linha (começa com `ssh-ed25519`).

3. No **PC**, no navegador: GitHub → **Settings** → **SSH and GPG keys** → **New SSH key**. Cole a chave, dê um nome (ex.: `VPS`) e salve.

4. **No VPS**, use a chave para o GitHub:

   ```bash
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id_ed25519_github
   ```

   Crie ou edite `~/.ssh/config`:

   ```bash
   nano ~/.ssh/config
   ```

   Conteúdo:

   ```
   Host github.com
     HostName github.com
     User git
     IdentityFile ~/.ssh/id_ed25519_github
   ```

   Salve (Ctrl+O, Enter, Ctrl+X).

5. Clone pelo **endereço SSH** (não HTTPS):

   ```bash
   git clone git@github.com:SEU_USUARIO/SEU_REPOSITORIO.git
   ```

   Na primeira vez pode pedir para confirmar o host (digite `yes`). Depois disso não pede mais senha.

---

**Resumo:** com login Google no GitHub você não tem senha para o Git. Use **token (PAT)** como “senha” no clone HTTPS, ou configure **chave SSH** e clone com `git@github.com:...`.
