/**
 * Testes de segurança: isolamento multi-tenant, autenticação, autorização,
 * CSRF, CORS, proteção contra IDOR e bypass.
 *
 * Requer tenant "demo" no banco (criado automaticamente no setup se não existir),
 * para que rotas com X-Tenant-Slug: demo atinjam auth/CSRF em vez de 404.
 */
import request from "supertest";
import { v4 as uuidv4 } from "uuid";
import app from "../src/server";
import db from "../src/db";
import { signToken } from "../src/middleware/auth";

const DEMO_SLUG = "demo";

/** Garante que o tenant "demo" existe (cria se não existir). Funciona com SQLite e PostgreSQL. */
async function ensureDemoTenant(): Promise<void> {
  const row = await Promise.resolve(
    db.prepare("SELECT id FROM tenants WHERE slug = ?").get(DEMO_SLUG)
  ) as { id: string } | undefined;
  if (row) return;
  const id = uuidv4();
  const now = new Date().toISOString();
  await Promise.resolve(
    db.prepare("INSERT INTO tenants (id, slug, name, active, created_at) VALUES (?, ?, ?, 1, ?)").run(id, DEMO_SLUG, "Empresa Demo", now)
  );
}

function getCsrfCookieAndToken(): Promise<{ cookie: string; token: string }> {
  return request(app)
    .get("/api/csrf")
    .set("Host", "localhost")
    .set("X-Tenant-Slug", DEMO_SLUG)
    .then((res) => {
      const setCookie = res.headers["set-cookie"];
      const cookie = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie || "";
      const token = (res.body && res.body.csrfToken) || "";
      return { cookie, token };
    });
}

function authHeaders(cookie: string, csrfToken: string, tenantSlug: string = DEMO_SLUG) {
  return {
    Cookie: cookie,
    "X-CSRF-Token": csrfToken,
    "X-Tenant-Slug": tenantSlug,
    "Content-Type": "application/json",
  };
}

describe("Segurança - Endpoints públicos", () => {
  it("GET /api/health retorna 200 sem tenant", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /api/csrf exige tenant", async () => {
    const res = await request(app).get("/api/csrf").set("Host", "evil.com");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("NO_TENANT");
  });

  it("GET /api/csrf retorna token com tenant válido", async () => {
    const res = await request(app)
      .get("/api/csrf")
      .set("Host", "localhost")
      .set("X-Tenant-Slug", DEMO_SLUG);
    expect(res.status).toBe(200);
    expect(res.body.csrfToken).toBeDefined();
    expect(typeof res.body.csrfToken).toBe("string");
  });
});

describe("Segurança - Autenticação obrigatória", () => {
  beforeAll(async () => {
    await ensureDemoTenant();
  });

  it("GET /api/tasks sem auth retorna 401", async () => {
    const { cookie, token } = await getCsrfCookieAndToken();
    const res = await request(app)
      .get("/api/tasks")
      .set("Host", "localhost")
      .set("X-Tenant-Slug", DEMO_SLUG)
      .set("Cookie", cookie)
      .set("X-CSRF-Token", token);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  it("GET /api/users sem auth retorna 401", async () => {
    const { cookie, token } = await getCsrfCookieAndToken();
    const res = await request(app)
      .get("/api/users")
      .set("Host", "localhost")
      .set("X-Tenant-Slug", DEMO_SLUG)
      .set("Cookie", cookie)
      .set("X-CSRF-Token", token);
    expect(res.status).toBe(401);
  });

  it("POST /api/tasks sem auth retorna 401", async () => {
    const { cookie, token } = await getCsrfCookieAndToken();
    const res = await request(app)
      .post("/api/tasks")
      .set("Host", "localhost")
      .set("X-Tenant-Slug", DEMO_SLUG)
      .set("Cookie", cookie)
      .set("X-CSRF-Token", token)
      .send({ atividade: "x", competenciaYm: "2026-01", recorrencia: "Mensal", tipo: "Rotina" });
    expect(res.status).toBe(401);
  });
});

describe("Segurança - CSRF", () => {
  beforeAll(async () => {
    await ensureDemoTenant();
  });

  it("POST mutação sem token CSRF retorna 403", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Host", "localhost")
      .set("X-Tenant-Slug", DEMO_SLUG)
      .set("Content-Type", "application/json");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CSRF_INVALID");
  });

  it("POST com header CSRF mas sem cookie retorna 403", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Host", "localhost")
      .set("X-Tenant-Slug", DEMO_SLUG)
      .set("X-CSRF-Token", "some-token")
      .set("Content-Type", "application/json");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CSRF_INVALID");
  });
});

describe("Segurança - Tenant obrigatório", () => {
  it("GET /api/tasks sem tenant (Host inválido) retorna 400", async () => {
    const res = await request(app)
      .get("/api/tasks")
      .set("Host", "evil.com");
    expect([400, 404]).toContain(res.status);
    if (res.status === 400) expect(res.body.code).toBe("NO_TENANT");
  });
});

