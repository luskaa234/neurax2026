import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Download, Code, Eye, ScrollText, RefreshCw } from "lucide-react";
import { BuilderEditor } from "@/components/builder/BuilderEditor";
import { BuilderPreview } from "@/components/builder/BuilderPreview";
import { BuilderLogs } from "@/components/builder/BuilderLogs";
import { toast } from "sonner";
import { downloadArtifactZip } from "@/lib/artifactDownload";
import type { Json, Tables } from "@/integrations/supabase/types";

interface BuildJsonSummary {
  project_name?: string;
}

function getBuildSummary(buildJson: Json | null): BuildJsonSummary {
  if (!buildJson || typeof buildJson !== "object" || Array.isArray(buildJson)) return {};
  const projectName = (buildJson as Record<string, unknown>).project_name;
  return {
    project_name: typeof projectName === "string" ? projectName : undefined,
  };
}

export default function BuilderDetailPage() {
  const { buildId } = useParams<{ buildId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [build, setBuild] = useState<Tables<"builds"> | null>(null);
  const [files, setFiles] = useState<{ id: string; path: string; content_text: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [regeneratingLink, setRegeneratingLink] = useState(false);

  useEffect(() => {
    if (!buildId || !user) return;
    const load = async () => {
      const [buildRes, filesRes] = await Promise.all([
        supabase.from("builds").select("*").eq("id", buildId).single(),
        supabase.from("build_files").select("id, path, content_text").eq("build_id", buildId).order("path"),
      ]);
      if (buildRes.data) setBuild(buildRes.data);
      if (filesRes.data) setFiles(filesRes.data);
      setLoading(false);
    };
    load();
  }, [buildId, user]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!build) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Build não encontrado.</p>
        </div>
      </AppLayout>
    );
  }

  const buildSummary = getBuildSummary(build.build_json);
  const projectName = buildSummary.project_name || "Build";

  const handleDownload = async () => {
    if (!build.artifact_url) {
      toast.error("Link do artefato indisponível. Gere um novo link.");
      return;
    }

    try {
      await downloadArtifactZip({ artifactUrl: build.artifact_url, projectName });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao baixar ZIP";
      toast.error(message);
    }
  };

  const handleRegenerateLink = async () => {
    setRegeneratingLink(true);
    try {
      const response = await supabase.functions.invoke<{ artifact_url: string }>("build-artifact-signed-url", {
        body: { build_id: build.id },
      });

      if (response.error || !response.data?.artifact_url) {
        throw response.error || new Error("Não foi possível regenerar link");
      }

      setBuild((previous) => (previous ? { ...previous, artifact_url: response.data?.artifact_url || null } : previous));
      toast.success("Link de download regenerado.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao regenerar link";
      toast.error(message);
    }
    setRegeneratingLink(false);
  };

  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/builder")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{projectName}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-xs">{build.status}</Badge>
                <span className="text-xs text-muted-foreground">
                  {files.length} arquivos
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleRegenerateLink} disabled={regeneratingLink}>
              <RefreshCw className={`mr-2 h-4 w-4 ${regeneratingLink ? "animate-spin" : ""}`} /> Regenerar link
            </Button>
            <Button size="sm" onClick={handleDownload} disabled={!build.artifact_url}>
              <Download className="mr-2 h-4 w-4" /> Baixar ZIP
            </Button>
          </div>
        </div>

        <Tabs defaultValue="editor" className="w-full">
          <TabsList>
            <TabsTrigger value="editor" className="gap-1.5">
              <Code className="h-3.5 w-3.5" /> Editor
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5">
              <Eye className="h-3.5 w-3.5" /> Preview
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5">
              <ScrollText className="h-3.5 w-3.5" /> Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="editor" className="mt-4">
            <BuilderEditor buildId={build.id} files={files} onFilesChange={setFiles} />
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            <BuilderPreview buildId={build.id} />
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <BuilderLogs buildId={build.id} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
