import React, { useState, useEffect } from "react";
import { Save, ListTodo, Plus, Trash2, Download, Filter, Repeat } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { rulesApi } from "@/services/api";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_TIPOS_TAREFA } from "@/constants/defaultTipos";
import { DEFAULT_RECORRENCIAS } from "@/constants/defaultRecorrencias";
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
  const [customTiposByArea, setCustomTiposByArea] = useState<Record<string, string[]>>({});
  const [defaultTiposByArea, setDefaultTiposByArea] = useState<Record<string, string[]>>({});
  const [newCustomTipo, setNewCustomTipo] = useState<Record<string, string>>({});
  const [customRecorrenciasByArea, setCustomRecorrenciasByArea] = useState<Record<string, string[]>>({});
  const [defaultRecorrenciasByArea, setDefaultRecorrenciasByArea] = useState<Record<string, string[]>>({});
  const [newCustomRecorrencia, setNewCustomRecorrencia] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const areas = user?.role === "ADMIN" ? lookups.AREA || [] : [user?.area || ""];
  const isLeader = user?.role === "LEADER";
  /** Leader vê e edita tipos da sua área; Admin Mestre (tenantSlug definido) vê e edita tipos de cada área da empresa */
  const showTiposSection = isLeader || (user?.role === "ADMIN" && !!tenantSlug);

  useEffect(() => {
    const initCustom: Record<string, string[]> = {};
    const initDefault: Record<string, string[]> = {};
    const initCustomRec: Record<string, string[]> = {};
    const initDefaultRec: Record<string, string[]> = {};
    for (const area of areas) {
      const rule = rules.find(r => r.area === area);
      initCustom[area] = rule?.customTipos ? [...rule.customTipos] : [];
      initDefault[area] = rule?.defaultTipos ? [...rule.defaultTipos] : [];
      initCustomRec[area] = rule?.customRecorrencias ? [...rule.customRecorrencias] : [];
      initDefaultRec[area] = rule?.defaultRecorrencias ? [...rule.defaultRecorrencias] : [];
    }
    setCustomTiposByArea(initCustom);
    setDefaultTiposByArea(initDefault);
    setCustomRecorrenciasByArea(initCustomRec);
    setDefaultRecorrenciasByArea(initDefaultRec);
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

  const addCustomRecorrencia = (area: string) => {
    const name = (newCustomRecorrencia[area] ?? "").trim();
    if (!name) {
      toast("Digite o nome do tipo de recorrência.", "warning");
      return;
    }
    const list = customRecorrenciasByArea[area] || [];
    if (list.includes(name)) {
      toast("Esta recorrência já existe na lista.", "warning");
      return;
    }
    setCustomRecorrenciasByArea(prev => ({ ...prev, [area]: [...(prev[area] || []), name] }));
    setNewCustomRecorrencia(prev => ({ ...prev, [area]: "" }));
  };

  const removeCustomRecorrencia = (area: string, name: string) => {
    setCustomRecorrenciasByArea(prev => ({
      ...prev,
      [area]: (prev[area] || []).filter(r => r !== name),
    }));
  };

  const handleSave = async (
    area: string,
    payloadOverride?: {
      customTipos?: string[];
      defaultTipos?: string[];
      customRecorrencias?: string[];
      defaultRecorrencias?: string[];
    }
  ) => {
    setSaving(area);
    try {
      const rule = rules.find(r => r.area === area);
      const payload: {
        allowedRecorrencias: string[];
        customTipos?: string[];
        defaultTipos?: string[];
        customRecorrencias?: string[];
        defaultRecorrencias?: string[];
      } = {
        allowedRecorrencias: rule?.allowedRecorrencias ?? [],
      };
      if (showTiposSection) {
        payload.customTipos = payloadOverride?.customTipos ?? (customTiposByArea[area] || []);
        payload.defaultTipos = payloadOverride?.defaultTipos ?? (defaultTiposByArea[area] || []);
        payload.customRecorrencias = payloadOverride?.customRecorrencias ?? (customRecorrenciasByArea[area] || []);
        payload.defaultRecorrencias = payloadOverride?.defaultRecorrencias ?? (defaultRecorrenciasByArea[area] || []);
      }
      const res = tenantSlug
        ? await rulesApi.saveForTenant(tenantSlug, area, payload)
        : await rulesApi.save(area, payload);
      if ((res as { usedLegacySchema?: boolean }).usedLegacySchema) {
        toast(
          "Recorrências e tipos por área não foram gravados: a base ainda não tem as colunas custom_recorrencias/default_recorrencias. Execute scripts/supabase-migration-rules-recorrencias.sql no Supabase e tente novamente.",
          "error"
        );
        return;
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
    toast("Tipos adicionados. Clique em Salvar para gravar as alterações.", "info");
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
    toast("Tipos removidos da lista. Clique em Salvar para gravar as alterações.", "info");
  };

  const loadDefaultRecorrencias = (area: string) => {
    const current = customRecorrenciasByArea[area] || [];
    const currentDefault = defaultRecorrenciasByArea[area] || [];
    const toAdd = DEFAULT_RECORRENCIAS.filter(r => !current.includes(r));
    if (toAdd.length === 0) {
      toast("Todos os tipos de recorrência padrão já estão na lista.", "info");
      return;
    }
    const newCustom = [...current, ...toAdd];
    const newDefault = [...new Set([...currentDefault, ...toAdd])];
    setCustomRecorrenciasByArea(prev => ({ ...prev, [area]: newCustom }));
    setDefaultRecorrenciasByArea(prev => ({ ...prev, [area]: newDefault }));
    toast("Recorrências adicionadas. Clique em Salvar para gravar as alterações.", "info");
  };

  const removeOnlyDefaultRecorrencias = (area: string) => {
    const currentDefault = defaultRecorrenciasByArea[area] || [];
    if (currentDefault.length === 0) {
      toast("Não há tipos de recorrência padrão para excluir.", "info");
      return;
    }
    const current = customRecorrenciasByArea[area] || [];
    const newCustom = current.filter(r => !currentDefault.includes(r));
    setCustomRecorrenciasByArea(prev => ({ ...prev, [area]: newCustom }));
    setDefaultRecorrenciasByArea(prev => ({ ...prev, [area]: [] }));
    toast("Recorrências removidas da lista. Clique em Salvar para gravar as alterações.", "info");
  };

  return (
    <div className="space-y-6">
      {areas.map(area => (
        <div key={area} className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">{area}</h3>
            <Button size="sm" onClick={() => handleSave(area)} loading={saving === area} icon={<Save size={13} />}>
              Salvar
            </Button>
          </div>

          {showTiposSection && (
            <>
              {(customRecorrenciasByArea[area]?.length ?? 0) === 0 && (
                <p className="text-xs text-amber-700 mb-3">
                  Nenhum tipo de recorrência definido para esta área. Adicione recorrências abaixo ou use &quot;Carregar tipos padrão&quot; para que usuários possam criar tarefas.
                </p>
              )}
              <div className="mt-5 pt-4 border-t border-slate-200">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-2">
                  <Repeat size={14} />
                  {tenantSlug ? "Tipos de recorrência desta área" : "Tipos de recorrência da sua área"}
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  {tenantSlug
                    ? "Recorrências criadas pelo Leader para esta área. Aparecem ao criar/editar tarefas. Excluir não altera tarefas já salvas."
                    : "Crie tipos de recorrência somente para a sua área. Eles aparecem na lista ao criar/editar tarefas. Se excluir um tipo, as tarefas que já usam esse tipo mantêm o valor."}
                </p>
                <div className="flex flex-wrap gap-2 items-center mb-2">
                  <Button type="button" variant="outline" size="sm" icon={<Download size={14} />} onClick={() => loadDefaultRecorrencias(area)} disabled={saving === area}>
                    Carregar tipos padrão
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={<Filter size={14} />}
                    onClick={() => removeOnlyDefaultRecorrencias(area)}
                    disabled={saving === area || (defaultRecorrenciasByArea[area]?.length ?? 0) === 0}
                  >
                    Excluir apenas tipos padrão
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 items-end mb-2">
                  <Input
                    label=""
                    value={newCustomRecorrencia[area] ?? ""}
                    onChange={e => setNewCustomRecorrencia(prev => ({ ...prev, [area]: e.target.value }))}
                    placeholder="Nome do novo tipo de recorrência"
                    className="max-w-[200px]"
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustomRecorrencia(area))}
                  />
                  <Button type="button" size="sm" icon={<Plus size={14} />} onClick={() => addCustomRecorrencia(area)}>
                    Adicionar
                  </Button>
                </div>
                {(customRecorrenciasByArea[area]?.length ?? 0) > 0 && (
                  <ul className="flex flex-wrap gap-2 mb-0">
                    {(customRecorrenciasByArea[area] || []).map(r => (
                      <li
                        key={r}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-100 text-brand-900 border border-brand-300"
                      >
                        {r}
                        <button
                          type="button"
                          onClick={() => removeCustomRecorrencia(area, r)}
                          className="p-0.5 rounded hover:bg-brand-200"
                          aria-label={`Remover ${r}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={<Filter size={14} />}
                  onClick={() => removeOnlyDefaultTipos(area)}
                  disabled={saving === area || (defaultTiposByArea[area]?.length ?? 0) === 0}
                >
                  Excluir apenas tipos padrão
                </Button>
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
            </>
          )}
        </div>
      ))}
    </div>
  );
}