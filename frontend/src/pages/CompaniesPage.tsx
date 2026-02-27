import React, { useState, useEffect, useCallback, useRef } from "react";
import { Building2, Plus, RefreshCw, CheckCircle, XCircle, ImagePlus, Trash2, Copy, ExternalLink } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/contexts/ToastContext";
import { tenantApi } from "@/services/api";
import type { TenantListItem } from "@/types";

/** Domínio base configurado no build (ex.: fluxiva.com.br). Usado em produção (subdomínios). Vazio em dev local. */
const APP_DOMAIN = (import.meta.env.VITE_APP_DOMAIN as string | undefined) || "";

/**
 * Monta a URL de acesso da empresa para clicar, copiar e colar — mesma ideia da produção, adaptada por ambiente:
 * - Produção (subdomain):  https://empresa.fluxiva.com.br  (links e abertura no subdomínio)
 * - Staging (path-based):  https://staging.fluxiva.com.br/empresa  (links e abertura no mesmo host + path)
 * - Dev local:             /empresa
 *
 * Em staging, usa sempre a origem atual (window.location.origin) para gerar staging.fluxiva.com.br/[slug],
 * assim os links gerados no Cadastro de Empresas abrem corretamente ao clicar ou colar, com as mesmas funcionalidades.
 */
