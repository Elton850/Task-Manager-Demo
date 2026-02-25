/**
 * Seed mínima: cria apenas tenant demo + admin + lookups + 3 tarefas.
 * Se o tenant demo já existir, pula. Usa o DB definido em DB_PROVIDER (.env).
 *
 * Para dados completos (evidências, justificativas, múltiplos tenants) use:
 *   npm run seed:local
 * Depois, para migrar para o Supabase: npm run migrate:supabase
 */
import "dotenv/config";
import db from "./index";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

const DEMO_TENANT_SLUG = "demo";
const DEMO_TENANT_NAME = "Empresa Demo";
const ADMIN_EMAIL = "admin@demo.com";
const ADMIN_PASSWORD = "123456";

const DEFAULT_LOOKUPS: Record<string, string[]> = {
  AREA: ["TI", "Financeiro", "RH", "Operações", "Comercial"],
  RECORRENCIA: ["Diário", "Semanal", "Quinzenal", "Mensal", "Trimestral", "Semestral", "Anual", "Pontual"],
  TIPO: ["Rotina", "Projeto", "Reunião", "Auditoria", "Treinamento"],
};

async function seed() {
  console.log("🌱 Iniciando seed do banco de dados...");

  const existingTenant = db.prepare("SELECT id FROM tenants WHERE slug = ?")
    .get(DEMO_TENANT_SLUG) as { id: string } | undefined;

  if (existingTenant) {
    console.log("✅ Banco de dados já inicializado. Pulando seed.");
    return;
  }

  const tenantId = uuidv4();
  const adminId = uuidv4();
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const now = new Date().toISOString();

  // node:sqlite uses manual BEGIN/COMMIT instead of .transaction()
  db.exec("BEGIN TRANSACTION");
  try {
    db.prepare("INSERT INTO tenants (id, slug, name, active, created_at) VALUES (?, ?, ?, 1, ?)")
      .run(tenantId, DEMO_TENANT_SLUG, DEMO_TENANT_NAME, now);
    console.log(`✅ Tenant: ${DEMO_TENANT_NAME} (${DEMO_TENANT_SLUG})`);

    db.prepare(`
      INSERT INTO users (id, tenant_id, email, nome, role, area, active, can_delete, password_hash, must_change_password, created_at)
      VALUES (?, ?, ?, ?, 'ADMIN', 'TI', 1, 1, ?, 0, ?)
    `).run(adminId, tenantId, ADMIN_EMAIL, "Administrador", passwordHash, now);
    console.log(`✅ Admin: ${ADMIN_EMAIL} (defina a senha no primeiro acesso ou via .env)`);

    let lookupOrder = 0;
    for (const [category, values] of Object.entries(DEFAULT_LOOKUPS)) {
      for (const value of values) {
        db.prepare("INSERT OR IGNORE INTO lookups (id, tenant_id, category, value, order_index, created_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(uuidv4(), tenantId, category, value, lookupOrder++, now);
      }
      console.log(`✅ Lookups: ${category} (${values.length} itens)`);
    }

    const sampleTasks = [
      {
        id: uuidv4(), competenciaYm: "2026-02", recorrencia: "Mensal", tipo: "Rotina",
        atividade: "Relatório mensal de TI", prazo: "2026-02-28", realizado: null, status: "Em Andamento",
        observacoes: "Relatório de infraestrutura e sistemas",
      },
      {
        id: uuidv4(), competenciaYm: "2026-02", recorrencia: "Pontual", tipo: "Projeto",
        atividade: "Migração para novo servidor", prazo: "2026-02-15", realizado: null, status: "Em Atraso",
        observacoes: "Migração urgente de dados",
      },
      {
        id: uuidv4(), competenciaYm: "2026-01", recorrencia: "Mensal", tipo: "Reunião",
        atividade: "Reunião de alinhamento estratégico", prazo: "2026-01-31", realizado: "2026-01-30", status: "Concluído",
        observacoes: "Reunião mensal com diretoria",
      },
    ];

    for (const task of sampleTasks) {
      db.prepare(`
        INSERT INTO tasks (id, tenant_id, competencia_ym, recorrencia, tipo, atividade,
          responsavel_email, responsavel_nome, area, prazo, realizado, status, observacoes,
          created_at, created_by, updated_at, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        task.id, tenantId, task.competenciaYm, task.recorrencia, task.tipo,
        task.atividade, ADMIN_EMAIL, "Administrador", "TI",
        task.prazo, task.realizado, task.status, task.observacoes,
        now, ADMIN_EMAIL, now, ADMIN_EMAIL
      );
    }
    console.log(`✅ ${sampleTasks.length} tarefas de exemplo`);

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  console.log("\n🎉 Seed concluído!");
  console.log(`\n📋 Acesso: http://localhost:3000?tenant=${DEMO_TENANT_SLUG}`);
  console.log(`   Email: ${ADMIN_EMAIL} — altere a senha após o primeiro login.`);
}

seed().catch(console.error).finally(() => process.exit());
