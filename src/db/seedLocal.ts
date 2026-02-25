/**
 * Seed LOCAL: limpa e repovoa SEMPRE o SQLite em data/taskmanager.db.
 *
 * Uso: npm run seed:local       → limpa tudo e insere dados completos
 *      npm run seed:local -- --clean → só limpa (e recria tenant system)
 *
 * O script npm usa scripts/force-local-db.js para garantir que o path
 * seja data/taskmanager.db (para migração Supabase ler os mesmos dados).
 *
 * Conteúdo: tenant system + demo (com evidências e justificativas) + empresa-alpha + empresa-beta.
 */
import "dotenv/config";
import path from "path";
import fs from "fs";
import db, { SYSTEM_TENANT_ID } from "./sqlite";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { seedSystemAdminIfNeeded } from "./seedSystemAdmin";
import { getDefaultTiposList } from "../constants/defaultTipos";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "taskmanager.db");
const MOCK_PASSWORD = "123456";

const DEFAULT_LOOKUPS: Record<string, string[]> = {
  AREA: ["TI", "Financeiro", "RH", "Operações", "Comercial"],
  RECORRENCIA: ["Diário", "Semanal", "Quinzenal", "Mensal", "Trimestral", "Semestral", "Anual", "Pontual"],
  TIPO: ["Rotina", "Projeto", "Reunião", "Auditoria", "Treinamento"],
};

const TASK_TEMPLATES: Array<{ atividade: string; recorrencia: string; tipo: string; status: string; observacoes: string | null }> = [
  { atividade: "Relatório periódico da área", recorrencia: "Mensal", tipo: "Rotina", status: "Em Andamento", observacoes: "Entrega até o último dia do mês" },
  { atividade: "Reunião de alinhamento semanal", recorrencia: "Semanal", tipo: "Reunião", status: "Em Andamento", observacoes: null },
  { atividade: "Auditoria interna de processos", recorrencia: "Trimestral", tipo: "Auditoria", status: "Em Andamento", observacoes: null },
  { atividade: "Projeto de melhoria contínua", recorrencia: "Pontual", tipo: "Projeto", status: "Em Andamento", observacoes: null },
  { atividade: "Treinamento da equipe", recorrencia: "Semestral", tipo: "Treinamento", status: "Concluído", observacoes: null },
  { atividade: "Conferência de indicadores", recorrencia: "Quinzenal", tipo: "Rotina", status: "Em Andamento", observacoes: null },
  { atividade: "Reunião de feedback", recorrencia: "Mensal", tipo: "Reunião", status: "Concluído", observacoes: null },
  { atividade: "Documentação de procedimentos", recorrencia: "Pontual", tipo: "Rotina", status: "Em Atraso", observacoes: "Pendente atualização" },
];

interface TenantSpec {
  slug: string;
  name: string;
  leaders: Array<{
    area: string;
    nome: string;
    email: string;
    collaborators: Array<{ nome: string; email: string }>;
  }>;
}

const TENANTS_SPEC: TenantSpec[] = [
  {
    slug: "empresa-alpha",
    name: "Empresa Alpha",
    leaders: [
      { area: "TI", nome: "Carlos Silva", email: "lider.ti@empresa-alpha.com", collaborators: [{ nome: "Ana Costa", email: "ana.costa@empresa-alpha.com" }, { nome: "Bruno Lima", email: "bruno.lima@empresa-alpha.com" }, { nome: "Carla Mendes", email: "carla.mendes@empresa-alpha.com" }, { nome: "Diego Oliveira", email: "diego.oliveira@empresa-alpha.com" }] },
      { area: "Financeiro", nome: "Fernanda Santos", email: "lider.financeiro@empresa-alpha.com", collaborators: [{ nome: "Eduardo Rocha", email: "eduardo.rocha@empresa-alpha.com" }, { nome: "Gabriela Alves", email: "gabriela.alves@empresa-alpha.com" }, { nome: "Henrique Pereira", email: "henrique.pereira@empresa-alpha.com" }] },
    ],
  },
  {
    slug: "empresa-beta",
    name: "Empresa Beta",
    leaders: [
      { area: "RH", nome: "Patricia Souza", email: "lider.rh@empresa-beta.com", collaborators: [{ nome: "Julia Ferreira", email: "julia.ferreira@empresa-beta.com" }, { nome: "Lucas Martins", email: "lucas.martins@empresa-beta.com" }, { nome: "Mariana Ribeiro", email: "mariana.ribeiro@empresa-beta.com" }, { nome: "Nicolas Carvalho", email: "nicolas.carvalho@empresa-beta.com" }] },
      { area: "Operações", nome: "Ricardo Nascimento", email: "lider.operacoes@empresa-beta.com", collaborators: [{ nome: "Otavio Dias", email: "otavio.dias@empresa-beta.com" }, { nome: "Paula Gomes", email: "paula.gomes@empresa-beta.com" }, { nome: "Rafael Teixeira", email: "rafael.teixeira@empresa-beta.com" }] },
    ],
  },
];

