/**
 * Demo Repository — CRUD sobre arquivos JSON em data/demo/.
 *
 * Cada entidade tem seu próprio arquivo (users.json, tasks.json, etc.).
 * Para demo de portfólio: um único tenant "demo" ativo.
 * Não há isolamento multi-tenant aqui — todas as queries já são filtradas
 * pelo tenant_id injetado no middleware simplificado.
 */
import { v4 as uuidv4 } from "uuid";
import { readJson, writeJson } from "./json-store";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  created_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  nome: string;
  role: "USER" | "LEADER" | "ADMIN";
  area: string;
  active: boolean;
  can_delete: boolean;
  password_hash: string;
  must_change_password: boolean;
  created_at: string;
  last_login_at?: string | null;
}

export interface Task {
  id: string;
  tenant_id: string;
  competencia_ym: string;
  recorrencia: string;
  tipo: string;
  atividade: string;
  responsavel_email: string;
  responsavel_nome: string;
  area: string;
  prazo: string | null;
  realizado: string | null;
  status: string;
  observacoes: string | null;
  parent_task_id: string | null;
  justification_blocked: boolean;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface Lookup {
  id: string;
  tenant_id: string;
  category: string;
  value: string;
  order_index: number;
  created_at: string;
}

export interface Rule {
  id: string;
  tenant_id: string;
  area: string;
  allowed_recorrencias: string[];
  custom_tipos: string[];
  default_tipos: string[];
  custom_recorrencias: string[];
  default_recorrencias: string[];
  updated_at: string;
  updated_by: string;
}

// ─── Helpers de leitura/escrita ───────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

export const tenants = {
  list(): Tenant[] {
    return readJson<Tenant[]>("tenants.json", []);
  },
  findBySlug(slug: string): Tenant | undefined {
    return this.list().find((t) => t.slug === slug && t.active);
  },
  findById(id: string): Tenant | undefined {
    return this.list().find((t) => t.id === id);
  },
};

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = {
  list(tenantId: string): User[] {
    return readJson<User[]>("users.json", []).filter(
      (u) => u.tenant_id === tenantId
    );
  },
  findByEmail(tenantId: string, email: string): User | undefined {
    return readJson<User[]>("users.json", []).find(
      (u) => u.tenant_id === tenantId && u.email === email.toLowerCase()
    );
  },
  findById(id: string): User | undefined {
    return readJson<User[]>("users.json", []).find((u) => u.id === id);
  },
  create(data: Omit<User, "id" | "created_at">): User {
    const all = readJson<User[]>("users.json", []);
    const user: User = { ...data, id: uuidv4(), created_at: now() };
    writeJson("users.json", [...all, user]);
    return user;
  },
  update(id: string, patch: Partial<User>): User | null {
    const all = readJson<User[]>("users.json", []);
    const idx = all.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...patch };
    writeJson("users.json", all);
    return all[idx];
  },
  delete(id: string): boolean {
    const all = readJson<User[]>("users.json", []);
    const next = all.filter((u) => u.id !== id);
    if (next.length === all.length) return false;
    writeJson("users.json", next);
    return true;
  },
  updateLoginAt(id: string): void {
    this.update(id, { last_login_at: now() });
  },
};

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const tasks = {
  list(tenantId: string): Task[] {
    return readJson<Task[]>("tasks.json", []).filter(
      (t) => t.tenant_id === tenantId && !t.deleted_at
    );
  },
  findById(id: string, tenantId: string): Task | undefined {
    return readJson<Task[]>("tasks.json", []).find(
      (t) => t.id === id && t.tenant_id === tenantId && !t.deleted_at
    );
  },
  subtasksOf(parentId: string, tenantId: string): Task[] {
    return readJson<Task[]>("tasks.json", []).filter(
      (t) =>
        t.parent_task_id === parentId &&
        t.tenant_id === tenantId &&
        !t.deleted_at
    );
  },
  create(data: Omit<Task, "id" | "created_at" | "updated_at">): Task {
    const all = readJson<Task[]>("tasks.json", []);
    const task: Task = {
      ...data,
      id: uuidv4(),
      created_at: now(),
      updated_at: now(),
    };
    writeJson("tasks.json", [...all, task]);
    return task;
  },
  update(id: string, tenantId: string, patch: Partial<Task>): Task | null {
    const all = readJson<Task[]>("tasks.json", []);
    const idx = all.findIndex(
      (t) => t.id === id && t.tenant_id === tenantId && !t.deleted_at
    );
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...patch, updated_at: now() };
    writeJson("tasks.json", all);
    return all[idx];
  },
  softDelete(id: string, tenantId: string, deletedBy: string): boolean {
    const all = readJson<Task[]>("tasks.json", []);
    const idx = all.findIndex(
      (t) => t.id === id && t.tenant_id === tenantId && !t.deleted_at
    );
    if (idx === -1) return false;
    all[idx] = { ...all[idx], deleted_at: now(), deleted_by: deletedBy };
    writeJson("tasks.json", all);
    return true;
  },
};

// ─── Lookups ──────────────────────────────────────────────────────────────────

export const lookups = {
  list(tenantId: string): Lookup[] {
    return readJson<Lookup[]>("lookups.json", []).filter(
      (l) => l.tenant_id === tenantId
    );
  },
  byCategory(tenantId: string, category: string): Lookup[] {
    return this.list(tenantId).filter((l) => l.category === category);
  },
  create(tenantId: string, category: string, value: string): Lookup {
    const all = readJson<Lookup[]>("lookups.json", []);
    const sameCategory = all.filter(
      (l) => l.tenant_id === tenantId && l.category === category
    );
    const lookup: Lookup = {
      id: uuidv4(),
      tenant_id: tenantId,
      category,
      value,
      order_index: sameCategory.length,
      created_at: now(),
    };
    writeJson("lookups.json", [...all, lookup]);
    return lookup;
  },
  delete(id: string, tenantId: string): boolean {
    const all = readJson<Lookup[]>("lookups.json", []);
    const next = all.filter((l) => !(l.id === id && l.tenant_id === tenantId));
    if (next.length === all.length) return false;
    writeJson("lookups.json", next);
    return true;
  },
};

// ─── Rules ────────────────────────────────────────────────────────────────────

export const rules = {
  list(tenantId: string): Rule[] {
    return readJson<Rule[]>("rules.json", []).filter(
      (r) => r.tenant_id === tenantId
    );
  },
  findByArea(tenantId: string, area: string): Rule | undefined {
    return this.list(tenantId).find((r) => r.area === area);
  },
  upsert(tenantId: string, area: string, patch: Partial<Rule>, updatedBy: string): Rule {
    const all = readJson<Rule[]>("rules.json", []);
    const idx = all.findIndex((r) => r.tenant_id === tenantId && r.area === area);
    if (idx === -1) {
      const rule: Rule = {
        id: uuidv4(),
        tenant_id: tenantId,
        area,
        allowed_recorrencias: [],
        custom_tipos: [],
        default_tipos: [],
        custom_recorrencias: [],
        default_recorrencias: [],
        updated_at: now(),
        updated_by: updatedBy,
        ...patch,
      };
      writeJson("rules.json", [...all, rule]);
      return rule;
    }
    all[idx] = { ...all[idx], ...patch, updated_at: now(), updated_by: updatedBy };
    writeJson("rules.json", all);
    return all[idx];
  },
};
