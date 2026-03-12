/**
 * Demo Seed: inicializa data/demo/*.json com dados de exemplo se não existirem.
 * Executado automaticamente ao iniciar o servidor em DEMO_MODE=true.
 *
 * Senha de todos os usuários: 123456
 * Tenant demo: slug="demo", DEMO_TENANT_ID
 */
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { ensureDataDir, dataPath } from "./json-store";
import type { Tenant, User, Task, Lookup, Rule } from "./repository";

const DEMO_TENANT_ID = "00000000-0000-4000-8000-000000000002";
const SYSTEM_TENANT_ID = "00000000-0000-0000-0000-000000000001";

const DEMO_USERS = [
  { email: "admin@demo.com", nome: "Administrador Demo", role: "ADMIN" as const, area: "TI" },
  { email: "lider.ti@demo.com", nome: "Carlos Silva", role: "LEADER" as const, area: "TI" },
  { email: "lider.financeiro@demo.com", nome: "Fernanda Santos", role: "LEADER" as const, area: "Financeiro" },
  { email: "ana.costa@demo.com", nome: "Ana Costa", role: "USER" as const, area: "TI" },
  { email: "bruno.lima@demo.com", nome: "Bruno Lima", role: "USER" as const, area: "TI" },
  { email: "eduardo.rocha@demo.com", nome: "Eduardo Rocha", role: "USER" as const, area: "Financeiro" },
  { email: "gabriela.alves@demo.com", nome: "Gabriela Alves", role: "USER" as const, area: "Financeiro" },
];

const AREAS = ["TI", "Financeiro", "RH", "Operações", "Comercial"];
const RECORRENCIAS = ["Diário", "Semanal", "Quinzenal", "Mensal", "Trimestral", "Semestral", "Anual", "Pontual"];
const TIPOS = ["Rotina", "Projeto", "Reunião", "Auditoria", "Treinamento"];

function now(): string {
  return new Date().toISOString();
}

function makeTask(
  tenantId: string,
  competencia: string,
  atividade: string,
  resp: { email: string; nome: string; area: string },
  status: string,
  recorrencia: string,
  tipo: string,
  prazo: string,
  realizado: string | null = null,
  observacoes: string | null = null,
  parentId: string | null = null
): Task {
  return {
    id: uuidv4(),
    tenant_id: tenantId,
    competencia_ym: competencia,
    recorrencia,
    tipo,
    atividade,
    responsavel_email: resp.email,
    responsavel_nome: resp.nome,
    area: resp.area,
    prazo,
    realizado,
    status,
    observacoes,
    parent_task_id: parentId,
    justification_blocked: false,
    created_at: now(),
    created_by: resp.email,
    updated_at: now(),
    updated_by: resp.email,
    deleted_at: null,
    deleted_by: null,
  };
}

