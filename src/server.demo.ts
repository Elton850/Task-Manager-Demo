/**
 * Servidor DEMO — versão simplificada para portfólio local.
 *
 * Diferenças do server.ts de produção:
 * - Sem Supabase, sem e-mail, sem socket.io, sem jobs
 * - Persistência em JSON (data/demo/*.json)
 * - CSRF desabilitado
 * - Tenant resolvido por header/query sem validação de host
 * - Rate limit desabilitado
 * - Inicia seed automático na primeira execução
 *
 * Para rodar: npm run dev:demo
 */
import "./load-env";
import path from "path";
import http from "http";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { demoTenantMiddleware, apiAuthContext, demoGetCsrfToken } from "./demo/middleware";
import { seedDemoIfNeeded } from "./demo/seed";

import authRoutes from "./routes/demo/auth";
import taskRoutes from "./routes/demo/tasks";
import userRoutes from "./routes/demo/users";
import lookupRoutes from "./routes/demo/lookups";
import ruleRoutes from "./routes/demo/rules";
import justificationRoutes from "./routes/demo/justifications";

const app = express();
const httpServer = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;

// ── Security headers (relaxados para demo local) ──────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // desativado para facilitar uso local sem HTTPS
    hsts: false,
  })
);

// ── Core Middleware ────────────────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false }));

// ── CORS local ────────────────────────────────────────────────────────────────
const devOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && devOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type,X-CSRF-Token,X-Tenant-Slug,X-Requested-With"
    );
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// ── Endpoints públicos ─────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ status: "ok", version: "2.0.0-demo" }));
app.get("/api/csrf", demoGetCsrfToken);

// ── Tenant + Auth context (sem CSRF, sem rate-limit) ─────────────────────────
app.use("/api", (req, res, next) => {
  if (req.path === "/csrf" || req.path === "/health") return next();
  demoTenantMiddleware(req, res, next);
});
app.use("/api", apiAuthContext);

// ── Rotas demo ────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/users", userRoutes);
app.use("/api/lookups", lookupRoutes);
app.use("/api/rules", ruleRoutes);
app.use("/api/justifications", justificationRoutes);

// ── Servir frontend em modo produção (se existir) ────────────────────────────
const frontendDist = path.resolve(__dirname, "../frontend/dist");
if (require("fs").existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

// ── 404 e error handler ───────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Rota não encontrada.", code: "NOT_FOUND" });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[ERROR]", err.message);
  res.status(500).json({ error: "Erro interno do servidor.", code: "INTERNAL" });
});

// ── Startup ────────────────────────────────────────────────────────────────────
seedDemoIfNeeded().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`\n Task Manager DEMO rodando em http://localhost:${PORT}`);
    console.log(`   Frontend: http://localhost:5173`);
    console.log(`   Dados:    ${process.cwd()}/data/demo/`);
    console.log(`   Login:    admin@demo.com / 123456  (tenant: demo)\n`);
  });
});

export default app;
