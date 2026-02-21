import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAccountStatus } from "@/hooks/useAccountStatus";
import { useI18n } from "@/hooks/useI18n";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Shield, Users, Package, Search, RefreshCw, Globe2, Save, CreditCard, DollarSign, Download, ExternalLink, Trash2, Ban, CheckCircle2, Monitor, Smartphone } from "lucide-react";
import type { Json, Tables, TablesInsert } from "@/integrations/supabase/types";

type UserProfile = Tables<"profiles">;
type UserQuota = Tables<"user_quotas">;
type BuildRow = Tables<"builds">;
type LandingSettings = Tables<"landing_settings">;
type AccountStatus = "active" | "past_due" | "suspended";
type Plan = "free" | "starter" | "pro" | "elite";

const PLAN_LIMITS: Record<Plan, number> = {
  free: 25,
  starter: 50,
  pro: 150,
  elite: 500,
};

const PLAN_PRICES_BRL: Record<Plan, number> = {
  free: 0,
  starter: 97,
  pro: 197,
  elite: 397,
};

type SubscriptionFilterStatus = "all" | "active" | "past_due" | "suspended" | "canceled";
type UsageFilter = "all" | "high" | "medium" | "low";
type SubscriptionSort = "name" | "usage_desc" | "usage_asc" | "spend_desc" | "spend_asc";

type SubscriptionRow = {
  id: string;
  userId: string;
  email: string;
  name: string;
  plan: Plan;
  accountStatus: AccountStatus;
  monthlyLimit: number;
  generationsUsed: number;
  usagePercent: number;
  estimatedMonthlySpend: number;
  createdAt: string;
  isCanceled: boolean;
};

