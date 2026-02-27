// Carregamento de env DEVE ser o primeiro import — load-env.ts garante staging só .env.staging
import "./load-env";
import path from "path";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import { tenantMiddleware, rejectInvalidHost } from "./middleware/tenant";
import { verifyCsrf, csrfToken } from "./middleware/csrf";
import { apiAuthContext, blockWritesWhenImpersonating } from "./middleware/auth";

import authRoutes from "./routes/auth";
import taskRoutes from "./routes/tasks";
import justificationRoutes from "./routes/justifications";
import userRoutes from "./routes/users";
import lookupRoutes from "./routes/lookups";
import ruleRoutes from "./routes/rules";
import tenantRoutes from "./routes/tenants";
import systemRoutes from "./routes/system";
import holidayRoutes from "./routes/holidays";

// Initialize DB schema on startup (SQLite: schema criado aqui; Supabase: schema já criado via supabase-schema.sql)
import "./db";
import { withDbContext } from "./db";
import { seedSystemAdminIfNeeded } from "./db/seedSystemAdmin";

const DB_PROVIDER = (process.env.DB_PROVIDER || "sqlite").toLowerCase().trim();

// Confirmação explícita em staging: DB e credenciais vêm só de .env.staging
if (process.env.NODE_ENV === "staging" && DB_PROVIDER === "supabase") {
  const supabaseDbUrl = process.env.SUPABASE_DB_URL ?? "";
  console.log("[startup] Staging ativo: DB e admin vêm de .env.staging. SUPABASE_DB_URL:", supabaseDbUrl ? `${supabaseDbUrl.length} chars` : "ausente");
}

// ── Validação de variáveis Supabase ao arranque ───────────────────────────────
if (DB_PROVIDER === "supabase") {
  const missingVars: string[] = [];
  if (!process.env.SUPABASE_URL?.trim()) missingVars.push("SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) missingVars.push("SUPABASE_SERVICE_ROLE_KEY");
  const dbUrl = process.env.SUPABASE_DB_URL?.trim() ?? "";
  if (!dbUrl) missingVars.push("SUPABASE_DB_URL");
  if (missingVars.length > 0) {
    console.error(
      `[startup] DB_PROVIDER=supabase mas as seguintes variáveis estão ausentes: ${missingVars.join(", ")}.\n` +
      "Veja docs/ENV-REQUISITOS.md para instruções."
    );
    process.exit(1);
  }
  // Diagnóstico seguro em produção (sem expor a URL): confirma que a variável foi carregada
  if (process.env.NODE_ENV === "production") {
    const ok = dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://");
    console.log(
      "[startup] SUPABASE_DB_URL:",
      ok ? `${dbUrl.length} chars, prefix OK` : `inválida (${dbUrl.length} chars). Use postgresql://... ou postgres://... sem aspas.`
    );
    if (!ok) {
      console.error("[startup] Corrija SUPABASE_DB_URL em .env.production na VPS e reinicie o PM2.");
      process.exit(1);
    }
  }
}

const app = express();
// Nginx é o proxy reverso — necessário para express-rate-limit e req.ip funcionarem corretamente
app.set("trust proxy", 1);
const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === "production";
const IS_STAGING = process.env.NODE_ENV === "staging";

// Validação de secrets em produção
if (IS_PROD) {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== "string" || secret.length < 32) {
    console.error("Em produção, JWT_SECRET deve ter pelo menos 32 caracteres.");
    process.exit(1);
  }
}

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: IS_PROD ? { maxAge: 31536000, includeSubDomains: true } : false,
}));

// ── Core Middleware ────────────────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: false }));

// ── CORS (whitelist + domínio base dinâmico; nunca * com credentials) ───────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
const APP_DOMAIN = (process.env.APP_DOMAIN || "").trim();
const devOrigins = ["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174"];

/**
 * Verifica se a origem da requisição é permitida.
 * Dev: apenas localhost. Prod: ALLOWED_ORIGINS + subdomínios de APP_DOMAIN.
 * Staging path-based: ALLOWED_ORIGINS + APENAS o host exato de staging (APP_DOMAIN=staging.fluxiva.com.br).
 * Não são aceitos subdomínios de staging (ex.: empresa.staging.fluxiva.com.br) pois o esquema é path-based.
 */
