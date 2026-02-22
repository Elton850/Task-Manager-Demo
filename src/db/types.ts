/**
 * Interface mínima do banco de dados usada em todo o backend.
 * Implementada pelo provider SQLite (node:sqlite) e pelo provider
 * PostgreSQL/Supabase (node-postgres via pg).
 *
 * MaybePromise<T>: permite que o SQLite retorne valores síncronos e o
 * PostgreSQL retorne Promises. As rotas sempre usam `await` nas chamadas
 * ao banco — `await T` (não-Promise) retorna T imediatamente;
 * `await Promise<T>` aguarda e retorna T. Ambos os casos funcionam.
 *
 * Padrão de uso nas rotas (sempre com await):
 *   const row  = await db.prepare(sql).get(...params)  → registro ou undefined
 *   const rows = await db.prepare(sql).all(...params)  → array de registros
 *   const r    = await db.prepare(sql).run(...params)  → RunResult
 *   await db.exec(sql)                                 → void
 */

export type MaybePromise<T> = T | Promise<T>;

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface PreparedStatement {
  get(...params: unknown[]): MaybePromise<unknown>;
  all(...params: unknown[]): MaybePromise<unknown[]>;
  run(...params: unknown[]): MaybePromise<RunResult>;
}

export interface DbAdapter {
  prepare(sql: string): PreparedStatement;
  exec(sql: string): MaybePromise<void>;
}
