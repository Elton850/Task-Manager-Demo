/**
 * Define ou atualiza a senha de um usuário de uma empresa (por e-mail e slug do tenant).
 * Útil para testar login quando o fluxo de e-mail ainda não está configurado.
 *
 * Uso na VPS (produção):
 *   cd ~/Task-Manager
 *   NODE_ENV=production TENANT_SLUG=demo USER_EMAIL=user@demo.com USER_PASSWORD=Senha123 npm run set-user-password
 *
 * Variáveis de ambiente:
 *   TENANT_SLUG   — slug da empresa (ex.: demo)
 *   USER_EMAIL    — e-mail do usuário (ex.: user@demo.com)
 *   USER_PASSWORD — nova senha (mín. 6 caracteres)
 */
import "dotenv/config";
if (process.env.NODE_ENV === "production") {
  require("dotenv").config({ path: ".env.production", override: true });
}
import bcrypt from "bcryptjs";

const tenantSlug = (process.env.TENANT_SLUG ?? "").trim().toLowerCase();
const userEmail = (process.env.USER_EMAIL ?? "").trim().toLowerCase();
const passwordRaw = process.env.USER_PASSWORD ?? "";
const password = typeof passwordRaw === "string" ? passwordRaw.trim() : "";

if (!tenantSlug || !userEmail || !password || password.length < 6) {
  console.error("Use: TENANT_SLUG=demo USER_EMAIL=user@demo.com USER_PASSWORD=MinhaSenha123");
  console.error("TENANT_SLUG e USER_EMAIL são obrigatórios. USER_PASSWORD com no mínimo 6 caracteres.");
  process.exit(1);
}

async function main() {
  const { default: db } = await import("../src/db");
  const tenantRow = await db.prepare("SELECT id FROM tenants WHERE slug = ? AND active = 1").get(tenantSlug) as { id: string } | undefined;
  if (!tenantRow) {
    console.error("Empresa não encontrada ou inativa com slug:", tenantSlug);
    process.exit(1);
  }

  const userRow = await db.prepare("SELECT id, email, nome FROM users WHERE tenant_id = ? AND email = ?").get(tenantRow.id, userEmail) as { id: string; email: string; nome: string } | undefined;
  if (!userRow) {
    console.error("Usuário não encontrado com e-mail", userEmail, "na empresa", tenantSlug);
    process.exit(1);
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  await db.prepare(`
    UPDATE users SET password_hash = ?, must_change_password = 0, reset_code_hash = NULL, reset_code_expires_at = NULL WHERE id = ?
  `).run(passwordHash, userRow.id);

  console.log("Senha atualizada com sucesso.");
  console.log("  Empresa:", tenantSlug);
  console.log("  E-mail:", userRow.email);
  console.log("  Nome:", userRow.nome);
  console.log("Faça login em https://" + tenantSlug + ".fluxiva.com.br/login com esse e-mail e a senha definida.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
