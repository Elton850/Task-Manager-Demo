/**
 * Serviço de persistência de feriados (holidays).
 * Usado pelas rotas e pelo holiday-sync.
 */

import db from "../db";
import { nowIso } from "../utils";

export type HolidayType = "national" | "state" | "municipal" | "company";
export type HolidaySource = "api" | "manual";

export interface HolidayRow {
  id: string;
  tenant_id: string;
  date: string;
  name: string;
  type: string;
  source: string;
  source_provider: string | null;
  source_id: string | null;
  active: number;
  metadata_json: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  last_synced_at: string | null;
}

export function rowToHoliday(row: HolidayRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    date: row.date,
    name: row.name,
    type: row.type as HolidayType,
    source: row.source as HolidaySource,
    sourceProvider: row.source_provider ?? undefined,
    sourceId: row.source_id ?? undefined,
    active: !!row.active,
    metadataJson: row.metadata_json ?? undefined,
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    lastSyncedAt: row.last_synced_at ?? undefined,
  };
}

/** Lista feriados do tenant no intervalo [from, to] (inclusive). */
export async function listByRange(
  tenantId: string,
  from: string,
  to: string
): Promise<ReturnType<typeof rowToHoliday>[]> {
  const rows = await db.prepare(
    `SELECT * FROM holidays WHERE tenant_id = ? AND date >= ? AND date <= ? AND active = 1 ORDER BY date ASC, name ASC`
  ).all(tenantId, from, to) as HolidayRow[];
  return rows.map(rowToHoliday);
}

/** Busca um feriado por id e tenant. */
export async function getById(tenantId: string, id: string): Promise<ReturnType<typeof rowToHoliday> | null> {
  const row = await db.prepare("SELECT * FROM holidays WHERE tenant_id = ? AND id = ?").get(tenantId, id) as HolidayRow | undefined;
  return row ? rowToHoliday(row) : null;
}

/** Cria feriado manual. */
export async function create(
  tenantId: string,
  data: {
    id: string;
    date: string;
    name: string;
    type: HolidayType;
    createdBy: string;
    updatedBy: string;
    metadataJson?: string | null;
  }
): Promise<ReturnType<typeof rowToHoliday>> {
  const now = nowIso();
  await db.prepare(`
    INSERT INTO holidays (id, tenant_id, date, name, type, source, source_provider, source_id, active, metadata_json, created_at, created_by, updated_at, updated_by, last_synced_at)
    VALUES (?, ?, ?, ?, ?, 'manual', NULL, NULL, 1, ?, ?, ?, ?, ?, NULL)
  `).run(
    data.id,
    tenantId,
    data.date,
    data.name,
    data.type,
    data.metadataJson ?? null,
    now,
    data.createdBy,
    now,
    data.updatedBy
  );
  const row = await db.prepare("SELECT * FROM holidays WHERE id = ?").get(data.id) as HolidayRow;
  return rowToHoliday(row);
}

/** Atualiza feriado (apenas manuais na rota; sync usa outro path). */
export async function update(
  tenantId: string,
  id: string,
  data: { name?: string; type?: HolidayType; date?: string; updatedBy: string }
): Promise<ReturnType<typeof rowToHoliday> | null> {
  const existing = await db.prepare("SELECT * FROM holidays WHERE tenant_id = ? AND id = ?").get(tenantId, id) as HolidayRow | undefined;
  if (!existing) return null;
  const name = data.name ?? existing.name;
  const type = (data.type ?? existing.type) as string;
  const date = data.date ?? existing.date;
  const now = nowIso();
  await db.prepare(`
    UPDATE holidays SET name = ?, type = ?, date = ?, updated_at = ?, updated_by = ? WHERE tenant_id = ? AND id = ?
  `).run(name, type, date, now, data.updatedBy, tenantId, id);
  const row = await db.prepare("SELECT * FROM holidays WHERE id = ?").get(id) as HolidayRow;
  return rowToHoliday(row);
}

/** Remove feriado. */
export async function remove(tenantId: string, id: string): Promise<boolean> {
  const r = await db.prepare("DELETE FROM holidays WHERE tenant_id = ? AND id = ?").run(tenantId, id);
  return r.changes > 0;
}
