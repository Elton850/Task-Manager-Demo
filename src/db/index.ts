/**
 * Ponto de entrada do banco de dados.
 * Roteia para SQLite (padrão) ou PostgreSQL/Supabase conforme DB_PROVIDER.
 *
 *   DB_PROVIDER=sqlite   → usa node:sqlite via src/db/sqlite.ts
 *   DB_PROVIDER=supabase → usa pg (node-postgres) via src/db/pg.ts
 *
 * Exporta:
 *   default          → instância DbAdapter (prepare/exec)
 *   SYSTEM_TENANT_ID → UUID do tenant "system"
 *   withDbContext    → middleware Express para contexto de transação por request
 */

import type { Request, Response, NextFunction } from "express";
import type { DbAdapter } from "./types";

const DB_PROVIDER = (process.env.DB_PROVIDER || "sqlite").toLowerCase().trim();

// Carregamento condicional para não importar pg quando DB_PROVIDER=sqlite
// (evita erro de módulo ausente em ambientes sem pg instalado)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dbModule = DB_PROVIDER === "supabase"
  ? require("./pg")
  : require("./sqlite");

const db: DbAdapter = dbModule.default;

export const SYSTEM_TENANT_ID: string = dbModule.SYSTEM_TENANT_ID as string;

/**
 * Middleware Express: inicializa contexto de banco por request.
 * - SQLite: no-op (apenas chama next()).
 * - Supabase/PostgreSQL: envolve o request em AsyncLocalStorage context,
 *   permitindo que BEGIN/COMMIT/ROLLBACK usem o mesmo cliente pg por request.
 *
 * Deve ser registrado ANTES das rotas no servidor (src/server.ts).
 */
export function withDbContext(req: Request, res: Response, next: NextFunction): void {
  if (DB_PROVIDER === "supabase") {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { txStorage } = require("./pg") as typeof import("./pg");
    txStorage.run({ client: null }, next);
  } else {
    next();
  }
}

export default db;
