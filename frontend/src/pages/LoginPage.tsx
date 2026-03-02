import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ThemeSwitch from "@/components/ui/ThemeSwitch";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useBasePath } from "@/contexts/BasePathContext";
import { authApi, tenantApi, getTenantSlugFromUrl } from "@/services/api";
import TenantLogo from "@/components/ui/TenantLogo";
import LoginIllustration from "@/components/login/LoginIllustration";

type Mode = "login" | "requestReset" | "reset";

export default function LoginPage() {
  const { user, loading, login, refreshSession, tenant } = useAuth();
  const { toast } = useToast();
  const basePath = useBasePath();
  const [currentTenant, setCurrentTenant] = useState<{ name: string; logoUpdatedAt?: string | null } | null>(null);
  // Em modo subdomínio, basePath é sempre "" — usar o tenant da URL para distinguir sistema vs empresa
  const isSystemContext = getTenantSlugFromUrl() === "system";

  useEffect(() => {
    tenantApi.current().then((r) => setCurrentTenant({ name: r.tenant.name, logoUpdatedAt: r.tenant.logoUpdatedAt })).catch(() => setCurrentTenant(null));
  }, []);

  const [mode, setMode] = useState<Mode>("login");
  const [form, setForm] = useState({ email: "", password: "", code: "", newPassword: "" });
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetInfo, setResetInfo] = useState<{ firstAccess: boolean } | null>(null);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  if (!loading && user) {
    const isSystemAdmin = tenant?.slug === "system" && user.role === "ADMIN";
    return <Navigate to={isSystemAdmin ? `${basePath}/sistema` : `${basePath}/calendar`} replace />;
  }

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast("Preencha email e senha", "warning");
      return;
    }

    setSubmitting(true);
    try {
      await login(form.email, form.password);
    } catch (err: unknown) {
      const e = err as Error & { code?: string; meta?: { firstAccess?: boolean } };
      const code = e?.code;
      const msg = (e?.message ?? "") as string;

      // Prioridade: 1) Inativado, 2) Login incorreto, 3) Senha incorreta, 4) Reset obrigatório, 5) genérico
      if (code === "INACTIVE" || /inativo/i.test(msg)) {
        toast("Sua conta está desativada. Entre em contato com o administrador.", "error");
      } else if (code === "NO_USER" || /não cadastrado|não encontrado/i.test(msg)) {
        toast("E-mail não encontrado ou incorreto. Verifique e tente novamente.", "error");
      } else if (code === "BAD_CREDENTIALS" || /credenciais inválidas/i.test(msg)) {
        toast("Senha incorreta. Tente novamente.", "error");
      } else if (code === "RESET_REQUIRED" && !isSystemContext) {
        setMode("reset");
        setResetInfo({ firstAccess: !!e.meta?.firstAccess });
        toast("Você precisa definir sua senha antes de continuar", "warning");
      } else if (code === "RESET_REQUIRED" && isSystemContext) {
        toast("Não foi possível entrar. Entre em contato com o suporte.", "error");
      } else {
        toast(msg || "Não foi possível entrar. Tente novamente.", "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = form.email?.trim();
    if (!email) {
      toast("Informe o e-mail", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const data = await authApi.requestReset(email);
      toast(data?.message ?? "Se o e-mail estiver cadastrado e ativo, você receberá o código em instantes. Verifique sua caixa de entrada.", "success");
      setResetEmailSent(true);
      setMode("reset");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao solicitar código", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.code || !form.newPassword) {
      toast("Preencha todos os campos", "warning");
      return;
    }
    if (form.newPassword.length < 6) {
      toast("Senha deve ter pelo menos 6 caracteres", "warning");
      return;
    }

    setSubmitting(true);
    try {
      await authApi.reset(form.email, form.code, form.newPassword);
      await refreshSession();
      toast("Senha definida com sucesso! Bem-vindo(a).", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Código inválido ou expirado", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const isAdminLogin = isSystemContext;
  const showRequestResetForm = mode === "requestReset" && !isAdminLogin;
  const showResetForm = mode === "reset" && !isAdminLogin;

  const formCard = (
    <div
      className={`
        bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm
        border border-slate-200/90 dark:border-slate-600/70
        rounded-2xl shadow-2xl shadow-slate-300/30 dark:shadow-black/30
        ring-1 ring-slate-100 dark:ring-slate-700/50
        w-full max-w-[420px]
      `}
    >
          <div className="p-8 pb-7">
            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                    {isAdminLogin ? "Acesso ao sistema" : "Entrar na sua conta"}
                  </h2>
                  {!isAdminLogin && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Use seu e-mail corporativo para acessar
                    </p>
                  )}
                </div>

                <Input
                  label="E-mail"
                  type="email"
                  required
                  value={form.email}
                  onChange={e => set("email", e.target.value)}
                  placeholder={isAdminLogin ? "" : "seu.email@empresa.com"}
                  autoComplete="email"
                  autoFocus
                />

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Senha <span className="text-rose-500" aria-hidden>*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      required
                      value={form.password}
                      onChange={e => set("password", e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full rounded-lg bg-white dark:bg-slate-700/90 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                      aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="pt-1">
                  <Button type="submit" className="w-full" size="lg" loading={submitting}>
                    Entrar
                  </Button>
                </div>

                {!isAdminLogin && (
                  <p className="text-center text-xs text-slate-500 dark:text-slate-400 pt-1">
                    Esqueceu a senha?{" "}
                    <button
                      type="button"
                      onClick={() => { setMode("requestReset"); setResetEmailSent(false); }}
                      className="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium transition-colors underline-offset-2 hover:underline"
                    >
                      Redefinir acesso
                    </button>
                  </p>
                )}
              </form>
            ) : showRequestResetForm ? (
              <form onSubmit={handleRequestReset} className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                    Redefinir acesso
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Informe o e-mail da conta. Enviaremos um código de verificação (válido por 30 minutos).
                  </p>
                </div>

                <Input
                  label="E-mail"
                  type="email"
                  required
                  value={form.email}
                  onChange={e => set("email", e.target.value)}
                  placeholder="seu.email@empresa.com"
                  autoComplete="email"
                  autoFocus
                />

                <div className="pt-1 space-y-3">
                  <Button type="submit" className="w-full" size="lg" loading={submitting}>
                    Enviar código por e-mail
                  </Button>
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors border border-slate-200 dark:border-slate-600"
                  >
                    <ArrowLeft size={16} />
                    Voltar
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleReset} className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                    {resetInfo?.firstAccess ? "Primeiro acesso" : "Redefinir senha"}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Código de verificação e nova senha
                  </p>
                </div>

                <Input
                  label="E-mail"
                  type="email"
                  required
                  value={form.email}
                  onChange={e => set("email", e.target.value)}
                  placeholder="email@empresa.com"
                  readOnly={resetEmailSent}
                  className={resetEmailSent ? "bg-slate-50 dark:bg-slate-700/50" : undefined}
                />

                <Input
                  label="Código"
                  required
                  value={form.code}
                  onChange={e => set("code", e.target.value.toUpperCase())}
                  placeholder="••••••••"
                  className="font-mono tracking-wider text-center"
                  maxLength={8}
                />

                <Input
                  label="Nova senha"
                  type="password"
                  required
                  value={form.newPassword}
                  onChange={e => set("newPassword", e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                />

                <div className="pt-1 space-y-3">
                  <Button type="submit" className="w-full" size="lg" loading={submitting}>
                    Definir senha e entrar
                  </Button>
                  <button
                    type="button"
                    onClick={() => { setMode("login"); setResetEmailSent(false); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors border border-slate-200 dark:border-slate-600"
                  >
                    <ArrowLeft size={16} />
                    Voltar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
  );

  if (isAdminLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden login-page-bg">
        <div className="absolute top-4 right-4 z-10">
          <ThemeSwitch />
        </div>
        <div className="w-full max-w-[420px] relative z-0">
          <div className="mt-10">{formCard}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden login-page-bg">
      <div className="absolute top-4 right-4 z-10 lg:left-4 lg:right-auto">
        <ThemeSwitch />
      </div>

      {/* Painel lateral — ilustração + logo + títulos (desktop); largura fixa para reduzir gap */}
      <aside className="hidden lg:flex lg:min-h-screen flex-col justify-center lg:w-[min(50%,28rem)] xl:w-[min(50%,32rem)] shrink-0 px-6 xl:px-10 py-8 xl:py-10">
        <div className="max-w-sm w-full">
          <LoginIllustration />
          <div className="mt-6 xl:mt-8 flex flex-col">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-white dark:bg-slate-800/95 shadow-lg shadow-slate-200/60 dark:shadow-slate-900/40 ring-1 ring-slate-200/80 dark:ring-slate-600/60 flex items-center justify-center overflow-hidden">
                <TenantLogo
                  tenantSlug={getTenantSlugFromUrl()}
                  logoVersion={currentTenant?.logoUpdatedAt}
                  alt="Task Manager"
                  size="h-11 w-11"
                  className="rounded-xl border-0"
                />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                  Task Manager
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Gestão de tarefas e entregas
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-400 dark:text-slate-500 truncate max-w-xs border-l-2 border-brand-500/50 dark:border-brand-400/50 pl-3">
              {currentTenant?.name ?? (tenant?.name || "Carregando…")}
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile: header com logo e títulos (mesmo padrão visual) */}
      <div className="lg:hidden pt-6 pb-3 px-4 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white dark:bg-slate-800/95 shadow-lg ring-1 ring-slate-200/80 dark:ring-slate-600/50 overflow-hidden">
          <TenantLogo
            tenantSlug={getTenantSlugFromUrl()}
            logoVersion={currentTenant?.logoUpdatedAt}
            alt="Task Manager"
            size="h-11 w-11"
            className="rounded-xl border-0"
          />
        </div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight mt-3">
          Task Manager
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Gestão de tarefas e entregas
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 truncate max-w-[18rem] mx-auto">
          {currentTenant?.name ?? (tenant?.name || "Carregando…")}
        </p>
      </div>

      {/* Área do formulário — padding lateral menor para aproximar do painel */}
      <main className="flex-1 flex items-center justify-center p-4 lg:py-8 lg:px-6 xl:px-10 min-w-0">
        <div className="w-full max-w-[420px] flex flex-col items-center">
          {formCard}
          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 mt-6 tracking-wide">
            Task Manager · v2.0
          </p>
        </div>
      </main>
    </div>
  );
}
