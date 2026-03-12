# Demo Runbook — Task Manager Portfolio

Guia completo para rodar a versão demo do Task Manager localmente.

---

## Pré-requisitos

| Requisito | Versão mínima | Verificar com |
|-----------|--------------|---------------|
| Node.js | 22.5+ (necessário para `node:sqlite` nativo) | `node --version` |
| npm | 10+ | `npm --version` |

**Não é necessário:**
- Conta Supabase
- API key de e-mail (Resend)
- Docker
- Banco de dados externo
- Qualquer serviço em nuvem

---

## Instalação rápida (primeira vez)

```bash
# 1. Instalar dependências do backend
npm install

# 2. Instalar dependências do frontend
npm run frontend:install

# 3. Configurar envs demo (copia .env.demo → .env)
npm run demo:setup
```

---

## Rodar a demo

### Opção A — Backend + Frontend juntos (recomendado)

```bash
npm run dev:demo:all
```

Abre:
- **Backend**: http://localhost:3000
- **Frontend**: http://localhost:5173

### Opção B — Separado

```bash
# Terminal 1: backend
npm run dev:demo

# Terminal 2: frontend
npm run frontend:dev
```

---

## Acesso à demo

### URL de acesso
```
http://localhost:5173/demo/login
```

O segmento `/demo` é o tenant da demo (obrigatório na URL path-based).

### Usuários disponíveis

| Email | Senha | Role | Área |
|-------|-------|------|------|
| admin@demo.com | 123456 | ADMIN | TI |
| lider.ti@demo.com | 123456 | LEADER | TI |
| lider.financeiro@demo.com | 123456 | LEADER | Financeiro |
| ana.costa@demo.com | 123456 | USER | TI |
| bruno.lima@demo.com | 123456 | USER | TI |
| eduardo.rocha@demo.com | 123456 | USER | Financeiro |
| gabriela.alves@demo.com | 123456 | USER | Financeiro |

**Sugestão de demo:** Entre como `admin@demo.com` (ADMIN) para ver todas as funcionalidades.

---

## Fluxos demonstráveis

### 1. Login e navegação
- Acesse `/demo/login`
- Entre com `admin@demo.com / 123456`
- Veja o calendário com tarefas pré-carregadas

### 2. Tarefas
- **Calendário** → `http://localhost:5173/demo/calendar` — visão mensal
- **Lista de tarefas** → `http://localhost:5173/demo/tasks` — filtros, CRUD
- Crie uma nova tarefa (botão "+")
- Edite status: Em Andamento → Concluído
- Veja tarefa pai com subtarefas ("Relatório mensal de TI")

### 3. Usuários
- `http://localhost:5173/demo/users` — lista com roles
- Crie um novo usuário (ADMIN apenas)

### 4. Configurações (Admin)
- `http://localhost:5173/demo/admin` — lookups e regras por área
- Adicione uma nova área ou tipo de tarefa

### 5. Justificativas
- Entre como líder/admin, abra uma tarefa "Em Atraso"
- Veja justificativas pré-cadastradas

### 6. Performance
- `http://localhost:5173/demo/performance` — KPIs e gráficos por área

---

## Dados da demo

Os dados ficam em `data/demo/`:

| Arquivo | Conteúdo |
|---------|----------|
| `tenants.json` | Tenants (system + demo) |
| `users.json` | 7 usuários + admin sistema |
| `tasks.json` | ~12 tarefas variadas |
| `lookups.json` | Áreas, recorrências, tipos |
| `rules.json` | Regras por área |
| `justifications.json` | Criado dinamicamente |

Os arquivos são criados automaticamente na **primeira execução** do backend demo.

---

## Reset dos dados

Para voltar ao estado inicial:

```bash
npm run demo:reset
```

Apaga os JSONs. Na próxima execução do servidor, o seed é recriado automaticamente.

---

## Limitações da demo

| Feature | Status | Observação |
|---------|--------|------------|
| Login/Logout | ✅ Funcional | |
| CRUD Tarefas | ✅ Funcional | |
| Subtarefas | ✅ Funcional | |
| Usuários | ✅ Funcional | |
| Lookups/Regras | ✅ Funcional | |
| Justificativas | ✅ Funcional | Sem upload de evidências |
| Calendário | ✅ Funcional | |
| Performance | ✅ Funcional | |
| Upload de evidências | ❌ Desabilitado | Exibiria mensagem "não disponível na demo" |
| Chat interno | ⚠️ Parcial | Interface navega mas sem mensagens reais |
| Reset de senha por e-mail | ❌ Desabilitado | Exibe mensagem explicativa |
| Feriados/sincronização | ❌ Desabilitado | Feature de produção |
| Multi-tenant | ⚠️ Simplificado | Apenas tenant "demo" por padrão |

---

## Solução de problemas

### Backend não inicia

```bash
# Verificar se o .env existe
ls .env

# Se não existir, rodar setup
npm run demo:setup
```

### Erro "JWT_SECRET não configurado"

O `.env.demo` já define `JWT_SECRET`. Verifique se o arquivo `.env` existe:
```bash
cat .env | grep JWT_SECRET
```

### Frontend mostra "Tenant não encontrado"

Verifique se está acessando com o path correto:
```
http://localhost:5173/demo/login   # ✅ correto
http://localhost:5173/login         # ❌ sem tenant
```

### Dados corrompidos

```bash
npm run demo:reset
# Reinicie o servidor
npm run dev:demo
```

---

## Build para distribuição

```bash
# Build backend
npm run build

# Build frontend
npm run frontend:build

# Iniciar em modo produção-like (sem ts-node)
npm run start:demo
```