function isOriginAllowed(origin: string): boolean {
  const useDeployOrigins = IS_PROD || IS_STAGING;
  const list = useDeployOrigins ? ALLOWED_ORIGINS : devOrigins;
  if (list.some((o) => origin === o)) return true;
  if (APP_DOMAIN && useDeployOrigins) {
    const escaped = APP_DOMAIN.replace(/\./g, "\\.");
    const re = IS_STAGING
      // Staging path-based: aceita apenas o host exato (sem subdomínios), http ou https
      ? new RegExp(`^https?://${escaped}$`)
      // Produção: aceita https para APP_DOMAIN e todos os seus subdomínios (empresa.fluxiva.com.br)
      : new RegExp(`^https://([a-z0-9-]+\\.)?${escaped}$`);
    if (re.test(origin)) return true;
  }
  return false;
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-CSRF-Token,X-Tenant-Slug,X-Requested-With");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Muitas tentativas de login. Tente novamente em 15 minutos.", code: "RATE_LIMITED" },
  standardHeaders: true,
  legacyHeaders: false,
});
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Muitas tentativas de redefinição. Tente novamente em 15 minutos.", code: "RATE_LIMITED" },
  standardHeaders: true,
  legacyHeaders: false,
});
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  message: { error: "Muitas requisições. Tente novamente em breve.", code: "RATE_LIMITED" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── DB Context (por request — necessário para transações com Supabase) ─────────
// Para SQLite: no-op. Para Supabase: inicializa AsyncLocalStorage por request.
app.use("/api", withDbContext);

// ── Host válido para toda /api (inclui /api/csrf e /api/health) ─────────────────
app.use("/api", rejectInvalidHost);

// ── Public endpoints ──────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ status: "ok", version: "2.0.0" }));
app.get("/api/csrf", csrfToken);

// ── Tenant Resolution ─────────────────────────────────────────────────────────
app.use("/api", (req, res, next) => {
  if (req.path === "/csrf" || req.path === "/health") return next();
  tenantMiddleware(req, res, next);
});

// ── Auth context (req.user, req.impersonating) e bloqueio de writes ao impersonar ─
app.use("/api", apiAuthContext);
app.use("/api", blockWritesWhenImpersonating);

// ── CSRF verification for mutating requests ───────────────────────────────────
app.use("/api", verifyCsrf);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/reset", resetLimiter);
app.use("/api/auth/request-reset", resetLimiter);
app.use("/api", apiLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/justifications", justificationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/lookups", lookupRoutes);
app.use("/api/rules", ruleRoutes);
app.use("/api/tenants", tenantRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/holidays", holidayRoutes);

// ── Serve React frontend in production ───────────────────────────────────────
if (IS_PROD) {
  const frontendDist = path.resolve(__dirname, "../frontend/dist");
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Rota não encontrada.", code: "NOT_FOUND" });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const ts = new Date().toISOString();
  if (process.env.NODE_ENV === "production") {
    console.error(`[ERROR] ${ts}`, err.name || "Error");
  } else {
    console.error(`[ERROR] ${ts}`, err.message);
    console.error(err.stack);
  }
  res.status(500).json({ error: "Erro interno do servidor.", code: "INTERNAL" });
});

// ── Startup: seed admin + listen ──────────────────────────────────────────────
// seedSystemAdminIfNeeded é async para suportar Supabase.
// Para SQLite, todas as chamadas await resolvem imediatamente (valores síncronos).
if (process.env.NODE_ENV !== "test") {
  seedSystemAdminIfNeeded()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`\n Task Manager v2.0 rodando em http://localhost:${PORT}`);
        const modeLabel = process.env.NODE_ENV === "production" ? "produção" : process.env.NODE_ENV === "staging" ? "staging" : "desenvolvimento";
        console.log(`   Modo: ${modeLabel}`);
        console.log(`   DB:   ${DB_PROVIDER === "supabase" ? "Supabase (PostgreSQL)" : `${process.cwd()}/data/taskmanager.db`}`);
        if (!IS_PROD) {
          console.log(`   Frontend: http://localhost:5173`);
        }
        try {
          const { startHolidaySyncJob } = require("./jobs/holiday-sync-job");
          startHolidaySyncJob();
        } catch (jobErr) {
          console.warn("[startup] holiday-sync-job não pôde ser iniciado (opcional):", jobErr instanceof Error ? jobErr.message : jobErr);
        }
      });
    })
    .catch((err) => {
      console.error("[startup] Erro ao inicializar servidor:", err);
      process.exit(1);
    });
} else {
  // Em testes: seed síncrono (SQLite), sem listen
  seedSystemAdminIfNeeded().catch((err) => {
    console.error("[test startup] seedSystemAdmin falhou:", err);
  });
}

export default app;
