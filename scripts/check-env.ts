/**
 * Testa o .env local: valida variáveis obrigatórias e formato da SUPABASE_DB_URL.
 * Uso:
 *   npx ts-node -r dotenv/config scripts/check-env.ts
 *   node -r dotenv/config scripts/check-env.js   (após build)
 *
 * Para testar .env.production localmente:
 *   cp .env.production .env && npx ts-node -r dotenv/config scripts/check-env.ts
 * Ou carregue o arquivo desejado (dotenv carrega .env por padrão; para produção
 * copie .env.production para .env antes de rodar).
 */

function main() {
  const errors: string[] = [];
  const warnings: string[] = [];

  const env = process.env;
  const dbProvider = (env.DB_PROVIDER || "sqlite").toLowerCase().trim();

  console.log("=== Verificação do .env ===\n");
  console.log("  DB_PROVIDER:", dbProvider || "(não definido, será sqlite)");
  console.log("  NODE_ENV:", env.NODE_ENV || "(não definido)");
  console.log("  PORT:", env.PORT || "(não definido, servidor usará 3000)");
  console.log("");

  if (dbProvider === "supabase") {
    const raw = env.SUPABASE_DB_URL ?? "";
    const url = raw.trim();
    if (!url) {
      errors.push("SUPABASE_DB_URL está vazia ou não definida.");
    } else {
      if (url !== raw) {
        warnings.push("SUPABASE_DB_URL tinha espaços no início ou fim (foram ignorados).");
      }
      if (url.includes("\n") || url.includes("\r")) {
        errors.push("SUPABASE_DB_URL não pode conter quebra de linha. Deixe tudo em uma única linha.");
      }
      if (url.startsWith('"') || url.startsWith("'") || url.endsWith('"') || url.endsWith("'")) {
        errors.push('SUPABASE_DB_URL não deve estar entre aspas no .env. Use: SUPABASE_DB_URL=postgresql://...');
      }
      if (url === "postgres://base" || url.includes("[YOUR-PASSWORD]") || url.includes("your-")) {
        errors.push("SUPABASE_DB_URL parece um placeholder. Substitua pela connection string real (Supabase → Settings → Database).");
      } else if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
        errors.push(`SUPABASE_DB_URL deve começar com postgresql:// (começa com: ${url.slice(0, 20)}...)`);
      } else {
        try {
          const parsed = new URL(url);
          if (!parsed.protocol.startsWith("postgres")) {
            errors.push(`SUPABASE_DB_URL deve usar protocolo postgresql:// (recebido: ${parsed.protocol})`);
          }
          if (!parsed.hostname || parsed.hostname.length < 5) {
            errors.push("SUPABASE_DB_URL: host inválido.");
          }
          if (parsed.pathname !== "/postgres" && !parsed.pathname.startsWith("/postgres")) {
            warnings.push(`SUPABASE_DB_URL path: ${parsed.pathname} (geralmente é /postgres)`);
          }
          if (errors.length === 0) {
            console.log("  SUPABASE_DB_URL: formato OK (host:", parsed.hostname + ")");
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push(`SUPABASE_DB_URL inválida (URL mal formada): ${msg}`);
          // Diagnóstico seguro (sem expor senha): comprimento, quantos @, início
          const atCount = (url.match(/@/g) || []).length;
          const preview = url.slice(0, 26) + (url.length > 26 ? "…" : "");
          if (atCount > 1) {
            errors.push(`  Diagnóstico: a URL tem ${atCount} caracteres "@". Só deve ter 1 (entre senha e host). Se a senha contém @, codifique com encodeURIComponent ou mude a senha no Supabase.`);
          } else {
            errors.push(`  Diagnóstico: comprimento=${url.length}, começa com "${preview}". Formato esperado: postgresql://postgres.XXXX:SENHA@host:5432/postgres (sem aspas, uma linha).`);
          }
          errors.push("  Dica: senha não pode ter @ # : / % sem codificar. Use senha só com letras/números ou codifique.");
        }
      }
    }
    if (!env.SUPABASE_URL?.trim()) errors.push("SUPABASE_URL não definida.");
    if (!env.SUPABASE_SERVICE_ROLE_KEY?.trim()) errors.push("SUPABASE_SERVICE_ROLE_KEY não definida.");
  }

  if (process.env.NODE_ENV === "production") {
    const secret = env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      errors.push("JWT_SECRET em produção deve ter pelo menos 32 caracteres.");
    }
  }

  console.log("");
  if (errors.length > 0) {
    console.log("❌ Erros:");
    errors.forEach((e) => console.log("   -", e));
    process.exit(1);
  }
  if (warnings.length > 0) {
    console.log("⚠️  Avisos:");
    warnings.forEach((w) => console.log("   -", w));
  }
  console.log("✅ .env OK para este ambiente.");
}

main();
