import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAccountStatus } from "@/hooks/useAccountStatus";
import { supabase } from "@/integrations/supabase/client";
import { buildSystemPrompt, type SystemBuilderFields } from "@/lib/systemPromptBuilder";
import { createProject, createProjectVersion, saveFilesBatch, setProjectStatus } from "@/services/projectService";
import type { BuildOutput } from "@/lib/systemBuildEngine";
import { canGenerateForStatus, getGenerationBlockedMessage } from "@/lib/billingAccess";
import { fallbackParseSystemIntent, normalizeSystemIntent } from "@/lib/systemIntent";

interface ParsedIntent {
  system_type: string;
  modules: string[];
  roles: string[];
  auth: boolean;
  payment: boolean;
  stack: string;
  preview_required: boolean;
  goal: string;
}

type CreationMode = "intent" | "manual";

function intentToFields(intent: ParsedIntent): Record<string, string> {
  return {
    tipo_de_sistema: intent.system_type,
    objetivo: intent.goal,
    publico_alvo: intent.roles.includes("admin") ? "usuarios e administradores" : "usuarios",
    modulos_necessarios: intent.modules.join(", "),
    tipo_de_usuarios: intent.roles.join(", "),
    precisa_auth: intent.auth ? "sim" : "nao",
    precisa_pagamento: intent.payment ? "sim" : "nao",
    multiusuario: "nao",
    stack_preferida: intent.stack,
    nivel_producao: "producao",
    observacoes_extras: `preview_required=${intent.preview_required ? "sim" : "nao"}`,
  };
}