export async function seedDemoIfNeeded(): Promise<void> {
  ensureDataDir();

  // Só inicializa se tenants.json não existir (primeira execução)
  if (fs.existsSync(dataPath("tenants.json"))) {
    return;
  }

  console.log("[demo] Inicializando dados de exemplo em data/demo/...");

  const createdAt = now();
  const passwordHash = await bcrypt.hash("123456", 10);

  // ── Tenants ──────────────────────────────────────────────────────────────
  const tenants: Tenant[] = [
    { id: SYSTEM_TENANT_ID, slug: "system", name: "Sistema", active: true, created_at: createdAt },
    { id: DEMO_TENANT_ID, slug: "demo", name: "Empresa Demo", active: true, created_at: createdAt },
  ];
  fs.writeFileSync(dataPath("tenants.json"), JSON.stringify(tenants, null, 2));

  // ── Users ─────────────────────────────────────────────────────────────────
  const usersData: User[] = DEMO_USERS.map((u) => ({
    id: uuidv4(),
    tenant_id: DEMO_TENANT_ID,
    email: u.email,
    nome: u.nome,
    role: u.role,
    area: u.area,
    active: true,
    can_delete: true,
    password_hash: passwordHash,
    must_change_password: false,
    created_at: createdAt,
    last_login_at: null,
  }));
  // System admin
  usersData.push({
    id: uuidv4(),
    tenant_id: SYSTEM_TENANT_ID,
    email: "admin@sistema.local",
    nome: "Admin Sistema",
    role: "ADMIN",
    area: "",
    active: true,
    can_delete: false,
    password_hash: passwordHash,
    must_change_password: false,
    created_at: createdAt,
    last_login_at: null,
  });
  fs.writeFileSync(dataPath("users.json"), JSON.stringify(usersData, null, 2));

  // ── Lookups ───────────────────────────────────────────────────────────────
  const lookupsData: Lookup[] = [];
  let order = 0;
  for (const area of AREAS) {
    lookupsData.push({ id: uuidv4(), tenant_id: DEMO_TENANT_ID, category: "AREA", value: area, order_index: order++, created_at: createdAt });
  }
  for (const rec of RECORRENCIAS) {
    lookupsData.push({ id: uuidv4(), tenant_id: DEMO_TENANT_ID, category: "RECORRENCIA", value: rec, order_index: order++, created_at: createdAt });
  }
  for (const tipo of TIPOS) {
    lookupsData.push({ id: uuidv4(), tenant_id: DEMO_TENANT_ID, category: "TIPO", value: tipo, order_index: order++, created_at: createdAt });
  }
  fs.writeFileSync(dataPath("lookups.json"), JSON.stringify(lookupsData, null, 2));

  // ── Rules ─────────────────────────────────────────────────────────────────
  const rulesData: Rule[] = AREAS.map((area) => ({
    id: uuidv4(),
    tenant_id: DEMO_TENANT_ID,
    area,
    allowed_recorrencias: [],
    custom_tipos: TIPOS,
    default_tipos: TIPOS,
    custom_recorrencias: RECORRENCIAS,
    default_recorrencias: RECORRENCIAS,
    updated_at: createdAt,
    updated_by: "seed",
  }));
  fs.writeFileSync(dataPath("rules.json"), JSON.stringify(rulesData, null, 2));

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const admin = DEMO_USERS[0];
  const liderTI = DEMO_USERS[1];
  const liderFin = DEMO_USERS[2];
  const ana = DEMO_USERS[3];
  const eduardo = DEMO_USERS[5];

  const tasksData: Task[] = [];

  // Tarefa pai com subtarefas
  const parentTask = makeTask(
    DEMO_TENANT_ID, "2026-03", "Relatório mensal de TI",
    { email: liderTI.email, nome: liderTI.nome, area: liderTI.area },
    "Em Andamento", "Mensal", "Rotina", "2026-03-31", null,
    "Relatório de infraestrutura e segurança"
  );
  tasksData.push(parentTask);

  tasksData.push(makeTask(
    DEMO_TENANT_ID, "2026-03", "Subtarefa 1: Coletar métricas",
    { email: ana.email, nome: ana.nome, area: ana.area },
    "Em Andamento", "Mensal", "Rotina", "2026-03-20", null, null, parentTask.id
  ));
  tasksData.push(makeTask(
    DEMO_TENANT_ID, "2026-03", "Subtarefa 2: Consolidar dados",
    { email: ana.email, nome: ana.nome, area: ana.area },
    "Em Andamento", "Mensal", "Rotina", "2026-03-25", null, null, parentTask.id
  ));

  // Tarefas variadas
  tasksData.push(makeTask(
    DEMO_TENANT_ID, "2026-03", "Migração para novo servidor",
    { email: liderTI.email, nome: liderTI.nome, area: liderTI.area },
    "Em Atraso", "Pontual", "Projeto", "2026-03-10", null, "Pendente aprovação de orçamento"
  ));
  tasksData.push(makeTask(
    DEMO_TENANT_ID, "2026-02", "Reunião de alinhamento semanal",
    { email: admin.email, nome: admin.nome, area: admin.area },
    "Concluído", "Semanal", "Reunião", "2026-02-28", "2026-02-27"
  ));
  tasksData.push(makeTask(
    DEMO_TENANT_ID, "2026-02", "Auditoria interna de TI",
    { email: liderTI.email, nome: liderTI.nome, area: liderTI.area },
    "Concluído em Atraso", "Trimestral", "Auditoria", "2026-02-15", "2026-02-22",
    "Concluída com atraso por falta de documentação"
  ));
  tasksData.push(makeTask(
    DEMO_TENANT_ID, "2026-03", "Fechamento financeiro mensal",
    { email: liderFin.email, nome: liderFin.nome, area: liderFin.area },
    "Em Andamento", "Mensal", "Rotina", "2026-03-31"
  ));
  tasksData.push(makeTask(
    DEMO_TENANT_ID, "2026-03", "Conferência de conciliação bancária",
    { email: eduardo.email, nome: eduardo.nome, area: eduardo.area },
    "Em Andamento", "Quinzenal", "Rotina", "2026-03-15"
  ));
  tasksData.push(makeTask(
    DEMO_TENANT_ID, "2026-03", "Treinamento de compliance",
    { email: admin.email, nome: admin.nome, area: admin.area },
    "Em Andamento", "Semestral", "Treinamento", "2026-03-28"
  ));
  tasksData.push(makeTask(
    DEMO_TENANT_ID, "2026-01", "Relatório mensal de TI",
    { email: liderTI.email, nome: liderTI.nome, area: liderTI.area },
    "Concluído", "Mensal", "Rotina", "2026-01-31", "2026-01-30"
  ));
  tasksData.push(makeTask(
    DEMO_TENANT_ID, "2026-02", "Relatório mensal de TI",
    { email: liderTI.email, nome: liderTI.nome, area: liderTI.area },
    "Concluído", "Mensal", "Rotina", "2026-02-28", "2026-02-27"
  ));
  tasksData.push(makeTask(
    DEMO_TENANT_ID, "2026-01", "Fechamento financeiro mensal",
    { email: liderFin.email, nome: liderFin.nome, area: liderFin.area },
    "Concluído", "Mensal", "Rotina", "2026-01-31", "2026-01-29"
  ));

  fs.writeFileSync(dataPath("tasks.json"), JSON.stringify(tasksData, null, 2));

  console.log(`[demo] Seed concluído: ${usersData.length} usuários, ${tasksData.length} tarefas, ${lookupsData.length} lookups`);
  console.log("[demo] Login: admin@demo.com / 123456 | tenant: demo");
}

export { DEMO_TENANT_ID };