function isLocalAllowed(): boolean {
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--local")) {
    const resolved = path.resolve(process.cwd(), process.env.SQLITE_DB_PATH || "");
    if (resolved !== path.resolve(process.cwd(), "data", "taskmanager.db")) return false;
  }
  return true;
}

/** Ordem respeita FKs. */
function cleanAll(): void {
  if (!isLocalAllowed()) {
    console.error("❌ Limpeza total só é permitida em ambiente local (NODE_ENV !== 'production' ou use --local).");
    process.exit(1);
  }
  if (!fs.existsSync(DB_PATH)) {
    console.error("❌ Banco não encontrado em data/taskmanager.db. Abortando.");
    process.exit(1);
  }

  console.log("🧹 Limpando banco em", DB_PATH, "\n");
  db.exec("BEGIN TRANSACTION");
  try {
    db.prepare("DELETE FROM justification_evidences").run();
    db.prepare("DELETE FROM task_justifications").run();
    db.prepare("DELETE FROM task_evidences").run();
    db.prepare("DELETE FROM tasks").run();
    db.prepare("DELETE FROM rules").run();
    db.prepare("DELETE FROM lookups").run();
    db.prepare("DELETE FROM login_events").run();
    db.prepare("DELETE FROM users").run();
    db.prepare("DELETE FROM tenants").run();
    db.exec("COMMIT");
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tenants (id, slug, name, active, created_at) VALUES (?, 'system', 'Sistema', 1, ?)").run(SYSTEM_TENANT_ID, now);
    console.log("   Tabelas esvaziadas. Tenant 'system' recriado.\n✅ Limpeza concluída.");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function insertLookups(tenantId: string, now: string): void {
  let order = 0;
  for (const [category, values] of Object.entries(DEFAULT_LOOKUPS)) {
    for (const value of values) {
      db.prepare("INSERT INTO lookups (id, tenant_id, category, value, order_index, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(uuidv4(), tenantId, category, value, order++, now);
    }
  }
}

function insertRulesForArea(tenantId: string, area: string, now: string): void {
  const defaultTiposJson = JSON.stringify(getDefaultTiposList());
  const customRecorrenciasJson = JSON.stringify(DEFAULT_LOOKUPS.RECORRENCIA);
  db.prepare(
    "INSERT INTO rules (id, tenant_id, area, allowed_recorrencias, allowed_tipos, custom_tipos, default_tipos, custom_recorrencias, default_recorrencias, updated_at, updated_by) VALUES (?, ?, ?, '[]', NULL, ?, ?, ?, ?, ?, ?)"
  ).run(uuidv4(), tenantId, area, defaultTiposJson, defaultTiposJson, customRecorrenciasJson, customRecorrenciasJson, now, "seed");
}

function insertRulesForSpec(tenantId: string, spec: TenantSpec, now: string): void {
  const areas = [...new Set(spec.leaders.map(l => l.area))];
  const defaultTiposJson = JSON.stringify(getDefaultTiposList());
  const customRecorrenciasJson = JSON.stringify(DEFAULT_LOOKUPS.RECORRENCIA);
  for (const area of areas) {
    db.prepare(
      "INSERT INTO rules (id, tenant_id, area, allowed_recorrencias, allowed_tipos, custom_tipos, default_tipos, custom_recorrencias, default_recorrencias, updated_at, updated_by) VALUES (?, ?, ?, '[]', NULL, ?, ?, ?, ?, ?, ?)"
    ).run(uuidv4(), tenantId, area, defaultTiposJson, defaultTiposJson, customRecorrenciasJson, customRecorrenciasJson, now, "seed");
  }
}

function getAllPeopleFromSpec(spec: TenantSpec): Array<{ email: string; nome: string; area: string }> {
  const people: Array<{ email: string; nome: string; area: string }> = [];
  for (const leader of spec.leaders) {
    people.push({ email: leader.email, nome: leader.nome, area: leader.area });
    for (const col of leader.collaborators) {
      people.push({ email: col.email, nome: col.nome, area: leader.area });
    }
  }
  return people;
}

function insertTasksForTenant(tenantId: string, spec: TenantSpec, now: string): number {
  const people = getAllPeopleFromSpec(spec);
  const competenciaMonths = ["2026-01", "2026-02", "2026-03"];
  let inserted = 0;
  const insertTask = db.prepare(`
    INSERT INTO tasks (id, tenant_id, competencia_ym, recorrencia, tipo, atividade,
      responsavel_email, responsavel_nome, area, prazo, realizado, status, observacoes,
      created_at, created_by, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (let i = 0; i < people.length; i++) {
    const person = people[i];
    const numTasks = 2 + (i % 3);
    for (let t = 0; t < numTasks; t++) {
      const tmpl = TASK_TEMPLATES[(i + t) % TASK_TEMPLATES.length];
      const ym = competenciaMonths[t % competenciaMonths.length];
      const prazo = ym + (tmpl.status === "Concluído" ? "-15" : "-28");
      const realizado = tmpl.status === "Concluído" ? ym + "-14" : null;
      insertTask.run(
        uuidv4(), tenantId, ym, tmpl.recorrencia, tmpl.tipo, tmpl.atividade,
        person.email, person.nome, person.area, prazo, realizado, tmpl.status, tmpl.observacoes,
        now, person.email, now, person.email
      );
      inserted++;
    }
  }
  return inserted;
}

/** Insere tenant demo com tarefas, evidências, justificativas e login_events em uma transação. */
async function seedDemo(passwordHash: string, now: string): Promise<void> {
  const demoTenantId = uuidv4();
  const adminId = uuidv4();

  db.exec("BEGIN TRANSACTION");
  try {
    db.prepare("INSERT INTO tenants (id, slug, name, active, created_at) VALUES (?, 'demo', 'Empresa Demo', 1, ?)")
      .run(demoTenantId, now);
    db.prepare(`
      INSERT INTO users (id, tenant_id, email, nome, role, area, active, can_delete, password_hash, must_change_password, created_at)
      VALUES (?, ?, ?, ?, 'ADMIN', 'TI', 1, 1, ?, 0, ?)
    `).run(adminId, demoTenantId, "admin@demo.com", "Administrador", passwordHash, now);
    insertLookups(demoTenantId, now);
    insertRulesForArea(demoTenantId, "TI", now);

    const sampleTasks = [
      { competenciaYm: "2026-02", recorrencia: "Mensal", tipo: "Rotina", atividade: "Relatório mensal de TI", prazo: "2026-02-28", realizado: null, status: "Em Andamento", observacoes: "Relatório de infraestrutura" },
      { competenciaYm: "2026-02", recorrencia: "Pontual", tipo: "Projeto", atividade: "Migração para novo servidor", prazo: "2026-02-15", realizado: null, status: "Em Atraso", observacoes: null },
      { competenciaYm: "2026-01", recorrencia: "Mensal", tipo: "Reunião", atividade: "Reunião de alinhamento", prazo: "2026-01-31", realizado: "2026-01-30", status: "Concluído", observacoes: null },
      { competenciaYm: "2026-01", recorrencia: "Mensal", tipo: "Rotina", atividade: "Entrega em atraso (justificativa)", prazo: "2026-01-10", realizado: "2026-01-18", status: "Concluído em Atraso", observacoes: "Justificativa cadastrada" },
    ];

    let parentTaskId: string | null = null;
    let concluidoEmAtrasoTaskId: string | null = null;
    for (let i = 0; i < sampleTasks.length; i++) {
      const t = sampleTasks[i];
      const taskId = uuidv4();
      if (i === 0) parentTaskId = taskId;
      if (t.status === "Concluído em Atraso") concluidoEmAtrasoTaskId = taskId;
      db.prepare(`
        INSERT INTO tasks (id, tenant_id, competencia_ym, recorrencia, tipo, atividade,
          responsavel_email, responsavel_nome, area, prazo, realizado, status, observacoes,
          created_at, created_by, updated_at, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, 'admin@demo.com', 'Administrador', 'TI', ?, ?, ?, ?, ?, 'admin@demo.com', ?, 'admin@demo.com')
      `).run(taskId, demoTenantId, t.competenciaYm, t.recorrencia, t.tipo, t.atividade, t.prazo, t.realizado, t.status, t.observacoes, now, now);
    }

    // Justificativas (tarefa "Concluído em Atraso")
    const justifIds: string[] = [];
    if (concluidoEmAtrasoTaskId) {
      const j1 = uuidv4(), j2 = uuidv4(), j3 = uuidv4();
      justifIds.push(j1, j2, j3);
      db.prepare(`
        INSERT INTO task_justifications (id, tenant_id, task_id, description, status, created_at, created_by, reviewed_at, reviewed_by, review_comment)
        VALUES (?, ?, ?, ?, 'pending', ?, 'admin@demo.com', NULL, NULL, NULL)
      `).run(j1, demoTenantId, concluidoEmAtrasoTaskId, "Impedimento de fornecedor atrasou a entrega.", now);
      db.prepare(`
        INSERT INTO task_justifications (id, tenant_id, task_id, description, status, created_at, created_by, reviewed_at, reviewed_by, review_comment)
        VALUES (?, ?, ?, ?, 'approved', ?, 'admin@demo.com', ?, 'admin@demo.com', 'Aprovado.')
      `).run(j2, demoTenantId, concluidoEmAtrasoTaskId, "Segunda justificativa aprovada.", now, now);
      db.prepare(`
        INSERT INTO task_justifications (id, tenant_id, task_id, description, status, created_at, created_by, reviewed_at, reviewed_by, review_comment)
        VALUES (?, ?, ?, ?, 'refused', ?, 'admin@demo.com', ?, 'admin@demo.com', 'Documentação insuficiente.')
      `).run(j3, demoTenantId, concluidoEmAtrasoTaskId, "Terceira justificativa recusada.", now, now);

      for (let ji = 0; ji < justifIds.length; ji++) {
        db.prepare(`
          INSERT INTO justification_evidences (id, tenant_id, justification_id, file_name, file_path, mime_type, file_size, uploaded_at, uploaded_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          uuidv4(), demoTenantId, justifIds[ji],
          ji === 0 ? "comprovante-atraso.pdf" : ji === 1 ? "anexo-aprovacao.pdf" : "doc-recusado.pdf",
          `evidences/justifications/${justifIds[ji]}/doc-${ji + 1}.pdf`,
          "application/pdf", 15000 + ji * 1000, now, "admin@demo.com"
        );
      }
    }

    // Subtarefas (primeira tarefa como pai)
    if (parentTaskId) {
      const sub1 = uuidv4(), sub2 = uuidv4();
      db.prepare(`
        INSERT INTO tasks (id, tenant_id, competencia_ym, recorrencia, tipo, atividade,
          responsavel_email, responsavel_nome, area, prazo, realizado, status, observacoes,
          created_at, created_by, updated_at, updated_by, parent_task_id)
        VALUES (?, ?, '2026-02', 'Mensal', 'Rotina', 'Subtarefa 1: Coletar dados', 'admin@demo.com', 'Administrador', 'TI', '2026-02-20', NULL, 'Em Andamento', NULL, ?, 'admin@demo.com', ?, 'admin@demo.com', ?)
      `).run(sub1, demoTenantId, now, now, parentTaskId);
      db.prepare(`
        INSERT INTO tasks (id, tenant_id, competencia_ym, recorrencia, tipo, atividade,
          responsavel_email, responsavel_nome, area, prazo, realizado, status, observacoes,
          created_at, created_by, updated_at, updated_by, parent_task_id)
        VALUES (?, ?, '2026-02', 'Mensal', 'Rotina', 'Subtarefa 2: Consolidar relatório', 'admin@demo.com', 'Administrador', 'TI', '2026-02-25', NULL, 'Em Andamento', NULL, ?, 'admin@demo.com', ?, 'admin@demo.com', ?)
      `).run(sub2, demoTenantId, now, now, parentTaskId);

      db.prepare(`
        INSERT INTO task_evidences (id, tenant_id, task_id, file_name, file_path, mime_type, file_size, uploaded_at, uploaded_by)
        VALUES (?, ?, ?, 'relatorio-parcial.pdf', ?, 'application/pdf', 45000, ?, 'admin@demo.com')
      `).run(uuidv4(), demoTenantId, parentTaskId, `evidences/tasks/${parentTaskId}/relatorio-parcial.pdf`, now);
      db.prepare(`
        INSERT INTO task_evidences (id, tenant_id, task_id, file_name, file_path, mime_type, file_size, uploaded_at, uploaded_by)
        VALUES (?, ?, ?, 'anexo-dados.xlsx', ?, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 12000, ?, 'admin@demo.com')
      `).run(uuidv4(), demoTenantId, parentTaskId, `evidences/tasks/${parentTaskId}/anexo-dados.xlsx`, now);
    }
    if (concluidoEmAtrasoTaskId) {
      db.prepare(`
        INSERT INTO task_evidences (id, tenant_id, task_id, file_name, file_path, mime_type, file_size, uploaded_at, uploaded_by)
        VALUES (?, ?, ?, 'comprovante-entrega-atraso.pdf', ?, 'application/pdf', 28000, ?, 'admin@demo.com')
      `).run(uuidv4(), demoTenantId, concluidoEmAtrasoTaskId, `evidences/tasks/${concluidoEmAtrasoTaskId}/comprovante-entrega-atraso.pdf`, now);
    }

    const loginPast = new Date(Date.now() - 86400 * 2).toISOString();
    db.prepare("INSERT INTO login_events (id, tenant_id, user_id, logged_at) VALUES (?, ?, ?, ?)").run(uuidv4(), demoTenantId, adminId, loginPast);
    db.prepare("INSERT INTO login_events (id, tenant_id, user_id, logged_at) VALUES (?, ?, ?, ?)").run(uuidv4(), demoTenantId, adminId, now);

    db.exec("COMMIT");
    console.log("✅ Demo: admin@demo.com (tarefas, task_evidences, task_justifications, justification_evidences, subtarefas, login_events)");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/** Insere empresa-alpha e empresa-beta. */
async function seedEmpresas(passwordHash: string, now: string): Promise<void> {
  for (const spec of TENANTS_SPEC) {
    const tenantId = uuidv4();
    db.exec("BEGIN TRANSACTION");
    try {
      db.prepare("INSERT INTO tenants (id, slug, name, active, created_at) VALUES (?, ?, ?, 1, ?)")
        .run(tenantId, spec.slug, spec.name, now);
      insertLookups(tenantId, now);
      insertRulesForSpec(tenantId, spec, now);
      let firstLeaderId: string | null = null;
      for (const leader of spec.leaders) {
        const leaderId = uuidv4();
        if (!firstLeaderId) firstLeaderId = leaderId;
        db.prepare(`
          INSERT INTO users (id, tenant_id, email, nome, role, area, active, can_delete, password_hash, must_change_password, created_at)
          VALUES (?, ?, ?, ?, 'LEADER', ?, 1, 1, ?, 0, ?)
        `).run(leaderId, tenantId, leader.email, leader.nome, leader.area, passwordHash, now);
        for (const col of leader.collaborators) {
          db.prepare(`
            INSERT INTO users (id, tenant_id, email, nome, role, area, active, can_delete, password_hash, must_change_password, created_at)
            VALUES (?, ?, ?, ?, 'USER', ?, 1, 1, ?, 0, ?)
          `).run(uuidv4(), tenantId, col.email, col.nome, leader.area, passwordHash, now);
        }
      }
      const n = insertTasksForTenant(tenantId, spec, now);
      if (firstLeaderId) {
        const loginPast = new Date(Date.now() - 86400 * 5).toISOString();
        db.prepare("INSERT INTO login_events (id, tenant_id, user_id, logged_at) VALUES (?, ?, ?, ?)").run(uuidv4(), tenantId, firstLeaderId, loginPast);
        db.prepare("INSERT INTO login_events (id, tenant_id, user_id, logged_at) VALUES (?, ?, ?, ?)").run(uuidv4(), tenantId, firstLeaderId, now);
      }
      db.exec("COMMIT");
      console.log("✅ " + spec.name + " (" + spec.slug + "): " + n + " tarefas");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}

function logVerification(): void {
  const ev = Number((db.prepare("SELECT COUNT(*) as c FROM task_evidences").get() as { c: unknown }).c);
  const j = Number((db.prepare("SELECT COUNT(*) as c FROM task_justifications").get() as { c: unknown }).c);
  const je = Number((db.prepare("SELECT COUNT(*) as c FROM justification_evidences").get() as { c: unknown }).c);
  console.log("\n📊 Verificação no SQLite:");
  console.log("   task_evidences: " + ev + " | task_justifications: " + j + " | justification_evidences: " + je);
  if (ev === 0 || j === 0 || je === 0) {
    console.log("   ⚠️  Se algum valor for 0, a migração Supabase não terá esses dados. Confira erros acima.");
  }
}

async function main(): Promise<void> {
  const cleanOnly = process.argv.includes("--clean");
  if (cleanOnly) {
    cleanAll();
    return;
  }
  cleanAll();
  console.log("\n🌱 Inserindo dados...\n");
  const passwordHash = await bcrypt.hash(MOCK_PASSWORD, 12);
  const now = new Date().toISOString();

  await seedDemo(passwordHash, now);
  await seedEmpresas(passwordHash, now);
  await seedSystemAdminIfNeeded();

  logVerification();
  console.log("\n🎉 Seed local concluído! Banco: " + DB_PATH);
  console.log("\n📋 Para migrar para o Supabase: npm run migrate:supabase");
  console.log("   Acesso demo: ?tenant=demo → admin@demo.com (senha definida no seed)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(() => process.exit(0));
