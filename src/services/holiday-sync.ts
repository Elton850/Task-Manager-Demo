/**
 * Sincronização de feriados com API externa (BrasilAPI, fallback Nager.Date).
 * Apenas insere/atualiza feriados de origem API; nunca altera ou remove manuais.
 */

import { v4 as uuidv4 } from "uuid";
import db from "../db";
import { nowIso } from "../utils";

const BRASIL_API_URL = "https://brasilapi.com.br/api/feriados/v1";
const NAGER_URL = "https://date.nager.at/api/v3/PublicHolidays";

export interface ExternalHoliday {
  date: string; // YYYY-MM-DD
  name: string;
  type?: string;
}

/** Busca feriados nacionais do ano na BrasilAPI. */
export async function fetchBrasilApi(year: number): Promise<ExternalHoliday[]> {
  const url = `${BRASIL_API_URL}/${year}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`BrasilAPI ${res.status}: ${res.statusText}`);
  const data = await res.json() as { date: string; name: string; type?: string }[];
  return data.map(d => ({ date: d.date, name: d.name, type: d.type ?? "national" }));
}

/** Busca feriados BR no Nager.Date (fallback). */
export async function fetchNagerDate(year: number): Promise<ExternalHoliday[]> {
  const url = `${NAGER_URL}/${year}/BR`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Nager.Date ${res.status}: ${res.statusText}`);
  const data = await res.json() as { date: string; localName: string }[];
  return data.map(d => ({ date: d.date, name: d.localName, type: "national" }));
}

/** Sincroniza um ano para o tenant: upsert feriados de origem API sem tocar em manuais. */
export async function syncYearForTenant(
  tenantId: string,
  year: number,
  userId: string,
  provider: "brasilapi" | "nager" = "brasilapi"
): Promise<{ inserted: number; updated: number }> {
  const list = provider === "brasilapi"
    ? await fetchBrasilApi(year)
    : await fetchNagerDate(year);

  const now = nowIso();
  let inserted = 0;
  let updated = 0;

  for (const ext of list) {
    const date = ext.date;
    const name = ext.name.trim();
    if (!date || !name) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const existing = await db.prepare(
      `SELECT id FROM holidays WHERE tenant_id = ? AND date = ? AND source = 'api' AND source_provider = ? AND name = ?`
    ).get(tenantId, date, provider, name) as { id: string } | undefined;

    if (existing) {
      await db.prepare(`
        UPDATE holidays SET updated_at = ?, updated_by = ?, last_synced_at = ?, type = ? WHERE id = ?
      `).run(now, userId, now, ext.type ?? "national", existing.id);
      updated += 1;
    } else {
      const id = uuidv4();
      await db.prepare(`
        INSERT INTO holidays (id, tenant_id, date, name, type, source, source_provider, source_id, active, metadata_json, created_at, created_by, updated_at, updated_by, last_synced_at)
        VALUES (?, ?, ?, ?, ?, 'api', ?, NULL, 1, NULL, ?, ?, ?, ?, ?)
      `).run(id, tenantId, date, name, ext.type ?? "national", provider, now, userId, now, userId, now);
      inserted += 1;
    }
  }

  return { inserted, updated };
}

/** Obtém lista de tenants ativos (ids) para sync em lote. */
export async function getActiveTenantIds(): Promise<string[]> {
  const rows = await db.prepare("SELECT id FROM tenants WHERE active = 1").all() as { id: string }[];
  return rows.map(r => r.id);
}
