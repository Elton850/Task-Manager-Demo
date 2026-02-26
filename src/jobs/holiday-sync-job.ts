/**
 * Job de sincronização de feriados: executa uma vez por dia (03:00).
 * Sincroniza ano atual e próximo para todos os tenants ativos.
 * Habilitar com HOLIDAY_SYNC_ENABLED=true (opcional).
 */

import * as holidaySync from "../services/holiday-sync";

const SYSTEM_USER = "holiday-sync-job";

function runSync(): void {
  const year = new Date().getFullYear();
  holidaySync.getActiveTenantIds()
    .then(tenantIds => {
      return Promise.all(
        tenantIds.map(tenantId =>
          holidaySync.syncYearForTenant(tenantId, year, SYSTEM_USER, "brasilapi")
            .then(r1 =>
              holidaySync.syncYearForTenant(tenantId, year + 1, SYSTEM_USER, "brasilapi")
                .then(r2 => ({ tenantId, y1: r1, y2: r2 }))
            )
        )
      );
    })
    .then(results => {
      const total = results.reduce((acc, r) => acc + r.y1.inserted + r.y1.updated + r.y2.inserted + r.y2.updated, 0);
      if (total > 0) {
        console.log(`[holiday-sync] Concluído: ${results.length} tenant(s), ${total} feriado(s) inseridos/atualizados.`);
      }
    })
    .catch(err => {
      console.error("[holiday-sync] Erro:", err instanceof Error ? err.message : err);
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