export default function BuilderCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { accountStatus } = useAccountStatus();

  const [mode, setMode] = useState<CreationMode | null>(null);
  const [description, setDescription] = useState("");
  const [manualFields, setManualFields] = useState<Record<string, string>>({
    tipo_de_sistema: "",
    objetivo: "",
    publico_alvo: "",
    modulos_necessarios: "",
    tipo_de_usuarios: "",
    precisa_auth: "sim",
    precisa_pagamento: "nao",
    multiusuario: "nao",
    stack_preferida: "Next.js + Supabase",
    nivel_producao: "producao",
    observacoes_extras: "",
  });
  const [parsedIntent, setParsedIntent] = useState<ParsedIntent | null>(null);
  const [originalPrompt, setOriginalPrompt] = useState("");
  const [promptText, setPromptText] = useState("");
  const [loadingParse, setLoadingParse] = useState(false);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [creating, setCreating] = useState(false);

  const effectiveFields = useMemo(() => (mode === "manual" ? manualFields : parsedIntent ? intentToFields(parsedIntent) : null), [manualFields, mode, parsedIntent]);
  const generationBlocked = !canGenerateForStatus(accountStatus);

  const parseIntent = async () => {
    if (!description.trim()) {
      toast.error("Descreva o projeto");
      return;
    }

    setLoadingParse(true);
    try {
      const response = await supabase.functions.invoke<{ parsed: Record<string, unknown> }>("parse-system-intent", {
        body: { description: description.trim() },
      });
      if (response.error) throw response.error;

      const parsed = response.data?.parsed || {};
      const nextIntent: ParsedIntent = {
        system_type: String(parsed.system_type || description.trim()),
        modules: Array.isArray(parsed.modules) ? parsed.modules.map((item) => String(item)) : ["dashboard"],
        roles: Array.isArray(parsed.roles) ? parsed.roles.map((item) => String(item)) : ["user", "admin"],
        auth: Boolean(parsed.needs_auth),
        payment: Boolean(parsed.needs_payment),
        stack: String(parsed.suggested_stack || "Next.js + Supabase"),
        preview_required: parsed.preview_required !== false,
        goal: String(parsed.goal || description.trim()),
      };

      setParsedIntent(nextIntent);
      toast.success("Estrutura detectada");
    } catch (error) {
      console.error(error);
      const fallback = normalizeSystemIntent(fallbackParseSystemIntent(description.trim()));
      const nextIntent: ParsedIntent = {
        system_type: fallback.system_type,
        modules: fallback.modules,
        roles: fallback.roles,
        auth: fallback.needs_auth,
        payment: fallback.needs_payment,
        stack: fallback.suggested_stack,
        preview_required: fallback.preview_required,
        goal: fallback.goal,
      };
      setParsedIntent(nextIntent);
      toast.message("Parser remoto indisponível. Usando fallback local.");
    }
    setLoadingParse(false);
  };

  const generateMasterPrompt = async () => {
    if (generationBlocked) {
      toast.error(getGenerationBlockedMessage(accountStatus));
      return;
    }
    if (!effectiveFields) {
      toast.error("Preencha os dados primeiro");
      return;
    }

    setLoadingPrompt(true);
    try {
      const fallbackPrompt = buildSystemPrompt(effectiveFields as SystemBuilderFields, null);

      const response = await supabase.functions.invoke<{ text?: string; content?: string }>("generate-content", {
        body: {
          provider: "gemini",
          category: "system_builder",
          fields: effectiveFields,
        },
      });

      const generated = response.error ? fallbackPrompt : response.data?.text || response.data?.content || fallbackPrompt;
      setOriginalPrompt(generated);
      setPromptText(generated);
      toast.success("Prompt mestre gerado");
    } catch (error) {
      console.error(error);
      toast.error("Falha ao gerar prompt mestre");
    }
    setLoadingPrompt(false);
  };

  const createFromPrompt = async () => {
    if (generationBlocked) {
      toast.error(getGenerationBlockedMessage(accountStatus));
      return;
    }
    if (!user || !promptText.trim() || !effectiveFields) {
      toast.error("Prompt inválido");
      return;
    }

    setCreating(true);
    try {
      const projectNameBase = mode === "intent" ? parsedIntent?.system_type || "Projeto IA" : manualFields.tipo_de_sistema || "Projeto Manual";
      const project = await createProject({
        user_id: user.id,
        name: projectNameBase,
        description: mode === "intent" ? description : manualFields.objetivo,
        stack: [effectiveFields.stack_preferida || "Next.js + Supabase"],
        ai_provider: "gemini",
        creation_mode: mode,
        original_prompt: originalPrompt || promptText,
        parsed_prompt: JSON.stringify(mode === "intent" ? parsedIntent : effectiveFields),
        status: "building",
      });

      const { data: build, error: buildInsertError } = await supabase
        .from("builds")
        .insert({
          user_id: user.id,
          project_id: project.id,
          input_json: {
            creation_mode: mode,
            fields: effectiveFields,
            original_prompt: originalPrompt || promptText,
            parsed_prompt: mode === "intent" ? parsedIntent : effectiveFields,
          },
          status: "pending",
        })
        .select("id")
        .single();

      if (buildInsertError || !build) {
        throw buildInsertError || new Error("Erro ao criar build");
      }

      const response = await supabase.functions.invoke<{
        project_name: string;
        file_count: number;
        artifact_url: string;
        build_json: BuildOutput;
      }>("build-system", {
        body: {
          provider: "gemini",
          build_id: build.id,
          prompt: promptText,
          input_json: effectiveFields,
        },
      });

      if (response.error || !response.data) {
        throw response.error || new Error("Falha na geração");
      }

      const generatedFiles = response.data.build_json?.files || [];

      if (!generatedFiles.length) {
        throw new Error("Build sem arquivos");
      }

      await supabase.from("build_files").insert(
        generatedFiles.map((file) => ({
          build_id: build.id,
          path: file.path,
          content_text: file.content,
        })),
      );

      await saveFilesBatch(
        project.id,
        generatedFiles.map((file) => ({ path: file.path, content: file.content, source: "ai" })),
        "ai",
      );

      await createProjectVersion(project.id, "gemini", "initial_build");
      await setProjectStatus(project.id, "ready");

      navigate(`/builder/project/${project.id}`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Falha ao criar projeto");
    }
    setCreating(false);
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Criar Projeto</h1>
          <p className="text-sm text-muted-foreground">Escolha o modo de criação.</p>
        </div>

        {generationBlocked && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
            {getGenerationBlockedMessage(accountStatus)}
          </div>
        )}

        {!mode && (
          <div className="grid gap-4 md:grid-cols-2">
            <button className="rounded-lg border border-border bg-card/40 p-6 text-left hover:border-primary/40" onClick={() => setMode("intent")}>
              <h2 className="text-lg font-semibold">Criar via descrição</h2>
            </button>
            <button className="rounded-lg border border-border bg-card/40 p-6 text-left hover:border-primary/40" onClick={() => setMode("manual")}>
              <h2 className="text-lg font-semibold">Criar manual</h2>
            </button>
          </div>
        )}

        {mode === "intent" && (
          <div className="space-y-4 rounded-lg border border-border bg-card/40 p-4">
            <Label>Descreva o que você quer criar</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="SaaS de agendamento com login e pagamento"
              className="min-h-24"
            />
            <Button onClick={parseIntent} disabled={loadingParse || !description.trim()}>
              {loadingParse ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Gerar Estrutura
            </Button>
            {parsedIntent && (
              <div className="rounded border border-border bg-background p-3 text-xs">
                <pre>{JSON.stringify(parsedIntent, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

        {mode === "manual" && (
          <div className="grid gap-3 rounded-lg border border-border bg-card/40 p-4 md:grid-cols-2">
            <div>
              <Label>tipo sistema</Label>
              <Input value={manualFields.tipo_de_sistema} onChange={(event) => setManualFields((prev) => ({ ...prev, tipo_de_sistema: event.target.value }))} />
            </div>
            <div>
              <Label>módulos</Label>
              <Input value={manualFields.modulos_necessarios} onChange={(event) => setManualFields((prev) => ({ ...prev, modulos_necessarios: event.target.value }))} />
            </div>
            <div>
              <Label>roles</Label>
              <Input value={manualFields.tipo_de_usuarios} onChange={(event) => setManualFields((prev) => ({ ...prev, tipo_de_usuarios: event.target.value }))} />
            </div>
            <div>
              <Label>stack</Label>
              <Input value={manualFields.stack_preferida} onChange={(event) => setManualFields((prev) => ({ ...prev, stack_preferida: event.target.value }))} />
            </div>
            <div>
              <Label>auth</Label>
              <Select value={manualFields.precisa_auth} onValueChange={(value) => setManualFields((prev) => ({ ...prev, precisa_auth: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">sim</SelectItem>
                  <SelectItem value="nao">nao</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>pagamento</Label>
              <Select value={manualFields.precisa_pagamento} onValueChange={(value) => setManualFields((prev) => ({ ...prev, precisa_pagamento: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">sim</SelectItem>
                  <SelectItem value="nao">nao</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>nível produção</Label>
              <Input value={manualFields.nivel_producao} onChange={(event) => setManualFields((prev) => ({ ...prev, nivel_producao: event.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>objetivo</Label>
              <Textarea value={manualFields.objetivo} onChange={(event) => setManualFields((prev) => ({ ...prev, objetivo: event.target.value }))} />
            </div>
          </div>
        )}

        {mode && (
          <div className="flex gap-2">
            <Button onClick={generateMasterPrompt} disabled={loadingPrompt || !effectiveFields || generationBlocked}>
              {loadingPrompt ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {mode === "manual" ? "Gerar Prompt Mestre" : "Gerar Prompt Mestre"}
            </Button>
            <Button variant="outline" onClick={() => setMode(null)}>Voltar</Button>
          </div>
        )}

        {promptText && (
          <div className="space-y-3 rounded-lg border border-border bg-card/40 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Prompt Mestre Editável</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(promptText);
                  toast.success("Prompt copiado");
                }}
              >
                <Copy className="mr-1 h-3 w-3" /> copiar
              </Button>
            </div>
            <Editor
              height="360px"
              language="markdown"
              value={promptText}
              onChange={(value) => setPromptText(value || "")}
              theme="vs-dark"
              options={{ minimap: { enabled: false }, wordWrap: "on", automaticLayout: true }}
            />
            <Button onClick={createFromPrompt} disabled={creating || !promptText.trim() || generationBlocked}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Criar Projeto
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
