/**
 * Serialização snake_case → camelCase para respostas da demo.
 *
 * O frontend espera as entidades em camelCase (Task.competenciaYm, etc.),
 * mas o repositório JSON usa snake_case internamente.
 */
import type { Task, User, Lookup, Rule } from "../../demo/repository";

export function serializeTask(t: Task) {
  return {
    id: t.id,
    tenantId: t.tenant_id,
    competenciaYm: t.competencia_ym,
    recorrencia: t.recorrencia,
    tipo: t.tipo,
    atividade: t.atividade,
    responsavelEmail: t.responsavel_email,
    responsavelNome: t.responsavel_nome,
    area: t.area,
    prazo: t.prazo,
    realizado: t.realizado,
    status: t.status,
    observacoes: t.observacoes,
    parentTaskId: t.parent_task_id ?? null,
    justificationBlocked: t.justification_blocked,
    createdAt: t.created_at,
    createdBy: t.created_by,
    updatedAt: t.updated_at,
    updatedBy: t.updated_by,
  };
}

export function serializeUser(u: User) {
  return {
    id: u.id,
    tenantId: u.tenant_id,
    email: u.email,
    nome: u.nome,
    role: u.role,
    area: u.area,
    active: u.active,
    canDelete: u.can_delete,
    mustChangePassword: u.must_change_password,
    createdAt: u.created_at,
    lastLoginAt: u.last_login_at ?? null,
  };
}

export function serializeLookup(l: Lookup) {
  return {
    id: l.id,
    tenantId: l.tenant_id,
    category: l.category,
    value: l.value,
    orderIndex: l.order_index,
    createdAt: l.created_at,
  };
}

export function serializeRule(r: Rule) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    area: r.area,
    allowedRecorrencias: r.allowed_recorrencias,
    customTipos: r.custom_tipos,
    defaultTipos: r.default_tipos,
    customRecorrencias: r.custom_recorrencias,
    defaultRecorrencias: r.default_recorrencias,
    updatedAt: r.updated_at,
    updatedBy: r.updated_by,
  };
}
