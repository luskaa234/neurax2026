import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FolderOpen, FileText, Sparkles, TrendingUp, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

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

export default function DashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Tables<"projects">[]>([]);
  const [quota, setQuota] = useState<Tables<"user_quotas"> | null>(null);
  const [genCount, setGenCount] = useState(0);
  const [projectsCount, setProjectsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const [projectsRes, quotaRes, gensRes, projectsCountRes] = await Promise.all([
          supabase
            .from("projects")
            .select("*")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(5),
          supabase.from("user_quotas").select("*").eq("user_id", user.id).maybeSingle(),
          supabase.from("generations").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        ]);

        if (projectsRes.error) throw projectsRes.error;
        if (quotaRes.error) throw quotaRes.error;
        if (gensRes.error) throw gensRes.error;
        if (projectsCountRes.error) throw projectsCountRes.error;

        setProjects(projectsRes.data || []);
        if (quotaRes.data) {
          setQuota({
            ...quotaRes.data,
            monthly_limit: getNormalizedMonthlyLimit(quotaRes.data.plan, quotaRes.data.monthly_limit),
          });
        } else {
          setQuota(null);
        }
        if (gensRes.count !== null) setGenCount(gensRes.count);
        if (projectsCountRes.count !== null) setProjectsCount(projectsCountRes.count);
      } catch (error) {
        console.error("Dashboard load error:", error);
        toast.error("Não foi possível carregar o dashboard. Tente novamente.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  const stats = [
    { label: "Projetos", value: projectsCount, icon: FolderOpen, color: "text-primary" },
    { label: "Gerações", value: genCount, icon: Sparkles, color: "text-success" },
    {
      label: "Créditos",
      value: quota ? `${quota.generations_used}/${getNormalizedMonthlyLimit(quota.plan, quota.monthly_limit)}` : "—",
      icon: TrendingUp,
      color: "text-warning",
    },
    { label: "Plano", value: quota?.plan?.toUpperCase() ?? "FREE", icon: FileText, color: "text-primary" },
  ];

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
      <div className="space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Visão geral da sua conta</p>
          </div>
          <Button asChild>
            <Link to="/projects?new=1">
              <Plus className="mr-2 h-4 w-4" /> Novo Projeto
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="glass-card rounded-lg p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <p className="mt-2 text-2xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Recent Projects */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Projetos Recentes</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/projects">Ver todos</Link>
            </Button>
          </div>
          {projects.length === 0 ? (
            <div className="glass-card rounded-lg p-8 text-center">
              <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhum projeto ainda.</p>
              <Button className="mt-4" asChild>
                <Link to="/projects?new=1">Criar primeiro projeto</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="glass-card rounded-lg p-4 hover:border-primary/30 transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="text-sm text-muted-foreground">{project.description || "Sem descrição"}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(project.updated_at).toLocaleDateString("pt-BR")}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
