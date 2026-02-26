/**
 * Sincroniza feriados da API (BrasilAPI / Nager.Date) para todos os tenants ativos.
 *
 * Uso:
 *   npm run sync:holidays              — usa .env
 *   npm run sync:holidays:prod          — usa .env.production (Supabase produção)
 *   npm run sync:holidays:staging       — usa .env.staging (Supabase staging)
 *   npm run sync:holidays:prod -- 2025  — produção, apenas 2025
 */
// Carrega env antes de qualquer import que use process.env (ex.: db)
require("dotenv").config({ path: process.env.DOTENV_CONFIG_PATH || ".env" });

import * as holidaySync from "../src/services/holiday-sync";

const SYSTEM_USER = "script-sync";

async function main(): Promise<void> {
  const yearArg = process.argv[2];
  const year = yearArg ? parseInt(yearArg, 10) : new Date().getFullYear();
  if (Number.isNaN(year) || year < 2000 || year > 2100) {
    console.error("Ano inválido. Uso: npm run sync:holidays [ANO]  (ex.: 2025)");
    process.exit(1);
  }

  console.log("[sync-holidays] Iniciando sincronização...");
  console.log("[sync-holidays] Ano(s):", year, year === new Date().getFullYear() ? `e ${year + 1}` : "");

  const tenantIds = await holidaySync.getActiveTenantIds();
  if (tenantIds.length === 0) {
    console.log("[sync-holidays] Nenhum tenant ativo. Nada a fazer.");
    process.exit(0);
  }

  const yearsToSync = year === new Date().getFullYear() ? [year, year + 1] : [year];
  let totalInserted = 0;
  let totalUpdated = 0;

  for (const tenantId of tenantIds) {
    for (const y of yearsToSync) {
      try {
        const result = await holidaySync.syncYearForTenant(tenantId, y, SYSTEM_USER, "brasilapi");
        totalInserted += result.inserted;
        totalUpdated += result.updated;
      } catch (err) {
        console.error(`[sync-holidays] Erro tenant ${tenantId} ano ${y}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  console.log(`[sync-holidays] Concluído: ${tenantIds.length} tenant(s), ${totalInserted} inseridos, ${totalUpdated} atualizados.`);
  process.exit(0);
}

main();
