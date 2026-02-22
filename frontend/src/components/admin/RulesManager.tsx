import React, { useState, useEffect } from "react";
import { Save, CheckSquare, Square, ListTodo, Plus, Trash2, Download, Filter } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { rulesApi } from "@/services/api";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_TIPOS_TAREFA } from "@/constants/defaultTipos";
import type { Rule, Lookups } from "@/types";

interface RulesManagerProps {
  rules: Rule[];
  lookups: Lookups;
  onRefresh: () => void;
  /** Quando definido (Admin Mestre editando uma empresa), salva regras para essa empresa. */
  tenantSlug?: string;
}

export default function RulesManager({ rules, lookups, onRefresh, tenantSlug }: RulesManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [customTiposByArea, setCustomTiposByArea] = useState<Record<string, string[]>>({});
  const [defaultTiposByArea, setDefaultTiposByArea] = useState<Record<string, string[]>>({});
  const [newCustomTipo, setNewCustomTipo] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const areas = user?.role === "ADMIN" ? lookups.AREA || [] : [user?.area || ""];
  const recorrencias = lookups.RECORRENCIA || [];
  const isLeader = user?.role === "LEADER";
  /** Leader vê e edita tipos da sua área; Admin Mestre (tenantSlug definido) vê e edita tipos de cada área da empresa */
  const showTiposSection = isLeader || (user?.role === "ADMIN" && !!tenantSlug);

  useEffect(() => {
    const init: Record<string, Set<string>> = {};
    const initCustom: Record<string, string[]> = {};
    const initDefault: Record<string, string[]> = {};
    for (const area of areas) {
      const rule = rules.find(r => r.area === area);
      init[area] = new Set(rule?.allowedRecorrencias || []);
      initCustom[area] = rule?.customTipos ? [...rule.customTipos] : [];
      initDefault[area] = rule?.defaultTipos ? [...rule.defaultTipos] : [];
    }
    setSelected(init);
    setCustomTiposByArea(initCustom);
    setDefaultTiposByArea(initDefault);
  }, [rules, areas.join(",")]);

  const addCustomTipo = (area: string) => {
    const name = (newCustomTipo[area] ?? "").trim();
    if (!name) {
      toast("Digite o nome do tipo.", "warning");
      return;
    }
    const list = customTiposByArea[area] || [];
    if (list.includes(name)) {
      toast("Este tipo já existe na lista.", "warning");
      return;
    }
    setCustomTiposByArea(prev => ({ ...prev, [area]: [...(prev[area] || []), name] }));
    setNewCustomTipo(prev => ({ ...prev, [area]: "" }));
  };

  const removeCustomTipo = (area: string, name: string) => {
    setCustomTiposByArea(prev => ({
      ...prev,
      [area]: (prev[area] || []).filter(t => t !== name),
    }));
  };

  const toggleRecorrencia = (area: string, rec: string) => {
    setSelected(prev => {
      const set = new Set(prev[area] || []);
      if (set.has(rec)) set.delete(rec);
      else set.add(rec);
      return { ...prev, [area]: set };
    });
  };

  const setAllRecorrencias = (area: string, value: boolean) => {
    setSelected(prev => ({
      ...prev,
      [area]: value ? new Set(recorrencias) : new Set<string>(),
    }));
  };

  const handleSave = async (area: string, payloadOverride?: { customTipos?: string[]; defaultTipos?: string[] }) => {
    setSaving(area);
    try {
      const allowed = Array.from(selected[area] || []);
      const payload: { allowedRecorrencias: string[]; customTipos?: string[]; defaultTipos?: string[] } = { allowedRecorrencias: allowed };
      if (showTiposSection) {
        payload.customTipos = payloadOverride?.customTipos ?? (customTiposByArea[area] || []);
        payload.defaultTipos = payloadOverride?.defaultTipos ?? (defaultTiposByArea[area] || []);
      }
      if (tenantSlug) {
        await rulesApi.saveForTenant(tenantSlug, area, payload);
      } else {
        await rulesApi.save(area, payload);
      }
      onRefresh();
      toast(`Regras de "${area}" salvas com sucesso`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao salvar regras", "error");
    } finally {
      setSaving(null);
    }
  };

  const loadDefaultTipos = (area: string) => {
    const current = customTiposByArea[area] || [];
    const currentDefault = defaultTiposByArea[area] || [];
    const toAdd = DEFAULT_TIPOS_TAREFA.filter(t => !current.includes(t));
    if (toAdd.length === 0) {
      toast("Todos os tipos padrão já estão na lista.", "info");
      return;
    }
    const newCustom = [...current, ...toAdd];
    const newDefault = [...new Set([...currentDefault, ...toAdd])];
    setCustomTiposByArea(prev => ({ ...prev, [area]: newCustom }));
    setDefaultTiposByArea(prev => ({ ...prev, [area]: newDefault }));
    handleSave(area, { customTipos: newCustom, defaultTipos: newDefault });
  };

  const removeOnlyDefaultTipos = (area: string) => {
    const currentDefault = defaultTiposByArea[area] || [];
    if (currentDefault.length === 0) {
      toast("Não há tipos padrão para excluir.", "info");
      return;
    }
    const current = customTiposByArea[area] || [];
    const newCustom = current.filter(t => !currentDefault.includes(t));
    setCustomTiposByArea(prev => ({ ...prev, [area]: newCustom }));
    setDefaultTiposByArea(prev => ({ ...prev, [area]: [] }));
    handleSave(area, { customTipos: newCustom, defaultTipos: [] });
  };

  return (
    <div className="space-y-6">
      {areas.map(area => (
        <div key={area} className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">{area}</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 font-medium">
                {(selected[area]?.size || 0)} recorrência{(selected[area]?.size || 0) !== 1 ? "s" : ""} permitida{(selected[area]?.size || 0) !== 1 ? "s" : ""}
              </span>
              <Button size="sm" onClick={() => handleSave(area)} loading={saving === area} icon={<Save size={13} />}>
                Salvar
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-500 mr-1">Recorrências:</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAllRecorrencias(area, true)} className="text-xs">
              Marcar todas
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAllRecorrencias(area, false)} className="text-xs">
              Desmarcar todas
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {recorrencias.map(rec => {
              const isSelected = selected[area]?.has(rec) || false;
              return (
                <button
                  key={rec}
                  onClick={() => toggleRecorrencia(area, rec)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                    ${
                      isSelected
                        ? "bg-brand-100 text-brand-900 border-2 border-brand-500 shadow-sm"
                        : "bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400 hover:text-slate-900 hover:bg-white"
                    }
                  `}
                >
                  {isSelected ? <CheckSquare size={12} /> : <Square size={12} />}
                  {rec}
                </button>
              );
            })}
          </div>

          {(selected[area]?.size || 0) === 0 && (
            <p className="text-xs text-amber-700 mt-2">
              Nenhuma recorrência selecionada. Usuários desta área não poderão criar tarefas.
            </p>
          )}

          {showTiposSection && (
            <div className="mt-5 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-2">
                <ListTodo size={14} />
                {tenantSlug ? "Tipos de atividade desta área" : "Tipos de atividade da sua área"}
              </div>
              <p className="text-xs text-slate-500 mb-2">
                {tenantSlug
                  ? "Tipos criados pelo Leader para esta área. Visíveis ao criar/editar tarefas. Excluir não altera tarefas já salvas."
                  : "Crie tipos de atividade somente para a sua área. Eles aparecem na lista ao criar/editar tarefas. Se excluir um tipo, as tarefas que já usam esse tipo mantêm o valor (indicadores e exibição permanecem corretos)."}
              </p>
              <div className="flex flex-wrap gap-2 items-center mb-2">
                <Button type="button" variant="outline" size="sm" icon={<Download size={14} />} onClick={() => loadDefaultTipos(area)} disabled={saving === area}>
                  Carregar tipos padrão
                </Button>
                {(defaultTiposByArea[area]?.length ?? 0) > 0 && (
                  <Button type="button" variant="outline" size="sm" icon={<Filter size={14} />} onClick={() => removeOnlyDefaultTipos(area)} disabled={saving === area}>
                    Excluir apenas tipos padrão
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 items-end mb-2">
                <Input
                  label=""
                  value={newCustomTipo[area] ?? ""}
                  onChange={e => setNewCustomTipo(prev => ({ ...prev, [area]: e.target.value }))}
                  placeholder="Nome do novo tipo"
                  className="max-w-[200px]"
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustomTipo(area))}
                />
                <Button type="button" size="sm" icon={<Plus size={14} />} onClick={() => addCustomTipo(area)}>
                  Adicionar
                </Button>
              </div>
              {(customTiposByArea[area]?.length ?? 0) > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {(customTiposByArea[area] || []).map(t => (
                    <li
                      key={t}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-100 text-brand-900 border border-brand-300"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => removeCustomTipo(area, t)}
                        className="p-0.5 rounded hover:bg-brand-200"
                        aria-label={`Remover ${t}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}