describe("Segurança - Tenant isolation (IDOR)", () => {
  let demoTenantId: string;
  let otherTenantId: string;
  let taskIdOther: string;
  let authCookie: string;
  let csrfTokenVal: string;
  let demoToken: string;

  beforeAll(async () => {
    await ensureDemoTenant();
    const demo = await Promise.resolve(
      db.prepare("SELECT id FROM tenants WHERE slug = ?").get(DEMO_SLUG)
    ) as { id: string } | undefined;
    if (!demo) throw new Error("Tenant demo não encontrado. Rode o seed.");
    demoTenantId = demo.id;

    let other = await Promise.resolve(
      db.prepare("SELECT id FROM tenants WHERE slug = ?").get("other")
    ) as { id: string } | undefined;
    if (!other) {
      otherTenantId = uuidv4();
      const now = new Date().toISOString();
      await Promise.resolve(
        db.prepare("INSERT INTO tenants (id, slug, name, active, created_at) VALUES (?, ?, ?, 1, ?)").run(otherTenantId, "other", "Other Tenant", now)
      );
      const taskId = uuidv4();
      const adminEmail = "admin@demo.com";
      await Promise.resolve(
        db.prepare(`
          INSERT INTO tasks (id, tenant_id, competencia_ym, recorrencia, tipo, atividade,
            responsavel_email, responsavel_nome, area, created_at, created_by, updated_at, updated_by)
          VALUES (?, ?, ?, 'Mensal', 'Rotina', 'Task outro tenant', ?, 'Admin', 'TI', ?, ?, ?, ?)
        `).run(taskId, otherTenantId, "2024-01", adminEmail, now, adminEmail, now, adminEmail)
      );
      taskIdOther = taskId;
    } else {
      otherTenantId = other.id;
      let row = await Promise.resolve(
        db.prepare("SELECT id FROM tasks WHERE tenant_id = ? LIMIT 1").get(otherTenantId)
      ) as { id: string } | undefined;
      if (!row) {
        const taskId = uuidv4();
        const adminEmail = "admin@demo.com";
        const now = new Date().toISOString();
        await Promise.resolve(
          db.prepare(`
            INSERT INTO tasks (id, tenant_id, competencia_ym, recorrencia, tipo, atividade,
              responsavel_email, responsavel_nome, area, created_at, created_by, updated_at, updated_by)
            VALUES (?, ?, ?, 'Mensal', 'Rotina', 'Task outro tenant', ?, 'Admin', 'TI', ?, ?, ?, ?)
          `).run(taskId, otherTenantId, "2024-01", adminEmail, now, adminEmail, now, adminEmail)
        );
        taskIdOther = taskId;
      } else {
        taskIdOther = row.id;
      }
    }

    demoToken = signToken({
      id: "user-demo",
      email: "admin@demo.com",
      nome: "Admin",
      role: "ADMIN",
      area: "TI",
      canDelete: true,
      tenantId: demoTenantId,
    });
  });

  beforeEach(async () => {
    const csrf = await getCsrfCookieAndToken();
    authCookie = `auth_token=${demoToken}; ${csrf.cookie}`;
    csrfTokenVal = csrf.token;
  });

  it("com token do tenant A, GET /api/tasks/:id da task do tenant B retorna 404", async () => {
    const res = await request(app)
      .get(`/api/tasks/${taskIdOther}/evidences`)
      .set("Host", "localhost")
      .set("X-Tenant-Slug", DEMO_SLUG)
      .set("Cookie", authCookie)
      .set("X-CSRF-Token", csrfTokenVal);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("com token do tenant A, PUT /api/tasks/:id da task do tenant B retorna 404", async () => {
    const res = await request(app)
      .put(`/api/tasks/${taskIdOther}`)
      .set("Host", "localhost")
      .set("X-Tenant-Slug", DEMO_SLUG)
      .set("Cookie", authCookie)
      .set("X-CSRF-Token", csrfTokenVal)
      .send({ observacoes: "tentativa idor" });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("token do tenant A com X-Tenant-Slug do tenant B retorna 403 TENANT_MISMATCH", async () => {
    const res = await request(app)
      .get("/api/tasks")
      .set("Host", "localhost")
      .set("X-Tenant-Slug", "other")
      .set("Cookie", authCookie)
      .set("X-CSRF-Token", csrfTokenVal);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("TENANT_MISMATCH");
  });
});

describe("Segurança - CORS", () => {
  it("Origin não permitida não recebe Access-Control-Allow-Origin", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("Origin", "https://evil.com");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("Origin localhost:5173 (dev) recebe ACAO", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });
});

describe("Segurança - Headers", () => {
  it("resposta contém X-Content-Type-Options ou Helmet headers", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-content-type-options"] || res.headers["content-security-policy"]).toBeDefined();
  });
});

describe("Segurança - Autorização (role)", () => {
  let authCookie: string;
  let csrfTokenVal: string;
  let userToken: string;

  beforeAll(async () => {
    await ensureDemoTenant();
    const demo = await Promise.resolve(
      db.prepare("SELECT id FROM tenants WHERE slug = ?").get(DEMO_SLUG)
    ) as { id: string } | undefined;
    if (!demo) throw new Error("Tenant demo não encontrado.");
    userToken = signToken({
      id: "user-1",
      email: "user@demo.com",
      nome: "User",
      role: "USER",
      area: "TI",
      canDelete: false,
      tenantId: demo.id,
    });
  });

  beforeEach(async () => {
    const csrf = await getCsrfCookieAndToken();
    authCookie = `auth_token=${userToken}; ${csrf.cookie}`;
    csrfTokenVal = csrf.token;
  });

  it("GET /api/users/all como USER retorna 403", async () => {
    const res = await request(app)
      .get("/api/users/all")
      .set("Host", "localhost")
      .set("X-Tenant-Slug", DEMO_SLUG)
      .set("Cookie", authCookie)
      .set("X-CSRF-Token", csrfTokenVal);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });
});
