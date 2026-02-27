/**
 * Job de sincronização de feriados: executa uma vez por dia (03:00).
 * Sincroniza ano atual e próximo para todos os tenants ativos.
 * Habilitar com HOLIDAY_SYNC_ENABLED=true (opcional).
 * Cada execução é registrada em holiday_sync_runs para rastrear sucesso/falha.
 */

import * as holidaySync from "../services/holiday-sync";
import * as holidaySyncRunLog from "../services/holiday-sync-run-log";

const SYSTEM_USER = "holiday-sync-job";

function runSync(): void {
  const year = new Date().getFullYear();

  function doSync(runId: string | null) {
    return holidaySync
      .getActiveTenantIds()
      .then(tenantIds =>
        Promise.all(
          tenantIds.map(tenantId =>
            holidaySync.syncYearForTenant(tenantId, year, SYSTEM_USER, "brasilapi").then(r1 =>
              holidaySync.syncYearForTenant(tenantId, year + 1, SYSTEM_USER, "brasilapi").then(r2 => ({
                tenantId,
                y1: r1,
                y2: r2,
              }))
            )
          )
        )
      )
      .then(results => {
        const insertedTotal = results.reduce((acc, r) => acc + r.y1.inserted + r.y2.inserted, 0);
        const updatedTotal = results.reduce((acc, r) => acc + r.y1.updated + r.y2.updated, 0);
        if (runId) {
          return holidaySyncRunLog
            .logSyncRunSuccess(runId, {
              tenantsCount: results.length,
              insertedTotal,
              updatedTotal,
            })
            .then(() => ({ results, insertedTotal, updatedTotal }));
        }
        return { results, insertedTotal, updatedTotal };
      })
      .then(({ results, insertedTotal, updatedTotal }) => {
        if (insertedTotal + updatedTotal > 0) {
          console.log(
            `[holiday-sync] Concluído: ${results.length} tenant(s), ${insertedTotal} inseridos, ${updatedTotal} atualizados.`
          );
        }
      })
      .catch(err => {
        const msg = err instanceof Error ? err.message : String(err);
        if (runId) {
          return holidaySyncRunLog.logSyncRunFailure(runId, msg).then(() => {
            console.error("[holiday-sync] Erro:", msg);
          });
        }
        console.error("[holiday-sync] Erro:", msg);
      });
  }

  holidaySyncRunLog
    .logSyncRunStart()
    .then(runId => doSync(runId))
    .catch(() => {
      // Tabela holiday_sync_runs pode não existir (deploy antigo); executa sync sem log
      doSync(null);
    });
}

/** Agenda execução diária às 03:00 (hora local). */
export function startHolidaySyncJob(): void {
  const enabled = process.env.HOLIDAY_SYNC_ENABLED === "true" || process.env.HOLIDAY_SYNC_ENABLED === "1";
  if (!enabled || process.env.NODE_ENV === "test") return;

  let lastRunYear: number | null = null;
  const intervalMs = 60 * 1000; // verificar a cada minuto

  setInterval(() => {
    const now = new Date();
    const hour = now.getHours();
    const min = now.getMinutes();
    const y = now.getFullYear();
    if (hour === 3 && min < 2 && lastRunYear !== y) {
      lastRunYear = y;
      runSync();
    }
  }, intervalMs);

  console.log("[holiday-sync] Job agendado (diário ~03:00).");
}
