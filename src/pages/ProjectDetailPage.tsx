import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Loader2, Copy, RefreshCw, Monitor, Package } from "lucide-react";
import {
  buildSystemPrompt,
  isSystemBuilderCategory,
  validateSystemBuilderFields,
  type SystemBuilderFields,
} from "@/lib/systemPromptBuilder";
import { BuildModePanel } from "@/components/BuildModePanel";
import type { Tables, Json, TablesInsert } from "@/integrations/supabase/types";
import { useAccountStatus } from "@/hooks/useAccountStatus";
import { canGenerateForStatus, getGenerationBlockedMessage } from "@/lib/billingAccess";
import type { BuildOutput } from "@/lib/systemBuildEngine";
import {
  fallbackParseSystemIntent,
  intentToSystemBuilderFields,
  normalizeSystemIntent,
  type SystemIntentParsed,
} from "@/lib/systemIntent";

interface TemplateField {
  name: string;
  label: string;
  type: "text" | "textarea" | "select";
  options?: string[];
  required?: boolean;
  description?: string;
}

interface BuildSystemResponse {
  project_name: string;
  file_count: number;
  artifact_url: string;
  build_json: BuildOutput;
}

interface BuildFileInsert {
  build_id: string;
  path: string;
  content_text: string;
}

function getProjectContext(context: Json | null): { description?: string } | null {
  if (!context || typeof context !== "object" || Array.isArray(context)) return null;
  const description = (context as Record<string, unknown>).description;
  return typeof description === "string" ? { description } : null;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { accountStatus } = useAccountStatus();
  const navigate = useNavigate();
  const [project, setProject] = useState<Tables<"projects"> | null>(null);
  const [templates, setTemplates] = useState<Tables<"templates">[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Tables<"templates"> | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [buildMode, setBuildMode] = useState<"prompt" | "build">("prompt");
  const [buildingFromPrompt, setBuildingFromPrompt] = useState(false);
  const [systemUxMode, setSystemUxMode] = useState<"quick" | "advanced">("quick");
  const [quickDescription, setQuickDescription] = useState("");
  const [intentDraft, setIntentDraft] = useState<SystemIntentParsed | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [showIntentConfirmation, setShowIntentConfirmation] = useState(false);

  const isSystemBuilder = selectedTemplate ? isSystemBuilderCategory(selectedTemplate.category) : false;
  const quotaCost = isSystemBuilder ? 2 : 1;
  const generationBlocked = !canGenerateForStatus(accountStatus);

  useEffect(() => {
    if (!id || !user) return;
    const load = async () => {
      const [projectRes, templatesRes] = await Promise.all([
        supabase.from("projects").select("*").eq("id", id).single(),
        supabase.from("templates").select("*").order("name"),
      ]);
      if (projectRes.data) setProject(projectRes.data);
      if (templatesRes.data) setTemplates(templatesRes.data);
      setLoading(false);
    };
    load();
  }, [id, user]);

  const templateFields: TemplateField[] = selectedTemplate
    ? (selectedTemplate.fields as unknown as TemplateField[])
    : [];

  const handleFieldChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const systemFieldDescriptions: Record<string, string> = {
    tipo_de_sistema: "Defina o tipo de solução (ex.: SaaS, marketplace, ERP, app interno).",
    objetivo: "Explique o principal objetivo e o resultado esperado do sistema.",
    publico_alvo: "Descreva quem vai usar o sistema e o perfil desse público.",
    modulos_necessarios: "Liste as funcionalidades principais que precisam existir.",
    tipo_de_usuarios: "Informe os perfis/roles de usuários e diferenças de acesso.",
    precisa_auth: "Indique se o sistema exige login e qual fluxo de autenticação.",
    precisa_pagamento: "Diga se haverá cobrança/pagamentos e como deve funcionar.",
    multiusuario: "Informe se haverá múltiplas organizações/contas e isolamento de dados.",
    stack_preferida: "Caso tenha preferência técnica, descreva aqui.",
    nivel_producao: "Defina o nível esperado: MVP, beta, produção, alta escala.",
    observacoes_extras: "Inclua restrições, integrações ou requisitos adicionais.",
  };

  const genericFieldDescriptions: Record<string, string> = {
    topic: "Tema central do conteúdo a ser gerado.",
    tone: "Estilo e voz do texto (ex.: profissional, casual, técnico).",
    length: "Tamanho esperado do conteúdo.",
    platform: "Rede ou canal onde o conteúdo será publicado.",
    cta: "Chamada para ação que deve aparecer no texto.",
    product: "Produto/serviço principal do conteúdo.",
    product_name: "Nome do produto que será descrito.",
    features: "Principais características ou benefícios do produto.",
    audience: "Público-alvo que o conteúdo deve atingir.",
    goal: "Objetivo do conteúdo (ex.: awareness, conversão, retenção).",
    usp: "Diferencial único do produto/serviço.",
    target: "Segmento específico que deve ser impactado.",
    page_topic: "Assunto principal da página.",
    keywords: "Palavras-chave prioritárias para SEO.",
    brand: "Nome da marca para contextualizar o conteúdo.",
  };

  const getFieldDescription = (field: TemplateField) => {
    if (field.description) return field.description;
    if (isSystemBuilder && systemFieldDescriptions[field.name]) {
      return systemFieldDescriptions[field.name];
    }
    if (genericFieldDescriptions[field.name]) return genericFieldDescriptions[field.name];
    return `Explique claramente ${field.label.toLowerCase()} para orientar a geração.`;
  };

  const parseIntentWithRetry = async (description: string): Promise<SystemIntentParsed> => {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await supabase.functions.invoke<{ parsed?: unknown }>("parse-system-intent", {
          body: { description },
        });

        if (response.error) throw response.error;
        if (response.data?.parsed) return normalizeSystemIntent(response.data.parsed);
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      console.warn("Intent parser fallback:", lastError);
    }
    return fallbackParseSystemIntent(description);
  };

  const syncFieldsFromIntent = (intent: SystemIntentParsed, description: string) => {
    const nextFields = intentToSystemBuilderFields(intent, description);
    setIntentDraft(intent);
    setFormData(nextFields);
  };

  const handleQuickParse = async () => {
    if (generationBlocked) {
      toast.error(getGenerationBlockedMessage(accountStatus));
      return;
    }
    if (!quickDescription.trim()) {
      toast.error("Descreva o sistema antes de gerar.");
      return;
    }

    setIntentLoading(true);
    try {
      const parsed = await parseIntentWithRetry(quickDescription.trim());
      syncFieldsFromIntent(parsed, quickDescription.trim());
      setShowIntentConfirmation(true);
      toast.success("Resumo detectado. Revise antes de gerar o projeto.");
    } catch (error) {
      console.error("Quick parse error:", error);
      toast.error("Falha ao analisar descrição. Tente novamente.");
    }
    setIntentLoading(false);
  };

  const generateMasterPrompt = async (fields: Record<string, string>): Promise<string> => {
    if (generationBlocked) {
      throw new Error(getGenerationBlockedMessage(accountStatus));
    }
    if (!selectedTemplate) {
      throw new Error("Template não selecionado");
    }

    const response = await supabase.functions.invoke<{ text?: string; content?: string }>("generate-content", {
      body: {
        provider: "gemini",
        template: selectedTemplate.prompt_template,
        fields,
        context: project?.context,
        category: selectedTemplate.category,
      },
    });

    if (response.error) throw response.error;
    const text = response.data?.text || response.data?.content;
    if (!text) throw new Error("Prompt mestre vazio");
    return text;
  };

  const createBuildFromPrompt = async (
    masterPrompt: string,
    fields: Record<string, string>,
    source: "quick" | "advanced" | "prompt_generated",
  ) => {
    if (generationBlocked) {
      throw new Error(getGenerationBlockedMessage(accountStatus));
    }
    if (!user || !project || !selectedTemplate) return;

    const buildInsert: TablesInsert<"builds"> = {
      user_id: user.id,
      project_id: project.id,
      template_id: selectedTemplate.id,
      input_json: {
        source,
        fields,
        prompt: masterPrompt,
      },
      status: "building",
    };

    await supabase.from("projects").update({ status: "building" }).eq("id", project.id);

    const { data: build, error: insertError } = await supabase
      .from("builds")
      .insert(buildInsert)
      .select("id")
      .single();

    if (insertError || !build) {
      throw new Error("Erro ao criar build");
    }

    const response = await supabase.functions.invoke<BuildSystemResponse>("build-system", {
      body: {
        provider: "gemini",
        build_id: build.id,
        prompt: masterPrompt,
        input_json: fields,
      },
    });

    if (response.error) throw response.error;
    if (!response.data) throw new Error("Build sem resposta");

    if (response.data.build_json?.files?.length) {
      const fileRows: BuildFileInsert[] = response.data.build_json.files.map((file) => ({
        build_id: build.id,
        path: file.path,
        content_text: file.content || "",
      }));
      await supabase.from("build_files").insert(fileRows);
    }

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

    await supabase.from("projects").update({ status: "ready", ai_provider: "gemini" }).eq("id", project.id);
    toast.success(`Sistema "${response.data.project_name}" gerado com sucesso.`);
    navigate(`/builder/project/${project.id}`);
  };

  const handleQuickGenerateProject = async () => {
    if (!intentDraft || !selectedTemplate) return;

    const { valid, missing } = validateSystemBuilderFields(formData);
    if (!valid) {
      toast.error(`Preencha os campos obrigatórios: ${missing.join(", ")}`);
      return;
    }

    setBuildingFromPrompt(true);
    try {
      let masterPrompt: string;
      try {
        masterPrompt = await generateMasterPrompt(formData);
      } catch (error) {
        console.warn("Master prompt fallback:", error);
        masterPrompt = buildSystemPrompt(formData as unknown as SystemBuilderFields, getProjectContext(project?.context ?? null));
      }

      await createBuildFromPrompt(masterPrompt, formData, "quick");
    } catch (error) {
      console.error("Quick build error:", error);
      if (project?.id) {
        await supabase.from("projects").update({ status: "error" }).eq("id", project.id);
      }
      toast.error(error instanceof Error ? error.message : "Erro ao gerar projeto a partir do modo rápido.");
    }
    setBuildingFromPrompt(false);
  };

  const handleGenerate = async () => {
    if (generationBlocked) {
      toast.error(getGenerationBlockedMessage(accountStatus));
      return;
    }
    if (!user || !project || !selectedTemplate) return;

    // Validate system builder fields
    if (isSystemBuilder) {
      const { valid, missing } = validateSystemBuilderFields(formData);
      if (!valid) {
        toast.error(`Preencha os campos obrigatórios: ${missing.join(", ")}`);
        return;
      }
    }

    setGenerating(true);
    setResult(null);

    const { data: generation, error: insertError } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        project_id: project.id,
        template_id: selectedTemplate.id,
        input_data: formData as unknown as Json,
        status: "generating",
      })
      .select()
      .single();

    if (insertError || !generation) {
      toast.error("Erro ao iniciar geração");
      setGenerating(false);
      return;
    }

    try {
      const response = await supabase.functions.invoke("generate-content", {
        body: {
          provider: "gemini",
          generation_id: generation.id,
          template: selectedTemplate.prompt_template,
          fields: formData,
          context: project.context,
          category: selectedTemplate.category,
        },
      });

      if (response.error) throw response.error;
      const content = response.data?.text || response.data?.content || "Conteúdo gerado com sucesso.";
      setResult(content);

      await supabase
        .from("generations")
        .update({ result: content, status: "completed" })
        .eq("id", generation.id);

      // 2x quota for system_builder
      const quotaRes = await supabase.from("user_quotas").select("generations_used").eq("user_id", user.id).single();
      if (quotaRes.data) {
        await supabase
          .from("user_quotas")
          .update({ generations_used: quotaRes.data.generations_used + quotaCost })
          .eq("user_id", user.id);
      }

      toast.success(isSystemBuilder ? "Prompt mestre gerado!" : "Conteúdo gerado!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro na geração. Tente novamente.");
      await supabase.from("generations").update({ status: "failed" }).eq("id", generation.id);
    }
    setGenerating(false);
  };

  const handleBuildFromPrompt = async () => {
    if (generationBlocked) {
      toast.error(getGenerationBlockedMessage(accountStatus));
      return;
    }
    if (!user || !project || !selectedTemplate || !result) return;

    setBuildingFromPrompt(true);

    try {
      await createBuildFromPrompt(result, formData, "prompt_generated");
    } catch (error) {
      console.error("Build from prompt error:", error);
      if (project?.id) {
        await supabase.from("projects").update({ status: "error" }).eq("id", project.id);
      }
      toast.error("Erro ao criar sistema a partir do prompt.");
    }

    setBuildingFromPrompt(false);
  };

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      toast.success("Copiado!");
    }
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

  if (!project) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Projeto não encontrado.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in max-w-4xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <p className="text-muted-foreground">{project.description}</p>
          </div>
        </div>

        {generationBlocked && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
            {getGenerationBlockedMessage(accountStatus)}
          </div>
        )}

        {/* Template Selection */}
        <div className="glass-card rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {isSystemBuilder ? "Gerar Prompt Mestre" : "Gerar Conteúdo"}
            </h2>
            {isSystemBuilder && (
              <Badge variant="outline" className="border-chart-4/50 text-chart-4 gap-1">
                <Monitor className="h-3 w-3" />
                Modo Desenvolvedor de Sistemas
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <Label>Template</Label>
            <Select
              value={selectedTemplate?.id ?? ""}
              onValueChange={(val) => {
                const t = templates.find((t) => t.id === val) ?? null;
                setSelectedTemplate(t);
                setFormData({});
                setResult(null);
                setSystemUxMode("quick");
                setQuickDescription("");
                setIntentDraft(null);
                setShowIntentConfirmation(false);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Escolha um template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.category === "system_builder" ? "🖥️ " : ""}{t.name} {t.is_system && "⚡"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isSystemBuilder && (
            <p className="text-xs text-chart-4 bg-chart-4/10 rounded-md px-3 py-2">
              ⚙️ Este template consome <strong>2x quota</strong> por geração. A saída será um prompt mestre técnico estruturado.
            </p>
          )}

          {selectedTemplate && (
            <>
              <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
              {isSystemBuilder && systemUxMode === "quick" ? (
                <div className="space-y-4 rounded-md border border-border p-4 bg-card/40">
                  <div className="space-y-2">
                    <Label>Descreva o sistema que você quer criar</Label>
                    <Textarea
                      placeholder="SaaS de agendamento de quadras com login, pagamento e painel admin"
                      value={quickDescription}
                      onChange={(e) => setQuickDescription(e.target.value)}
                      className="min-h-24"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button onClick={handleQuickParse} disabled={intentLoading || !quickDescription.trim()}>
                      {intentLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analisando intenção...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" /> Gerar Sistema com IA
                        </>
                      )}
                    </Button>
                    <Button variant="link" className="px-0 h-auto text-xs" onClick={() => setSystemUxMode("advanced")}>
                      modo avançado
                    </Button>
                  </div>

                  {showIntentConfirmation && intentDraft && (
                    <div className="space-y-4 rounded-md border border-chart-4/30 bg-chart-4/5 p-4">
                      <h3 className="font-medium">Resumo do sistema detectado</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Tipo</Label>
                          <Input value={formData.tipo_de_sistema || ""} onChange={(e) => handleFieldChange("tipo_de_sistema", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Stack</Label>
                          <Input value={formData.stack_preferida || ""} onChange={(e) => handleFieldChange("stack_preferida", e.target.value)} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Módulos</Label>
                          <Textarea value={formData.modulos_necessarios || ""} onChange={(e) => handleFieldChange("modulos_necessarios", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Roles</Label>
                          <Input value={formData.tipo_de_usuarios || ""} onChange={(e) => handleFieldChange("tipo_de_usuarios", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Nível</Label>
                          <Input value={formData.nivel_producao || ""} onChange={(e) => handleFieldChange("nivel_producao", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Auth</Label>
                          <Select value={formData.precisa_auth || "sim"} onValueChange={(val) => handleFieldChange("precisa_auth", val)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sim">sim</SelectItem>
                              <SelectItem value="nao">nao</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Pagamento</Label>
                          <Select value={formData.precisa_pagamento || "nao"} onValueChange={(val) => handleFieldChange("precisa_pagamento", val)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sim">sim</SelectItem>
                              <SelectItem value="nao">nao</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={handleQuickGenerateProject} disabled={buildingFromPrompt || generationBlocked}>
                          {buildingFromPrompt ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando projeto...
                            </>
                          ) : (
                            <>
                              <Package className="mr-2 h-4 w-4" /> Gerar Projeto
                            </>
                          )}
                        </Button>
                        <Button variant="outline" onClick={() => setSystemUxMode("advanced")}>
                          Editar detalhes
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {isSystemBuilder && (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
                        <Button
                          variant={buildMode === "prompt" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setBuildMode("prompt")}
                          className="text-xs"
                        >
                          <Monitor className="mr-1.5 h-3.5 w-3.5" /> Prompt Mestre
                        </Button>
                        <Button
                          variant={buildMode === "build" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setBuildMode("build")}
                          className="text-xs"
                        >
                          <Package className="mr-1.5 h-3.5 w-3.5" /> Criar Sistema
                        </Button>
                      </div>
                      <Button variant="link" className="px-0 h-auto text-xs" onClick={() => setSystemUxMode("quick")}>
                        voltar ao modo rápido
                      </Button>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    {templateFields.map((field) => (
                      <div key={field.name} className={`space-y-2 ${field.type === "textarea" ? "md:col-span-2" : ""}`}>
                        <Label>{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
                        <p className="text-xs text-muted-foreground">{getFieldDescription(field)}</p>
                        {field.type === "textarea" ? (
                          <Textarea
                            value={formData[field.name] || ""}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            required={field.required}
                          />
                        ) : field.type === "select" && field.options ? (
                          <Select
                            value={formData[field.name] || ""}
                            onValueChange={(val) => handleFieldChange(field.name, val)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={`Selecione ${field.label.toLowerCase()}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options.map((opt) => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={formData[field.name] || ""}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            required={field.required}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {isSystemBuilder && buildMode === "build" ? (
                    <BuildModePanel
                      project={project}
                      formData={formData}
                      selectedTemplate={selectedTemplate}
                      generationBlocked={generationBlocked}
                      blockedMessage={getGenerationBlockedMessage(accountStatus)}
                    />
                  ) : (
                    <Button onClick={handleGenerate} disabled={generating || generationBlocked} className="w-full sm:w-auto">
                      {generating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...
                        </>
                      ) : (
                        <>
                          {isSystemBuilder ? <Monitor className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
                          {isSystemBuilder ? "Gerar Prompt Mestre" : "Gerar Conteúdo"}
                        </>
                      )}
                    </Button>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Result */}
        {result && (
          <div className="glass-card rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {isSystemBuilder ? "Prompt Mestre Gerado" : "Resultado"}
              </h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  <Copy className="mr-2 h-3 w-3" /> Copiar
                </Button>
                <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating || generationBlocked}>
                  <RefreshCw className="mr-2 h-3 w-3" /> Regenerar
                </Button>
                {isSystemBuilder && buildMode === "prompt" && (
                  <Button size="sm" onClick={handleBuildFromPrompt} disabled={buildingFromPrompt || generationBlocked}>
                    {buildingFromPrompt ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Criando sistema...
                      </>
                    ) : (
                      <>
                        <Package className="mr-2 h-3 w-3" /> Criar sistema com prompt
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            <div className="rounded-md bg-muted p-4 whitespace-pre-wrap text-sm leading-relaxed max-h-[600px] overflow-y-auto">
              {result}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
