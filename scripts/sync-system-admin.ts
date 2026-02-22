/**
 * Sincroniza a senha do administrador do sistema com o .env.
 * Use quando o login der "senha incorreta" mesmo com as credenciais corretas no .env.
 *
 * Uso: npm run sync:system-admin
 * (ou: npx ts-node -r dotenv/config scripts/sync-system-admin.ts)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import db, { SYSTEM_TENANT_ID } from "../src/db";
import { v4 as uuidv4 } from "uuid";

const email = process.env.SYSTEM_ADMIN_EMAIL?.trim().toLowerCase();
const passwordRaw = process.env.SYSTEM_ADMIN_PASSWORD;
const password = typeof passwordRaw === "string" ? passwordRaw.trim() : "";

if (!email || !password || password.length < 6) {
  console.error("Defina SYSTEM_ADMIN_EMAIL e SYSTEM_ADMIN_PASSWORD no .env (mín. 6 caracteres).");
  process.exit(1);
}

const existing = db.prepare("SELECT id, email FROM users WHERE tenant_id = ? AND email = ?").get(SYSTEM_TENANT_ID, email) as { id: string; email: string } | undefined;
const passwordHash = bcrypt.hashSync(password, 12);

if (existing) {
  db.prepare(`
    UPDATE users SET password_hash = ?, must_change_password = 0, reset_code_hash = NULL, reset_code_expires_at = NULL WHERE id = ?
  `).run(passwordHash, existing.id);
  console.log("Senha do administrador do sistema atualizada com sucesso.");
  console.log("Email:", existing.email);
  console.log("Recomendação: faça login em /login com esse email e a senha do .env.");
} else {
  const nome = process.env.SYSTEM_ADMIN_NOME?.trim() || "Administrador do Sistema";
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO users (id, tenant_id, email, nome, role, area, active, can_delete, password_hash, must_change_password, created_at)
    VALUES (?, ?, ?, ?, 'ADMIN', 'Sistema', 1, 0, ?, 0, ?)
  `).run(id, SYSTEM_TENANT_ID, email, nome, passwordHash, now);
  console.log("Administrador do sistema criado:", email);
}

process.exit(0);
