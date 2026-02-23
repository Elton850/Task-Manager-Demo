import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import db, { SYSTEM_TENANT_ID } from "./index";

/**
 * Cria o administrador do sistema na primeira execução, quando as variáveis
 * SYSTEM_ADMIN_EMAIL e SYSTEM_ADMIN_PASSWORD estiverem definidas.
 * Esse usuário pertence ao tenant "system" e é o único que pode cadastrar empresas.
 * Retorna Promise para compatibilidade com DB_PROVIDER=supabase (acesso assíncrono).
 */
export async function seedSystemAdminIfNeeded(): Promise<void> {
  const email = process.env.SYSTEM_ADMIN_EMAIL?.trim().toLowerCase();
  const passwordRaw = process.env.SYSTEM_ADMIN_PASSWORD;
  const password = typeof passwordRaw === "string" ? passwordRaw.trim() : "";
  if (!email || !password || password.length < 6) return;

  const existing = await db.prepare("SELECT id FROM users WHERE tenant_id = ? AND email = ?").get(SYSTEM_TENANT_ID, email) as { id: string } | undefined;
  const passwordHash = bcrypt.hashSync(password, 12);
  const now = new Date().toISOString();
  const nome = process.env.SYSTEM_ADMIN_NOME?.trim() || "Administrador do Sistema";

  if (existing) {
    // Sincroniza senha e estado de reset com o arquivo do ambiente (staging → .env.staging, prod → .env.production)
    const syncFromEnv = process.env.NODE_ENV !== "production" || process.env.SYNC_SYSTEM_ADMIN_PASSWORD === "1";
    if (syncFromEnv) {
      await db.prepare(`
        UPDATE users SET password_hash = ?, must_change_password = 0, reset_code_hash = NULL, reset_code_expires_at = NULL WHERE id = ?
      `).run(passwordHash, existing.id);
      if (process.env.NODE_ENV === "staging") {
        console.log("[seed] Senha do administrador do sistema sincronizada com .env.staging");
      } else if (process.env.NODE_ENV === "production") {
        console.log("[seed] Senha do administrador do sistema sincronizada com .env.production");
      } else {
        console.log("[seed] Senha do administrador do sistema sincronizada com o ambiente");
      }
    }
    return;
  }

  const id = uuidv4();
  await db.prepare(`
    INSERT INTO users (id, tenant_id, email, nome, role, area, active, can_delete, password_hash, must_change_password, created_at)
    VALUES (?, ?, ?, ?, 'ADMIN', 'Sistema', 1, 0, ?, 0, ?)
  `).run(id, SYSTEM_TENANT_ID, email, nome, passwordHash, now);

  console.log("[seed] Administrador do sistema criado:", email);
}
