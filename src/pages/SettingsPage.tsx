import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CreditCard, Monitor, Moon, Settings, Sun, Trash2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const PLANS = [
  { id: "starter", name: "Starter", price: "R$ 97 / mês", limit: 50, highlight: "Entrada ideal" },
  { id: "pro", name: "Pro", price: "R$ 197 / mês", limit: 150, highlight: "Mais escolhido" },
  { id: "elite", name: "Elite", price: "R$ 397 / mês", limit: 500, highlight: "Escala máxima" },
];

const PLAN_LIMITS: Record<string, number> = {
  free: 25,
  starter: 50,
  pro: 150,
  elite: 500,
};

function getNormalizedMonthlyLimit(plan: string | null | undefined, monthlyLimit: number): number {
  if (!plan) return monthlyLimit;
  const normalized = PLAN_LIMITS[plan];
  return typeof normalized === "number" ? normalized : monthlyLimit;
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { locale, setLocale, localeNames, availableLocales, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const [quota, setQuota] = useState<Tables<"user_quotas"> | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [credits, setCredits] = useState("100");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [quotaRes, profileRes] = await Promise.all([
        supabase
          .from("user_quotas")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (quotaRes.data) {
        setQuota({
          ...quotaRes.data,
          monthly_limit: getNormalizedMonthlyLimit(quotaRes.data.plan, quotaRes.data.monthly_limit),
        });
      }
      setProfileName(profileRes.data?.full_name || "");
      setProfileEmail(profileRes.data?.email || user.email || "");
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: profileName, email: profileEmail })
      .eq("user_id", user.id);
    if (error) {
      toast.error("Erro ao atualizar perfil.");
      setSaving(false);
      return;
    }
    toast.success("Perfil atualizado com sucesso.");
    setSaving(false);
  };

  const handleDeleteHistory = async () => {
    if (!user) return;
    const confirm = window.prompt("Digite HISTORICO para confirmar exclusão completa do histórico.");
    if (confirm !== "HISTORICO") return;
    setSaving(true);
    const { error } = await supabase.from("generations").delete().eq("user_id", user.id);
    if (error) {
      toast.error("Erro ao apagar histórico.");
      setSaving(false);
      return;
    }
    toast.success("Histórico apagado.");
    setSaving(false);
  };

  const handlePlanChange = async (planId: string) => {
    if (!user) return;
    setSaving(true);
    try {
      const response = await supabase.functions.invoke("account-manage", {
        body: { action: "update_plan", payload: { plan: planId } },
      });
      if (response.error) throw response.error;
      setQuota((prev) =>
        prev ? { ...prev, plan: planId, monthly_limit: PLAN_LIMITS[planId] ?? prev.monthly_limit } : prev,
      );
      toast.success("Plano atualizado com sucesso.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao atualizar plano";
      toast.error(message);
    }
    setSaving(false);
  };

  const handleBuyCredits = async () => {
    if (!user) return;
    const amount = Number(credits);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Informe a quantidade de créditos");
      return;
    }
    setSaving(true);
    try {
      const response = await supabase.functions.invoke("account-manage", {
        body: { action: "add_credits", payload: { amount } },
      });
      if (response.error) throw response.error;
      if (response.data?.monthly_limit) {
        setQuota((prev) =>
          prev
            ? {
                ...prev,
                monthly_limit:
                  getNormalizedMonthlyLimit(prev.plan, prev.monthly_limit) + amount,
              }
            : prev,
        );
      }
      toast.success("Créditos adicionados.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao adicionar créditos";
      toast.error(message);
    }
    setSaving(false);
  };

  const handleCancelSubscription = async () => {
    if (!user) return;
    const confirm = window.confirm("Tem certeza que deseja cancelar a assinatura?");
    if (!confirm) return;
    setSaving(true);
    try {
      const response = await supabase.functions.invoke("account-manage", {
        body: { action: "cancel_subscription" },
      });
      if (response.error) throw response.error;
      setQuota((prev) => (prev ? { ...prev, plan: "free", monthly_limit: 25 } : prev));
      toast.success("Assinatura cancelada.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao cancelar assinatura";
      toast.error(message);
    }
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    const confirm = window.prompt("Digite APAGAR para confirmar a exclusão da conta.");
    if (confirm !== "APAGAR") return;
    setSaving(true);
    try {
      const response = await supabase.functions.invoke("account-manage", {
        body: { action: "delete_account" },
      });
      if (response.error) throw response.error;
      toast.success("Conta removida.");
      await signOut();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao excluir conta";
      toast.error(message);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8 animate-fade-in max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            Configurações
          </h1>
          <p className="text-muted-foreground">Gerencie planos, créditos e conta.</p>
        </div>

        <div className="glass-card rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">Perfil</h2>
          <p className="text-sm text-muted-foreground">Edite seus dados principais da conta.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Nome</Label>
              <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} />
            </div>
            <div>
              <Label>Email de perfil</Label>
              <Input value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleSaveProfile} disabled={saving}>
            Salvar perfil
          </Button>
        </div>

        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Planos e créditos</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {PLANS.map((plan) => (
              <div key={plan.id} className={`rounded-lg border border-border/60 p-4 ${quota?.plan === plan.id ? "border-primary/50" : ""}`}>
                <p className="text-sm text-muted-foreground">{plan.name}</p>
                <p className="text-xl font-semibold">{plan.price}</p>
                <p className="text-xs font-medium text-primary">{plan.limit} créditos/mês</p>
                <p className="text-xs text-muted-foreground">{plan.highlight}</p>
                <Button
                  className="mt-4 w-full"
                  variant={quota?.plan === plan.id ? "default" : "outline"}
                  onClick={() => handlePlanChange(plan.id)}
                  disabled={saving}
                >
                  {quota?.plan === plan.id ? "Plano atual" : "Selecionar"}
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">Comprar créditos extras</h2>
          <p className="text-sm text-muted-foreground">
            Créditos extras aumentam seu limite mensal imediatamente.
          </p>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <Label>Quantidade de créditos</Label>
              <Input value={credits} onChange={(e) => setCredits(e.target.value)} />
            </div>
            <Button className="self-end" onClick={handleBuyCredits} disabled={saving}>
              Adicionar créditos
            </Button>
          </div>
          {quota && (
            <p className="text-xs text-muted-foreground">
              Limite atual: {getNormalizedMonthlyLimit(quota.plan, quota.monthly_limit)} créditos/mês.
            </p>
          )}
        </div>

        <div className="glass-card rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">Assinatura</h2>
          <p className="text-sm text-muted-foreground">
            Cancele sua assinatura e volte para o plano free.
          </p>
          <Button variant="outline" onClick={handleCancelSubscription} disabled={saving}>
            Cancelar assinatura
          </Button>
        </div>

        <div className="glass-card rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">{t("settings.theme")}</h2>
          <p className="text-sm text-muted-foreground">{t("settings.appearance")}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              className="justify-start"
              onClick={() => setTheme("light")}
            >
              <Sun className="mr-2 h-4 w-4" />
              {t("settings.light")}
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              className="justify-start"
              onClick={() => setTheme("dark")}
            >
              <Moon className="mr-2 h-4 w-4" />
              {t("settings.dark")}
            </Button>
            <Button
              variant={theme === "system" ? "default" : "outline"}
              className="justify-start"
              onClick={() => setTheme("system")}
            >
              <Monitor className="mr-2 h-4 w-4" />
              {t("settings.system")}
            </Button>
          </div>
        </div>

        <div className="glass-card rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">{t("settings.languageTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("settings.languageSubtitle")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {availableLocales.map((l) => (
              <Button
                key={l}
                variant={locale === l ? "default" : "outline"}
                className="justify-start"
                onClick={() => setLocale(l)}
              >
                {localeNames[l]}
              </Button>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-xl p-6 space-y-4 border border-destructive/40">
          <h2 className="text-lg font-semibold text-destructive flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Histórico
          </h2>
          <p className="text-sm text-muted-foreground">
            Exclua todo o histórico de geração da sua conta.
          </p>
          <Button variant="outline" onClick={handleDeleteHistory} disabled={saving}>
            Apagar histórico completo
          </Button>
        </div>

        <div className="glass-card rounded-xl p-6 space-y-4 border border-destructive/40">
          <h2 className="text-lg font-semibold text-destructive flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Apagar conta
          </h2>
          <p className="text-sm text-muted-foreground">
            Esta ação é irreversível. Todos os dados serão removidos.
          </p>
          <Button variant="destructive" onClick={handleDeleteAccount} disabled={saving}>
            Apagar minha conta
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