function getNormalizedMonthlyLimit(plan: Plan, monthlyLimit: number): number {
  const normalized = PLAN_LIMITS[plan];
  return typeof normalized === "number" ? normalized : monthlyLimit;
}

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function downloadCsv(filename: string, rows: string[][]): void {
  const escaped = rows.map((row) =>
    row
      .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = escaped.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getProjectNameFromBuildJson(buildJson: Json | null): string {
  if (!buildJson || typeof buildJson !== "object" || Array.isArray(buildJson)) return "Build";
  const value = (buildJson as Record<string, unknown>).project_name;
  return typeof value === "string" ? value : "Build";
}

export default function AdminPage() {
  const { user } = useAuth();
  const { isAdmin, loading: statusLoading } = useAccountStatus();
  const { t } = useI18n();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [quotasByUserId, setQuotasByUserId] = useState<Record<string, UserQuota>>({});
  const [builds, setBuilds] = useState<BuildRow[]>([]);
  const [landingSettings, setLandingSettings] = useState<LandingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingLanding, setSavingLanding] = useState(false);
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [subscriptionSearch, setSubscriptionSearch] = useState("");
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState<SubscriptionFilterStatus>("all");
  const [subscriptionPlanFilter, setSubscriptionPlanFilter] = useState<"all" | Plan>("all");
  const [subscriptionUsageFilter, setSubscriptionUsageFilter] = useState<UsageFilter>("all");
  const [subscriptionSort, setSubscriptionSort] = useState<SubscriptionSort>("usage_desc");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const heroSectionRef = useRef<HTMLDivElement | null>(null);
  const ctaSectionRef = useRef<HTMLDivElement | null>(null);
  const installSectionRef = useRef<HTMLDivElement | null>(null);
  const plansSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (statusLoading || !isAdmin) return;
    loadData();
  }, [isAdmin, statusLoading]);

  const loadData = async (showToast = false) => {
    setLoading(true);
    const warnings: string[] = [];
    const [usersRes, quotasRes, buildsRes, landingRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("user_quotas").select("*").limit(1000),
      supabase.from("builds").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("landing_settings").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (usersRes.data) setUsers(usersRes.data);
    if (quotasRes.data) {
      const mapped = quotasRes.data.reduce<Record<string, UserQuota>>((acc, row) => {
        acc[row.user_id] = row;
        return acc;
      }, {});
      setQuotasByUserId(mapped);
    }
    if (buildsRes.data) setBuilds(buildsRes.data);
    if (usersRes.error) warnings.push("Usuários");
    if (quotasRes.error) warnings.push("Créditos");
    if (buildsRes.error) warnings.push("Builds");
    if (landingRes.error) warnings.push("Configuração da landing");

    if (landingRes.data) {
      setLandingSettings(landingRes.data);
    } else if (landingRes.error) {
      setLandingSettings(null);
    }

    setLoadWarnings(warnings);
    if (showToast && warnings.length > 0) {
      toast.error(`Alguns blocos não carregaram: ${warnings.join(", ")}`);
    }
    setLoading(false);
  };

  const saveLandingSettings = async () => {
    if (!landingSettings?.id || !user?.id) return;
    setSavingLanding(true);
    const payload = {
      hero_badge: landingSettings.hero_badge,
      hero_title: landingSettings.hero_title,
      hero_subtitle: landingSettings.hero_subtitle,
      cta_primary_text: landingSettings.cta_primary_text,
      cta_secondary_text: landingSettings.cta_secondary_text,
      install_banner_enabled: landingSettings.install_banner_enabled,
      starter_price: landingSettings.starter_price,
      starter_credits: landingSettings.starter_credits,
      pro_price: landingSettings.pro_price,
      pro_credits: landingSettings.pro_credits,
      elite_price: landingSettings.elite_price,
      elite_credits: landingSettings.elite_credits,
      updated_by: user.id,
    };
    const { error } = await supabase
      .from("landing_settings")
      .update(payload)
      .eq("id", landingSettings.id);

    if (error) {
      toast.error("Erro ao salvar configurações da landing.");
      setSavingLanding(false);
      return;
    }

    const auditPayload: TablesInsert<"audit_logs"> = {
      actor_user_id: user.id,
      action: "landing_settings_updated",
      entity_type: "landing_settings",
      entity_id: landingSettings.id,
    };
    await supabase.from("audit_logs").insert(auditPayload);
    toast.success("Landing atualizada com sucesso.");
    setSavingLanding(false);
    loadData(false);
  };

  const updateUserPlan = async (userId: string, plan: Plan) => {
    const monthlyLimit = PLAN_LIMITS[plan];
    const { error: quotaError } = await supabase
      .from("user_quotas")
      .update({ plan, monthly_limit: monthlyLimit })
      .eq("user_id", userId);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ plan })
      .eq("user_id", userId);

    if (quotaError || profileError) {
      toast.error("Não foi possível atualizar o plano");
      return;
    }

    if (user?.id) {
      const payload: TablesInsert<"audit_logs"> = {
        actor_user_id: user.id,
        target_user_id: userId,
        action: `plan_changed_to_${plan}`,
        entity_type: "user_quota",
        entity_id: userId,
        meta_json: { plan, monthly_limit: monthlyLimit },
      };
      await supabase.from("audit_logs").insert(payload);
    }

    toast.success(`Plano atualizado para ${plan.toUpperCase()}.`);
    loadData(false);
  };

  const updateAccountStatus = async (userId: string, status: AccountStatus) => {
    const { error } = await supabase
      .from("profiles")
      .update({ account_status: status })
      .eq("user_id", userId);

    if (error) {
      toast.error(t("admin.actionError"));
      return;
    }

    if (user?.id) {
      const payload: TablesInsert<"audit_logs"> = {
        actor_user_id: user.id,
        target_user_id: userId,
        action: `status_changed_to_${status}`,
        entity_type: "profile",
        entity_id: userId,
        meta_json: { new_status: status },
      };
      await supabase.from("audit_logs").insert(payload);
    }

    toast.success(`Status atualizado para ${status}.`);
    loadData(false);
  };

  const resetQuota = async (userId: string) => {
    const { error } = await supabase
      .from("user_quotas")
      .update({ generations_used: 0 })
      .eq("user_id", userId);

    if (error) {
      toast.error(t("admin.actionError"));
      return;
    }

    if (user?.id) {
      const payload: TablesInsert<"audit_logs"> = {
        actor_user_id: user.id,
        target_user_id: userId,
        action: "quota_reset",
        entity_type: "user_quota",
        entity_id: userId,
      };
      await supabase.from("audit_logs").insert(payload);
    }

    toast.success("Créditos resetados com sucesso.");
    loadData(false);
  };

  const clearUserHistory = async (userId: string) => {
    const confirmed = window.confirm("Excluir todo o histórico deste usuário?");
    if (!confirmed) return;
    const [buildsDeleteRes, generationsDeleteRes] = await Promise.all([
      supabase.from("builds").delete().eq("user_id", userId),
      supabase.from("generations").delete().eq("user_id", userId),
    ]);

    if (buildsDeleteRes.error || generationsDeleteRes.error) {
      toast.error(
        buildsDeleteRes.error?.message ||
          generationsDeleteRes.error?.message ||
          "Erro ao excluir histórico do usuário.",
      );
      return;
    }

    if (user?.id) {
      await supabase.from("audit_logs").insert({
        actor_user_id: user.id,
        target_user_id: userId,
        action: "admin_clear_user_history",
        entity_type: "history",
        entity_id: userId,
      });
    }

    toast.success("Histórico do usuário excluído.");
    loadData(false);
  };

  const toggleBillingBlock = async (userId: string, email: string, currentStatus: AccountStatus) => {
    const nextStatus: AccountStatus = currentStatus === "suspended" ? "active" : "suspended";
    const actionText = nextStatus === "suspended" ? "bloquear por inadimplência" : "reativar";
    const confirmed = window.confirm(`Deseja ${actionText} o usuário ${email || userId}?`);
    if (!confirmed) return;
    await updateAccountStatus(userId, nextStatus);
  };

  const scrollToSection = (section: "hero" | "cta" | "install" | "plans") => {
    const refs = {
      hero: heroSectionRef.current,
      cta: ctaSectionRef.current,
      install: installSectionRef.current,
      plans: plansSectionRef.current,
    } as const;
    refs[section]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (statusLoading || loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Shield className="h-12 w-12 text-destructive" />
          <p className="text-muted-foreground">{t("admin.noAccess")}</p>
        </div>
      </AppLayout>
    );
  }

  const filteredUsers = users.filter(
    (userRow) =>
      (userRow.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (userRow.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const activeUsers = users.filter((userRow) => userRow.account_status === "active" || !userRow.account_status).length;
  const suspendedUsers = users.filter((userRow) => userRow.account_status === "suspended").length;
  const paidUsers = users.filter((userRow) => (userRow.plan || "free") !== "free").length;
  const freeUsers = users.filter((userRow) => (userRow.plan || "free") === "free").length;
  const totalCreditsLimit = users.reduce((acc, userRow) => {
    const quota = quotasByUserId[userRow.user_id];
    return acc + (quota?.monthly_limit ?? PLAN_LIMITS[(userRow.plan as Plan) || "free"] ?? 0);
  }, 0);
  const totalCreditsUsed = users.reduce((acc, userRow) => {
    const quota = quotasByUserId[userRow.user_id];
    return acc + (quota?.generations_used ?? 0);
  }, 0);
  const avgUsage = totalCreditsLimit > 0 ? Math.round((totalCreditsUsed / totalCreditsLimit) * 100) : 0;
  const subscriptionRows: SubscriptionRow[] = users.map((userRow) => {
    const plan = ((userRow.plan as Plan) || "free") as Plan;
    const quota = quotasByUserId[userRow.user_id];
    const monthlyLimit = getNormalizedMonthlyLimit(plan, quota?.monthly_limit ?? PLAN_LIMITS[plan]);
    const generationsUsed = quota?.generations_used ?? 0;
    const usagePercent = monthlyLimit > 0 ? Math.min(999, Math.round((generationsUsed / monthlyLimit) * 100)) : 0;
    const accountStatus = ((userRow.account_status as AccountStatus) || "active") as AccountStatus;
    return {
      id: userRow.id,
      userId: userRow.user_id,
      email: userRow.email || "",
      name: userRow.full_name || "—",
      plan,
      accountStatus,
      monthlyLimit,
      generationsUsed,
      usagePercent,
      estimatedMonthlySpend: PLAN_PRICES_BRL[plan],
      createdAt: userRow.created_at,
      isCanceled: plan === "free",
    };
  });

  const filteredSubscriptions = subscriptionRows
    .filter((row) => {
      const term = subscriptionSearch.trim().toLowerCase();
      if (!term) return true;
      return row.email.toLowerCase().includes(term) || row.name.toLowerCase().includes(term);
    })
    .filter((row) => {
      if (subscriptionPlanFilter === "all") return true;
      return row.plan === subscriptionPlanFilter;
    })
    .filter((row) => {
      if (subscriptionStatusFilter === "all") return true;
      if (subscriptionStatusFilter === "canceled") return row.isCanceled;
      return row.accountStatus === subscriptionStatusFilter;
    })
    .filter((row) => {
      if (subscriptionUsageFilter === "all") return true;
      if (subscriptionUsageFilter === "high") return row.usagePercent >= 80;
      if (subscriptionUsageFilter === "medium") return row.usagePercent >= 40 && row.usagePercent < 80;
      return row.usagePercent < 40;
    })
    .sort((a, b) => {
      if (subscriptionSort === "usage_desc") return b.usagePercent - a.usagePercent;
      if (subscriptionSort === "usage_asc") return a.usagePercent - b.usagePercent;
      if (subscriptionSort === "spend_desc") return b.estimatedMonthlySpend - a.estimatedMonthlySpend;
      if (subscriptionSort === "spend_asc") return a.estimatedMonthlySpend - b.estimatedMonthlySpend;
      return a.name.localeCompare(b.name);
    });

  const activeSubscribers = subscriptionRows.filter((row) => row.plan !== "free" && row.accountStatus === "active").length;
  const canceledSubscribers = subscriptionRows.filter((row) => row.plan === "free").length;
  const pastDueSubscribers = subscriptionRows.filter((row) => row.accountStatus === "past_due").length;
  const mrrEstimate = subscriptionRows.reduce((acc, row) => acc + row.estimatedMonthlySpend, 0);
  const conversionRate = users.length > 0 ? Math.round((paidUsers / users.length) * 100) : 0;
  const paidBase = activeSubscribers + canceledSubscribers;
  const churnRate = paidBase > 0 ? Math.round((canceledSubscribers / paidBase) * 100) : 0;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              {t("admin.title")}
            </h1>
            <p className="text-muted-foreground">Centro de controle: assinaturas, operações, logs e landing page.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadData(true)}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>

        {loadWarnings.length > 0 && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
            <p className="font-medium text-amber-700 dark:text-amber-300">Alguns módulos não carregaram</p>
            <p className="text-muted-foreground">
              Verifique permissões/tabelas no Supabase: {loadWarnings.join(", ")}.
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <div className="glass-card rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{t("admin.totalUsers")}</p>
            <p className="text-2xl font-bold mt-1">{users.length}</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{t("admin.totalBuilds")}</p>
            <p className="text-2xl font-bold mt-1">{builds.length}</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{t("admin.activeUsers")}</p>
            <p className="text-2xl font-bold mt-1">{activeUsers}</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{t("admin.suspendedUsers")}</p>
            <p className="text-2xl font-bold mt-1">{suspendedUsers}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <div className="glass-card rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Assinantes</p>
            <p className="text-2xl font-bold mt-1">{paidUsers}</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Free</p>
            <p className="text-2xl font-bold mt-1">{freeUsers}</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Créditos usados</p>
            <p className="text-2xl font-bold mt-1">{totalCreditsUsed}</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Créditos totais</p>
            <p className="text-2xl font-bold mt-1">{totalCreditsLimit}</p>
          </div>
          <div className="glass-card rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Uso médio</p>
            <p className="text-2xl font-bold mt-1">{avgUsage}%</p>
          </div>
        </div>

        <Tabs defaultValue="subscriptions">
          <TabsList>
            <TabsTrigger value="subscriptions" className="gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> Assinaturas
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> {t("admin.users")}
            </TabsTrigger>
            <TabsTrigger value="builds" className="gap-1.5">
              <Package className="h-3.5 w-3.5" /> {t("admin.builds")}
            </TabsTrigger>
            <TabsTrigger value="landing" className="gap-1.5">
              <Globe2 className="h-3.5 w-3.5" /> Landing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="subscriptions" className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="glass-card rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Assinantes ativos</p>
                <p className="text-2xl font-bold mt-1">{activeSubscribers}</p>
              </div>
              <div className="glass-card rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Cancelados</p>
                <p className="text-2xl font-bold mt-1">{canceledSubscribers}</p>
              </div>
              <div className="glass-card rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Inadimplentes</p>
                <p className="text-2xl font-bold mt-1">{pastDueSubscribers}</p>
              </div>
              <div className="glass-card rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Receita estimada/mês</p>
                <p className="text-2xl font-bold mt-1">{formatCurrencyBRL(mrrEstimate)}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="glass-card rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Conversão free → pago</p>
                <p className="text-2xl font-bold mt-1">{conversionRate}%</p>
              </div>
              <div className="glass-card rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Churn estimado</p>
                <p className="text-2xl font-bold mt-1">{churnRate}%</p>
              </div>
            </div>

            <div className="glass-card rounded-lg p-4 space-y-3">
              <div className="grid gap-2 md:grid-cols-4">
                <Input
                  placeholder="Buscar por nome ou email"
                  value={subscriptionSearch}
                  onChange={(event) => setSubscriptionSearch(event.target.value)}
                />
                <Select
                  value={subscriptionStatusFilter}
                  onValueChange={(value) => setSubscriptionStatusFilter(value as SubscriptionFilterStatus)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="past_due">Em atraso</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                    <SelectItem value="canceled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={subscriptionPlanFilter}
                  onValueChange={(value) => setSubscriptionPlanFilter(value as "all" | Plan)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os planos</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="elite">Elite</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={subscriptionUsageFilter} onValueChange={(value) => setSubscriptionUsageFilter(value as UsageFilter)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Uso" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Uso: todos</SelectItem>
                    <SelectItem value="high">Uso alto (80%+)</SelectItem>
                    <SelectItem value="medium">Uso médio (40-79%)</SelectItem>
                    <SelectItem value="low">Uso baixo (&lt;40%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <Select value={subscriptionSort} onValueChange={(value) => setSubscriptionSort(value as SubscriptionSort)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ordenar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usage_desc">Uso maior → menor</SelectItem>
                    <SelectItem value="usage_asc">Uso menor → maior</SelectItem>
                    <SelectItem value="spend_desc">Gasto maior → menor</SelectItem>
                    <SelectItem value="spend_asc">Gasto menor → maior</SelectItem>
                    <SelectItem value="name">Nome (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSubscriptionSearch("");
                    setSubscriptionStatusFilter("all");
                    setSubscriptionPlanFilter("all");
                    setSubscriptionUsageFilter("all");
                    setSubscriptionSort("usage_desc");
                  }}
                >
                  Limpar filtros
                </Button>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    const rows = [
                      ["Nome", "Email", "Plano", "Status", "Usado", "Limite", "Uso (%)", "Gasto estimado (BRL)"],
                      ...filteredSubscriptions.map((row) => [
                        row.name,
                        row.email,
                        row.plan,
                        row.accountStatus,
                        String(row.generationsUsed),
                        String(row.monthlyLimit),
                        String(row.usagePercent),
                        String(row.estimatedMonthlySpend),
                      ]),
                    ];
                    downloadCsv("assinaturas-filtradas.csv", rows);
                    toast.success("CSV exportado com sucesso.");
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Exportar CSV
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {filteredSubscriptions.map((row) => (
                <div key={row.id} className="glass-card rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{row.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{row.email}</p>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">{row.plan}</Badge>
                      <Badge variant="outline" className="text-xs">{row.accountStatus}</Badge>
                      {row.isCanceled && <Badge variant="outline" className="text-xs">cancelado</Badge>}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Consumo: {row.generationsUsed}/{row.monthlyLimit} ({row.usagePercent}%)
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      Gasto estimado: {formatCurrencyBRL(row.estimatedMonthlySpend)}/mês
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Select
                      onValueChange={(value) => updateUserPlan(row.userId, value as Plan)}
                      defaultValue={row.plan}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free (25)</SelectItem>
                        <SelectItem value="starter">Starter (50)</SelectItem>
                        <SelectItem value="pro">Pro (150)</SelectItem>
                        <SelectItem value="elite">Elite (500)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      onValueChange={(value) => updateAccountStatus(row.userId, value as AccountStatus)}
                      defaultValue={row.accountStatus}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="past_due">Past Due</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" onClick={() => resetQuota(row.userId)}>
                      {t("admin.resetQuota")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => clearUserHistory(row.userId)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir histórico
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleBillingBlock(row.userId, row.email, row.accountStatus)}
                    >
                      {row.accountStatus === "suspended" ? (
                        <>
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Reativar
                        </>
                      ) : (
                        <>
                          <Ban className="mr-1 h-3.5 w-3.5" /> Bloquear
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}

              {filteredSubscriptions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma assinatura encontrada com os filtros atuais.</p>
              )}
            </div>

          </TabsContent>

          <TabsContent value="users" className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("common.search")}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="max-w-xs"
              />
            </div>
            <div className="space-y-2">
              {filteredUsers.map((userRow) => (
                <div key={userRow.id} className="glass-card rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{userRow.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{userRow.email}</p>
                    <div className="flex gap-1.5 mt-1">
                      <Badge variant="outline" className="text-xs">{userRow.plan}</Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          userRow.account_status === "suspended"
                            ? "border-destructive/50 text-destructive"
                            : userRow.account_status === "past_due"
                              ? "border-warning/50 text-warning"
                              : "border-success/50 text-success"
                        }`}
                      >
                        {userRow.account_status || "active"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Créditos: {quotasByUserId[userRow.user_id]?.generations_used ?? 0}/
                      {quotasByUserId[userRow.user_id]?.monthly_limit ?? PLAN_LIMITS[(userRow.plan as Plan) || "free"]}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Select
                      onValueChange={(value) => updateUserPlan(userRow.user_id, value as Plan)}
                      defaultValue={(userRow.plan as Plan) || "free"}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free (25)</SelectItem>
                        <SelectItem value="starter">Starter (50)</SelectItem>
                        <SelectItem value="pro">Pro (150)</SelectItem>
                        <SelectItem value="elite">Elite (500)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      onValueChange={(value) => updateAccountStatus(userRow.user_id, value as AccountStatus)}
                      defaultValue={userRow.account_status || "active"}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="past_due">Past Due</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" onClick={() => resetQuota(userRow.user_id)}>
                      {t("admin.resetQuota")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => clearUserHistory(userRow.user_id)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir histórico
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        toggleBillingBlock(
                          userRow.user_id,
                          userRow.email || "",
                          (userRow.account_status as AccountStatus) || "active",
                        )
                      }
                    >
                      {(userRow.account_status as AccountStatus) === "suspended" ? (
                        <>
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Reativar
                        </>
                      ) : (
                        <>
                          <Ban className="mr-1 h-3.5 w-3.5" /> Bloquear
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="builds" className="mt-4">
            <div className="space-y-2">
              {builds.map((build) => (
                <div key={build.id} className="glass-card rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{getProjectNameFromBuildJson(build.build_json)}</p>
                    <p className="text-xs text-muted-foreground">
                      User: {build.user_id.slice(0, 8)}... · {new Date(build.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{build.status}</Badge>
                    {build.artifact_url && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={build.artifact_url} target="_blank" rel="noopener noreferrer">ZIP</a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {builds.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">{t("common.noData")}</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="landing" className="mt-4">
            {!landingSettings ? (
              <div className="glass-card rounded-lg p-5 space-y-2">
                <p className="text-sm font-medium">Configurações da landing indisponíveis.</p>
                <p className="text-sm text-muted-foreground">
                  A tabela `landing_settings` pode não existir no banco atual ou sem permissão para este usuário.
                </p>
                <p className="text-xs text-muted-foreground">
                  Rode a migration `supabase/migrations/20260218181000_admin_supremo_landing_settings.sql` no SQL Editor.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="glass-card rounded-lg p-5 space-y-6">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => scrollToSection("hero")}>Editar Hero</Button>
                    <Button size="sm" variant="outline" onClick={() => scrollToSection("cta")}>Editar CTAs</Button>
                    <Button size="sm" variant="outline" onClick={() => scrollToSection("install")}>Editar Instalação</Button>
                    <Button size="sm" variant="outline" onClick={() => scrollToSection("plans")}>Editar Planos</Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href="/" target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir Landing
                      </a>
                    </Button>
                  </div>

                  <div ref={heroSectionRef} className="space-y-2">
                    <Label htmlFor="hero_badge">Hero badge</Label>
                    <Input
                      id="hero_badge"
                      value={landingSettings.hero_badge}
                      onChange={(event) =>
                        setLandingSettings((prev) => (prev ? { ...prev, hero_badge: event.target.value } : prev))
                      }
                    />
                    <Label htmlFor="hero_title">Hero title</Label>
                    <Input
                      id="hero_title"
                      value={landingSettings.hero_title}
                      onChange={(event) =>
                        setLandingSettings((prev) => (prev ? { ...prev, hero_title: event.target.value } : prev))
                      }
                    />
                    <Label htmlFor="hero_subtitle">Hero subtitle</Label>
                    <Textarea
                      id="hero_subtitle"
                      rows={3}
                      value={landingSettings.hero_subtitle}
                      onChange={(event) =>
                        setLandingSettings((prev) => (prev ? { ...prev, hero_subtitle: event.target.value } : prev))
                      }
                    />
                  </div>

                  <div ref={ctaSectionRef} className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="cta_primary_text">CTA primário</Label>
                      <Input
                        id="cta_primary_text"
                        value={landingSettings.cta_primary_text}
                        onChange={(event) =>
                          setLandingSettings((prev) => (prev ? { ...prev, cta_primary_text: event.target.value } : prev))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cta_secondary_text">CTA secundário</Label>
                      <Input
                        id="cta_secondary_text"
                        value={landingSettings.cta_secondary_text}
                        onChange={(event) =>
                          setLandingSettings((prev) =>
                            prev ? { ...prev, cta_secondary_text: event.target.value } : prev
                          )
                        }
                      />
                    </div>
                  </div>

                  <div ref={installSectionRef} className="flex items-center justify-between rounded-md border border-border/60 p-3">
                    <div>
                      <p className="text-sm font-medium">Aviso de instalação do aplicativo</p>
                      <p className="text-xs text-muted-foreground">Mostrar ou ocultar banner PWA na landing.</p>
                    </div>
                    <Switch
                      checked={landingSettings.install_banner_enabled}
                      onCheckedChange={(checked) =>
                        setLandingSettings((prev) => (prev ? { ...prev, install_banner_enabled: checked } : prev))
                      }
                    />
                  </div>

                  <div ref={plansSectionRef} className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="starter_price">Starter preço</Label>
                      <Input
                        id="starter_price"
                        value={landingSettings.starter_price}
                        onChange={(event) =>
                          setLandingSettings((prev) => (prev ? { ...prev, starter_price: event.target.value } : prev))
                        }
                      />
                      <Label htmlFor="starter_credits">Starter créditos</Label>
                      <Input
                        id="starter_credits"
                        type="number"
                        min={0}
                        value={landingSettings.starter_credits}
                        onChange={(event) =>
                          setLandingSettings((prev) =>
                            prev ? { ...prev, starter_credits: Number(event.target.value) || 0 } : prev
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pro_price">Pro preço</Label>
                      <Input
                        id="pro_price"
                        value={landingSettings.pro_price}
                        onChange={(event) =>
                          setLandingSettings((prev) => (prev ? { ...prev, pro_price: event.target.value } : prev))
                        }
                      />
                      <Label htmlFor="pro_credits">Pro créditos</Label>
                      <Input
                        id="pro_credits"
                        type="number"
                        min={0}
                        value={landingSettings.pro_credits}
                        onChange={(event) =>
                          setLandingSettings((prev) => (prev ? { ...prev, pro_credits: Number(event.target.value) || 0 } : prev))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="elite_price">Elite preço</Label>
                      <Input
                        id="elite_price"
                        value={landingSettings.elite_price}
                        onChange={(event) =>
                          setLandingSettings((prev) => (prev ? { ...prev, elite_price: event.target.value } : prev))
                        }
                      />
                      <Label htmlFor="elite_credits">Elite créditos</Label>
                      <Input
                        id="elite_credits"
                        type="number"
                        min={0}
                        value={landingSettings.elite_credits}
                        onChange={(event) =>
                          setLandingSettings((prev) =>
                            prev ? { ...prev, elite_credits: Number(event.target.value) || 0 } : prev
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={saveLandingSettings} disabled={savingLanding}>
                      <Save className="mr-2 h-4 w-4" />
                      {savingLanding ? "Salvando..." : "Salvar landing"}
                    </Button>
                  </div>
                </div>

                <div className="glass-card rounded-lg p-5 space-y-4 h-fit xl:sticky xl:top-24">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Preview em tempo real</p>
                      <p className="text-xs text-muted-foreground">Atualiza conforme você edita os campos, antes de salvar.</p>
                    </div>
                    <div className="flex items-center gap-1 rounded-md border border-border/60 p-1">
                      <Button
                        size="sm"
                        variant={previewDevice === "desktop" ? "default" : "ghost"}
                        onClick={() => setPreviewDevice("desktop")}
                      >
                        <Monitor className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant={previewDevice === "mobile" ? "default" : "ghost"}
                        onClick={() => setPreviewDevice("mobile")}
                      >
                        <Smartphone className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className={`mx-auto rounded-2xl border border-border/60 bg-background/30 ${
                    previewDevice === "mobile" ? "max-w-[360px]" : "w-full"
                  }`}>
                    <div className="border-b border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
                      Landing Preview · {previewDevice === "mobile" ? "Mobile" : "Desktop"}
                    </div>
                    <div className="space-y-5 p-4">
                      {landingSettings.install_banner_enabled && (
                        <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs">
                          Banner de instalação ativo
                        </div>
                      )}

                      <section className="space-y-3">
                        <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] text-primary">
                          {landingSettings.hero_badge}
                        </span>
                        <h3 className="text-xl font-bold leading-tight">{landingSettings.hero_title}</h3>
                        <p className="text-sm text-muted-foreground">{landingSettings.hero_subtitle}</p>
                        <div className="flex gap-2">
                          <Button size="sm">{landingSettings.cta_primary_text}</Button>
                          <Button size="sm" variant="outline">{landingSettings.cta_secondary_text}</Button>
                        </div>
                      </section>

                      <section className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Seção de planos</p>
                        <div className={`grid gap-2 ${previewDevice === "mobile" ? "grid-cols-1" : "grid-cols-3"}`}>
                          <div className="rounded-md border border-border/60 p-2 text-center text-xs">
                            <p className="font-semibold">Starter</p>
                            <p>{landingSettings.starter_price}</p>
                            <p className="text-primary">{landingSettings.starter_credits} créditos/mês</p>
                          </div>
                          <div className="rounded-md border border-border/60 p-2 text-center text-xs">
                            <p className="font-semibold">Pro</p>
                            <p>{landingSettings.pro_price}</p>
                            <p className="text-primary">{landingSettings.pro_credits} créditos/mês</p>
                          </div>
                          <div className="rounded-md border border-border/60 p-2 text-center text-xs">
                            <p className="font-semibold">Elite</p>
                            <p>{landingSettings.elite_price}</p>
                            <p className="text-primary">{landingSettings.elite_credits} créditos/mês</p>
                          </div>
                        </div>
                      </section>

                      <section className="rounded-lg border border-border/60 p-3">
                        <p className="text-sm font-semibold">CTA final</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Botão principal: {landingSettings.cta_primary_text}
                        </p>
                      </section>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
