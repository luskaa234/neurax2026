import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, Package, Download, Code } from "lucide-react";
import { buildSystemPromptForBuild, type BuildInput, type BuildOutput } from "@/lib/systemBuildEngine";
import { downloadArtifactZip } from "@/lib/artifactDownload";
import type { Tables, Json, TablesInsert } from "@/integrations/supabase/types";

interface BuildModePanelProps {
  project: Tables<"projects">;
  formData: Record<string, string>;
  selectedTemplate: Tables<"templates"> | null;
  generationBlocked?: boolean;
  blockedMessage?: string;
}

interface BuildSystemResponse {
  project_name: string;
  file_count: number;
  artifact_url: string;
  build_json: BuildOutput;
}

interface BuildResult extends BuildSystemResponse {
  buildId: string;
}

interface BuildFileInsert {
  build_id: string;
  path: string;
  content_text: string;
}

function getProjectContext(context: Json | null): { description?: string } | undefined {
  if (!context || typeof context !== "object" || Array.isArray(context)) return undefined;
  const description = (context as Record<string, unknown>).description;
  if (typeof description !== "string") return undefined;
  return { description };
}

export function BuildModePanel({ project, formData, selectedTemplate, generationBlocked = false, blockedMessage }: BuildModePanelProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [building, setBuilding] = useState(false);
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");

  const handleBuild = async () => {
    if (generationBlocked) {
      toast.error(blockedMessage || "Geração indisponível para este status de conta.");
      return;
    }
    if (!user || !selectedTemplate) return;

    const requiredFields = ["tipo_de_sistema", "objetivo", "publico_alvo", "modulos_necessarios", "tipo_de_usuarios"];
    const missing = requiredFields.filter((fieldName) => !formData[fieldName]?.trim());
    if (missing.length > 0) {
      toast.error(`Preencha os campos obrigatórios: ${missing.join(", ")}`);
      return;
    }

    setBuilding(true);
    setBuildResult(null);
    setProgress(10);
    setProgressLabel("Criando build...");

    try {
      await supabase.from("projects").update({ status: "building" }).eq("id", project.id);

      const buildInsert: TablesInsert<"builds"> = {
        user_id: user.id,
        project_id: project.id,
        template_id: selectedTemplate.id,
        input_json: formData,
        status: "pending",
      };

      const { data: build, error: insertError } = await supabase
        .from("builds")
        .insert(buildInsert)
        .select("id")
        .single();

      if (insertError || !build) {
        throw new Error("Erro ao criar build");
      }

      setProgress(25);
      setProgressLabel("Gerando projeto com IA...");

      const prompt = buildSystemPromptForBuild(
        formData as BuildInput,
        getProjectContext(project.context),
      );

      const response = await supabase.functions.invoke<BuildSystemResponse>("build-system", {
        body: {
          build_id: build.id,
          prompt,
          input_json: formData,
        },
      });

      if (response.error) throw response.error;
      if (!response.data) throw new Error("Build sem resposta");

      setProgress(80);
      setProgressLabel("Validando e empacotando...");

      const result = response.data;

      const quotaRes = await supabase
        .from("user_quotas")
        .select("generations_used")
        .eq("user_id", user.id)
        .single();

      if (quotaRes.data) {
        await supabase
          .from("user_quotas")
          .update({ generations_used: quotaRes.data.generations_used + 5 })
          .eq("user_id", user.id);
      }

      if (result.build_json?.files?.length) {
        const fileRows: BuildFileInsert[] = result.build_json.files.map((file) => ({
          build_id: build.id,
          path: file.path,
          content_text: file.content || "",
        }));
        await supabase.from("build_files").insert(fileRows);
      }

      setProgress(100);
      setProgressLabel("Build completo!");
      setBuildResult({ ...result, buildId: build.id });
      await supabase.from("projects").update({ status: "ready" }).eq("id", project.id);
      toast.success(`Projeto "${result.project_name}" gerado com ${result.file_count} arquivos!`);
    } catch (error) {
      console.error("Build error:", error);
      await supabase.from("projects").update({ status: "error" }).eq("id", project.id);
      toast.error(error instanceof Error ? error.message : "Erro no build. Tente novamente.");
    }

    setBuilding(false);
  };

  const handleDownload = async () => {
    if (!buildResult?.artifact_url) return;

    try {
      await downloadArtifactZip({
        artifactUrl: buildResult.artifact_url,
        projectName: buildResult.project_name,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao baixar ZIP";
      toast.error(message);
    }
  };

  return (
    <div className="glass-card rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Package className="h-5 w-5 text-chart-4" />
          Build de Projeto Completo
        </h2>
        <Badge variant="outline" className="border-chart-4/50 text-chart-4 gap-1">
          <Package className="h-3 w-3" />
          Project Builder Mode
        </Badge>
      </div>

      <p className="text-xs text-chart-4 bg-chart-4/10 rounded-md px-3 py-2">
        🏗️ Este modo consome <strong>5x quota</strong> por geração. A saída será um projeto completo com Next.js + TypeScript + Tailwind + Supabase, pronto para download.
      </p>

      <div className="text-sm text-muted-foreground space-y-1">
        <p>Stack fixa: <strong>Next.js App Router + TypeScript + Tailwind + Supabase</strong></p>
        <p>O projeto será gerado como um ZIP com estrutura completa de pastas e código funcional.</p>
      </div>

      {generationBlocked && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          {blockedMessage || "Geração indisponível para este status de conta."}
        </div>
      )}

      <Button onClick={handleBuild} disabled={building || !selectedTemplate || generationBlocked} className="w-full sm:w-auto">
        {building ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando projeto...
          </>
        ) : (
          <>
            <Package className="mr-2 h-4 w-4" /> Gerar Sistema Completo
          </>
        )}
      </Button>

      {building && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">{progressLabel}</p>
        </div>
      )}

      {buildResult && (
        <div className="space-y-4 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">✅ {buildResult.project_name}</h3>
            <Badge className="bg-success/10 text-success">{buildResult.file_count} arquivos</Badge>
          </div>

          {buildResult.build_json?.run_instructions && (
            <div className="text-sm space-y-1">
              <p className="font-medium">Instruções:</p>
              <ol className="list-decimal list-inside text-muted-foreground space-y-0.5">
                {buildResult.build_json.run_instructions.map((instruction, index) => (
                  <li key={index}>{instruction}</li>
                ))}
              </ol>
            </div>
          )}

          {buildResult.artifact_url && (
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" /> Baixar Projeto (.zip)
              </Button>
              <Button variant="outline" onClick={() => navigate(`/builder/project/${project.id}`)}>
                <Code className="mr-2 h-4 w-4" /> Abrir no Editor
              </Button>
            </div>
          )}

          {buildResult.build_json?.files && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Ver arquivos gerados ({buildResult.build_json.files.length})
              </summary>
              <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground font-mono">
                {buildResult.build_json.files.map((file, index) => (
                  <li key={index}>📄 {file.path}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
