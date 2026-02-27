/**
 * Log de execução do job de sincronização de feriados.
 * Registra cada execução em holiday_sync_runs para rastrear sucesso/falha.
 */

import { v4 as uuidv4 } from "uuid";
import db from "../db";

export type HolidaySyncRunStatus = "running" | "success" | "failure";

export interface HolidaySyncRunRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: HolidaySyncRunStatus;
  error_message: string | null;
  tenants_count: number;
  inserted_total: number;
  updated_total: number;
}

export interface HolidaySyncRun {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: HolidaySyncRunStatus;
  errorMessage: string | null;
  tenantsCount: number;
  insertedTotal: number;
  updatedTotal: number;
}

function rowToSyncRun(row: HolidaySyncRunRow): HolidaySyncRun {
  return {
    id: row.id,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? null,
    status: row.status as HolidaySyncRunStatus,
    errorMessage: row.error_message ?? null,
    tenantsCount: Number(row.tenants_count),
    insertedTotal: Number(row.inserted_total),
    updatedTotal: Number(row.updated_total),
  };
}

/** Registra início de uma execução do job. Retorna o id da run. */
export async function logSyncRunStart(): Promise<string> {
  const id = uuidv4();
  const startedAt = new Date().toISOString();
  await db.prepare(
    `INSERT INTO holiday_sync_runs (id, started_at, finished_at, status, error_message, tenants_count, inserted_total, updated_total)
     VALUES (?, ?, NULL, 'running', NULL, 0, 0, 0)`
  ).run(id, startedAt);
  return id;
}

/** Atualiza a run com sucesso (contagens finais). */
export async function logSyncRunSuccess(
  runId: string,
  params: { tenantsCount: number; insertedTotal: number; updatedTotal: number }
): Promise<void> {
  const finishedAt = new Date().toISOString();
  await db.prepare(
    `UPDATE holiday_sync_runs SET finished_at = ?, status = 'success', tenants_count = ?, inserted_total = ?, updated_total = ? WHERE id = ?`
  ).run(finishedAt, params.tenantsCount, params.insertedTotal, params.updatedTotal, runId);
}

/** Atualiza a run com falha (mensagem de erro). */
export async function logSyncRunFailure(runId: string, errorMessage: string): Promise<void> {
  const finishedAt = new Date().toISOString();
  const truncated = errorMessage.length > 2000 ? errorMessage.slice(0, 1997) + "..." : errorMessage;
  await db.prepare(
    `UPDATE holiday_sync_runs SET finished_at = ?, status = 'failure', error_message = ? WHERE id = ?`
  ).run(finishedAt, truncated, runId);
}

/** Retorna a última execução do job (para exibir status). */
export async function getLastSyncRun(): Promise<HolidaySyncRun | null> {
  const row = await db.prepare(
    `SELECT id, started_at, finished_at, status, error_message, tenants_count, inserted_total, updated_total
     FROM holiday_sync_runs ORDER BY started_at DESC LIMIT 1`
  ).get() as HolidaySyncRunRow | undefined;
  return row ? rowToSyncRun(row) : null;
}
