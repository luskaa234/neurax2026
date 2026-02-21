import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Clock, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import type { Json, Tables } from "@/integrations/supabase/types";

function getProjectName(buildJson: Json | null): string {
  if (!buildJson || typeof buildJson !== "object" || Array.isArray(buildJson)) return "Build";
  const projectName = (buildJson as Record<string, unknown>).project_name;
  return typeof projectName === "string" ? projectName : "Build";
}

export default function BuilderPage() {
  const { user } = useAuth();
  const [builds, setBuilds] = useState<Tables<"builds">[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("builds")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setBuilds(data);
        setLoading(false);
      });
  }, [user]);

  const statusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle className="h-4 w-4 text-success" />;
    if (status === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
    return <Clock className="h-4 w-4 text-warning" />;
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Builder</h1>
          <p className="text-muted-foreground">Seus projetos gerados</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/builder/create">Criar Projeto</Link>
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : builds.length === 0 ? (
          <div className="glass-card rounded-lg p-8 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum build encontrado.</p>
            <p className="text-sm text-muted-foreground mt-1">Use o modo "Criar Sistema" em um projeto para gerar builds.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {builds.map((build) => {
              const name = getProjectName(build.build_json);
              return (
                <Link
                  key={build.id}
                  to={build.project_id ? `/builder/project/${build.project_id}` : `/builder/${build.id}`}
                  className="glass-card rounded-lg p-4 hover:border-primary/30 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {statusIcon(build.status)}
                    <div>
                      <p className="font-medium">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(build.created_at).toLocaleDateString("pt-BR")} · {build.status}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{build.status}</Badge>
                    {build.artifact_url && <ExternalLink className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