function getTenantAccessUrl(slug: string): string {
  if (!slug) return "";
  if (typeof window === "undefined") return APP_DOMAIN ? `https://${slug}.${APP_DOMAIN}` : `/${slug}`;
  const h = window.location.hostname;
  const parts = h.split(".");
  // Staging: links sempre no formato staging.fluxiva.com.br/[slug] (usa origem atual, independe do build)
  if (parts.length === 4 && parts[0].toLowerCase() === "staging") {
    const origin = window.location.origin;
    return origin ? `${origin}/${slug}` : `https://${h}/${slug}`;
  }
  // Dev local sem domínio configurado
  if (!APP_DOMAIN) return `/${slug}`;
  // Produção: subdomínio empresa.dominio
  return `https://${slug}.${APP_DOMAIN}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result || "");
    };
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

export default function CompaniesPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ slug: "", name: "" });
  const [logoUploadingId, setLogoUploadingId] = useState<string | null>(null);
  const [logoRemovingId, setLogoRemovingId] = useState<string | null>(null);
  const [logoTargetId, setLogoTargetId] = useState<string | null>(null);
  const [logoVersion, setLogoVersion] = useState<Record<string, number>>({});
  const [toggleTarget, setToggleTarget] = useState<TenantListItem | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenantApi.list();
      setTenants(res.tenants);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao carregar empresas", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleConfirm = async () => {
    if (!toggleTarget) return;
    setToggleLoading(true);
    try {
      await tenantApi.toggleActive(toggleTarget.id);
      toast(
        toggleTarget.active ? "Empresa e usuários inativados." : "Empresa reativada. Usuários que estavam ativos foram reativados.",
        "success",
      );
      setToggleTarget(null);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao alterar status.", "error");
    } finally {
      setToggleLoading(false);
    }
  };

  const handleCopyLink = (slug: string) => {
    const url = getTenantAccessUrl(slug);
    if (!url) return;
    navigator.clipboard.writeText(url).then(
      () => toast("Link copiado!", "success"),
      () => toast("Não foi possível copiar. Copie manualmente.", "error"),
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const slugNorm = form.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const nameNorm = form.name.trim();
    if (!slugNorm || !nameNorm) {
      toast("Preencha o identificador e o nome da empresa.", "error");
      return;
    }
    if (slugNorm.length > 80) {
      toast("Identificador deve ter no máximo 80 caracteres.", "error");
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugNorm)) {
      toast("Identificador deve conter apenas letras minúsculas, números e hífens (ex.: minha-empresa).", "error");
      return;
    }
    if (nameNorm.length > 200) {
      toast("Nome da empresa deve ter no máximo 200 caracteres.", "error");
      return;
    }
    setCreating(true);
    try {
      await tenantApi.create({ slug: slugNorm, name: nameNorm });
      toast("Empresa criada. Cadastre os usuários na aba Usuários.", "success");
      setForm({ slug: "", name: "" });
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao criar empresa", "error");
    } finally {
      setCreating(false);
    }
  };

  const triggerLogoUpload = (tenantId: string) => {
    setLogoTargetId(tenantId);
    fileInputRef.current?.click();
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const tenantId = logoTargetId;
    e.target.value = "";
    setLogoTargetId(null);
    if (!file || !tenantId) return;
    const mime = file.type || "image/jpeg";
    if (!/^image\/(jpeg|png|gif|webp)$/i.test(mime)) {
      toast("Use uma imagem JPEG, PNG, GIF ou WebP.", "error");
      return;
    }
    setLogoUploadingId(tenantId);
    try {
      const contentBase64 = await fileToBase64(file);
      await tenantApi.uploadLogo(tenantId, { fileName: file.name, mimeType: mime, contentBase64 });
      setLogoVersion((v) => ({ ...v, [tenantId]: Date.now() }));
      toast("Logo atualizada.", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao enviar logo", "error");
    } finally {
      setLogoUploadingId(null);
    }
  };

  const handleRemoveLogo = async (tenantId: string) => {
    setLogoRemovingId(tenantId);
    try {
      await tenantApi.removeLogo(tenantId);
      toast("Logo removida.", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao remover logo", "error");
    } finally {
      setLogoRemovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
        <div className="p-2 rounded-lg bg-brand-100 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-500/40">
          <Building2 size={24} className="text-brand-700 dark:text-brand-300" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Cadastro de empresas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Cadastre as empresas. Depois, cadastre os usuários (Líderes e Usuários) na aba Usuários e vincule cada um à empresa. Cada usuário acessa pelo link da sua empresa (ex.: site.com/empresax).
          </p>
        </div>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">Nova empresa</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Identificador (slug)"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="minha-empresa"
              maxLength={80}
            />
            <Input
              label="Nome da empresa"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Empresa X Ltda"
              maxLength={200}
            />
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Os usuários serão cadastrados na aba Usuários. Cada um acessa pelo link:{" "}
            <strong className="font-mono">{getTenantAccessUrl(form.slug.trim() || "slug")}</strong>
          </p>
          <Button type="submit" icon={<Plus size={16} />} loading={creating}>
            Cadastrar empresa
          </Button>
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Empresas cadastradas</h2>
          <Button variant="ghost" size="sm" onClick={load} icon={<RefreshCw size={14} />}>
            Atualizar
          </Button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleLogoFileChange}
            />
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-600/80">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600/80 bg-slate-50/90 dark:bg-slate-700/80">
                  <th className="pl-5 pr-4 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider w-24">Logo</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Nome</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap">Identificador / Link</th>
                  <th className="px-4 py-3.5 pr-5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-600/60 bg-white dark:bg-slate-800/30">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors">
                    <td className="pl-5 pr-4 py-3">
                      <div className="flex items-center gap-2">
                        {t.hasLogo ? (
                          <img
                            key={t.logoUpdatedAt ?? logoVersion[t.id] ?? t.id}
                            src={`/api/tenants/logo/${t.slug}?tenant=system&v=${encodeURIComponent(t.logoUpdatedAt || logoVersion[t.id] || "")}`}
                            alt=""
                            className="h-10 w-10 rounded-lg border border-slate-200 dark:border-slate-600 object-cover bg-white dark:bg-slate-700/80"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg border border-dashed border-slate-300 dark:border-slate-500 bg-slate-50 dark:bg-slate-700/80 flex items-center justify-center">
                            <Building2 size={18} className="text-slate-400 dark:text-slate-500" />
                          </div>
                        )}
                        <div className="flex flex-col gap-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => triggerLogoUpload(t.id)}
                            disabled={!!logoUploadingId}
                            loading={logoUploadingId === t.id}
                            icon={<ImagePlus size={12} />}
                          >
                            {t.hasLogo ? "Trocar" : "Enviar"}
                          </Button>
                          {t.hasLogo && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                              onClick={() => handleRemoveLogo(t.id)}
                              disabled={!!logoRemovingId}
                              loading={logoRemovingId === t.id}
                              icon={<Trash2 size={12} />}
                            >
                              Remover
                            </Button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-100">{t.name}</td>
                    <td className="px-4 py-3 min-w-0">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm text-slate-600 dark:text-slate-300 font-mono">@{t.slug}</span>
                        <div className="flex items-center gap-1">
                          <a
                            href={getTenantAccessUrl(t.slug)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-mono truncate max-w-[180px]"
                            title={getTenantAccessUrl(t.slug)}
                          >
                            <ExternalLink size={11} className="inline mr-0.5" />
                            {getTenantAccessUrl(t.slug)}
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopyLink(t.slug)}
                            title="Copiar link"
                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 flex-shrink-0"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="pl-4 pr-5 py-3">
                      <div className="flex items-center gap-2">
                        {t.active ? (
                          <>
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                              <CheckCircle size={14} /> Ativa
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300"
                              onClick={() => setToggleTarget(t)}
                              disabled={toggleLoading}
                              title="Inativar empresa e todos os usuários"
                            >
                              Inativar
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                              <XCircle size={14} /> Inativa
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300"
                              onClick={() => setToggleTarget(t)}
                              disabled={toggleLoading}
                              title="Reativar empresa (reativa apenas usuários que estavam ativos antes)"
                            >
                              Ativar
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tenants.length === 0 && (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
                Nenhuma empresa cadastrada. Use o formulário acima para cadastrar a primeira.
              </div>
            )}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!toggleTarget}
        title={toggleTarget?.active ? "Inativar empresa" : "Reativar empresa"}
        message={
          toggleTarget
            ? toggleTarget.active
              ? `Inativar "${toggleTarget.name}"? Todos os usuários (Líderes e Usuários) desta empresa serão inativados e não poderão acessar o sistema até a empresa ser reativada.`
              : `Reativar "${toggleTarget.name}"? Serão reativados apenas os usuários que estavam ativos antes da inativação.`
            : ""
        }
        confirmLabel={toggleTarget?.active ? "Inativar" : "Ativar"}
        variant={toggleTarget?.active ? "danger" : "primary"}
        loading={toggleLoading}
        onConfirm={handleToggleConfirm}
        onCancel={() => setToggleTarget(null)}
      />
    </div>
  );
}
