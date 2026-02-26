# Feriados — Plano de implementação

## 1. Análise e decisões

- **Calendário:** `CalendarPage` carrega tarefas com `tasksApi.list()`; filtra por `competenciaYm` no mês. Feriados serão carregados por intervalo `from`/`to` em paralelo.
- **Banco:** SQLite (src/db/sqlite.ts) com CREATE TABLE em try/catch; Postgres via scripts/supabase-schema.sql. Adapter usa `?` (pg converte para $1,$2).
- **Auth:** `requireAuth` + `requireRole("ADMIN")` para escrita; todos autenticados podem GET.
- **API externa:** BrasilAPI `GET https://brasilapi.com.br/api/feriados/v1/{ano}` → `[{ date, name, type }]`. Fallback: Nager.Date (BR). Sincronização só persiste no banco; calendário lê apenas do banco.

## 2. Modelagem

**Tabela `holidays`**
- `id` TEXT PK (uuid)
- `tenant_id` TEXT NOT NULL REFERENCES tenants(id)
- `date` TEXT NOT NULL (YYYY-MM-DD)
- `name` TEXT NOT NULL
- `type` TEXT NOT NULL CHECK IN ('national','state','municipal','company')
- `source` TEXT NOT NULL CHECK IN ('api','manual')
- `source_provider` TEXT (ex: 'brasilapi', 'nager')
- `source_id` TEXT (id externo se houver)
- `active` INTEGER NOT NULL DEFAULT 1
- `metadata_json` TEXT
- `created_at`, `created_by`, `updated_at`, `updated_by` TEXT
- `last_synced_at` TEXT (para origem api)

**Índices:** (tenant_id, date), (tenant_id, source, date) para upsert. Não usar UNIQUE em (tenant_id, date) porque pode haver mais de um feriado no mesmo dia (manual + nacional).

**Idempotência:** Para `source='api'` identificamos por (tenant_id, date, source, source_provider, name ou source_id). Upsert: INSERT ou UPDATE apenas onde source='api' e mesmo date/name/provider; manuais nunca sobrescritos.

## 3. Endpoints

- `GET /api/holidays?from=YYYY-MM-DD&to=YYYY-MM-DD` — todos (leitura)
- `POST /api/holidays` — criar (ADMIN), body: date, name, type (company/municipal para manual)
- `PUT /api/holidays/:id` — editar (ADMIN), apenas source=manual
- `DELETE /api/holidays/:id` — excluir (ADMIN)
- `POST /api/holidays/sync` — body: `{ year?: number }` (ADMIN), sync ano atual/próximo

## 4. Job

- Verificar a cada hora (ou usar intervalo próximo a 03:00); executar sync ano atual e ano seguinte. Env opcional `HOLIDAY_SYNC_ENABLED=true`.

## 5. Frontend

- Tipos `Holiday`, `HolidayType`, `HolidaySource`.
- `holidaysApi.list(from, to)`, `create`, `update`, `delete`, `sync`.
- CalendarPage: carregar feriados do mês (from/to = primeiro/último dia do mês) em paralelo às tasks.
- CalendarGrid: receber `holidaysByDay: Map<number, Holiday[]>` e exibir indicador (ícone ou label) no dia.
- DayPanel: listar feriados do dia; se ADMIN, botão "Feriados" e modal CRUD.
- HolidayModal: criar/editar (data, nome, tipo); apenas manuais editáveis.

---

## 6. Uso e configuração

### Sincronização manual (ADMIN)

1. Acesse o **Calendário**.
2. Clique em **Sincronizar feriados** (botão visível apenas para ADMIN).
3. Os feriados nacionais do **ano do mês exibido** são importados da BrasilAPI (ou Nager.Date em fallback) e gravados no banco do tenant atual. Não remove nem altera feriados manuais.

### Job automático

- Habilitar: defina `HOLIDAY_SYNC_ENABLED=true` (ou `1`) no ambiente.
- O job roda **uma vez por dia**, por volta das **03:00** (hora local). Sincroniza **ano atual** e **ano seguinte** para todos os tenants ativos.
- Em ambiente de **teste** (`NODE_ENV=test`) o job não é iniciado.
- Log opcional no console: `[holiday-sync] Concluído: N tenant(s), X feriado(s) inseridos/atualizados.`

### CRUD de feriados (ADMIN)

- **Criar:** no painel do dia (lateral), clique em "Adicionar feriado neste dia" ou no ícone + na seção Feriados. Preencha data, nome e tipo (Nacional, Estadual, Municipal, Empresa).
- **Editar:** apenas feriados **manuais** têm botão de edição no painel do dia.
- **Excluir:** qualquer feriado pode ser excluído pelo ADMIN (ícone de lixeira no painel do dia).

### Visualização (todos os perfis)

- No grid do calendário, dias com feriado exibem ícone de calendário (amber). O tooltip mostra o(s) nome(s) do(s) feriado(s).
- No painel do dia (ao clicar em um dia), a seção **Feriados** lista os feriados daquele dia.

### Regras importantes

- O calendário **nunca** chama a API externa em tempo real: lê apenas do banco (`GET /api/holidays?from=&to=`).
- Reexecutar a sincronização é **idempotente**: não duplica feriados da API (upsert por tenant + data + source + provider + nome).
- Feriados **manuais** não são sobrescritos nem removidos pelo sync.
