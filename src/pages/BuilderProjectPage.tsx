import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Download, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";
import { ProjectFileTree } from "@/components/builder-core/ProjectFileTree";
import { ProjectEditorCore } from "@/components/builder-core/ProjectEditorCore";
import { ProjectPreviewPanel } from "@/components/builder-core/ProjectPreviewPanel";
import { ProjectLogsPanel } from "@/components/builder-core/ProjectLogsPanel";
import { buildFileTree, type FileNode } from "@/lib/file-tree/engine";
import {
  cloneProject,
  createProjectVersion,
  listProjectFileVersions,
  listProjectFiles,
  listProjectLogs,
  saveFilesBatch,
  setProjectStatus,
  updateFile,
  type ProjectFileRow,
  type ProjectFileVersionRow,
  type ProjectRow,
} from "@/services/projectService";

const AUTOSAVE_DELAY_MS = 2000;

type ScopeType = "file" | "folder" | "module";

export default function BuilderProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectRow | null>(null);
  const [files, setFiles] = useState<ProjectFileRow[]>([]);
  const [logs, setLogs] = useState<Tables<"project_logs">[]>([]);
  const [versions, setVersions] = useState<ProjectFileVersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [openTabIds, setOpenTabIds] = useState<string[]>([]);
  const [draftByFileId, setDraftByFileId] = useState<Record<string, string>>({});
  const [dirtyByFileId, setDirtyByFileId] = useState<Record<string, boolean>>({});
  const [savingByFileId, setSavingByFileId] = useState<Record<string, boolean>>({});
  const [scopeType, setScopeType] = useState<ScopeType>("file");
  const [scopeValue, setScopeValue] = useState("");
  const [scopeInstruction, setScopeInstruction] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [cloning, setCloning] = useState(false);

  const autosaveRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const filesById = useMemo(() => new Map(files.map((file) => [file.id, file])), [files]);
  const filesByPath = useMemo(() => new Map(files.map((file) => [file.path, file])), [files]);
  const tree = useMemo(() => buildFileTree(files.map((file) => ({ id: file.id, path: file.path }))), [files]);

  const refreshProjectData = useCallback(async () => {
    if (!id) return;
    const [{ data: projectData }, projectFiles, projectLogs] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      listProjectFiles(id),
      listProjectLogs(id),
    ]);

    setProject(projectData || null);
    setFiles(projectFiles);
    setLogs(projectLogs);

    if (!activeFileId && projectFiles[0]) {
      setActiveFileId(projectFiles[0].id);
      setOpenTabIds([projectFiles[0].id]);
    }
  }, [activeFileId, id]);

  const hydrateFromLatestBuild = useCallback(async () => {
    if (!id) return;
    const currentFiles = await listProjectFiles(id);
    if (currentFiles.length > 0) return;

    const { data: build } = await supabase
      .from("builds")
      .select("id")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!build?.id) return;

    const { data: buildFiles } = await supabase
      .from("build_files")
      .select("path, content_text")
      .eq("build_id", build.id)
      .order("path");

    if (buildFiles?.length) {
      await saveFilesBatch(
        id,
        buildFiles.map((file) => ({ path: file.path, content: file.content_text, source: "ai" })),
        "ai",
      );
      await createProjectVersion(id, "gemini", "initial_import_from_build");
      await setProjectStatus(id, "ready");
    }
  }, [id]);

  useEffect(() => {
    if (!id || !user) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        await hydrateFromLatestBuild();
        if (!cancelled) {
          await refreshProjectData();
        }
      } catch (error) {
        console.error(error);
        toast.error("Falha ao carregar projeto");
      }
      if (!cancelled) setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [hydrateFromLatestBuild, id, refreshProjectData, user]);

  useEffect(() => {
    if (!activeFileId) {
      setVersions([]);
      return;
    }

    listProjectFileVersions(activeFileId)
      .then((rows) => setVersions(rows))
      .catch(() => setVersions([]));

    const activeFile = filesById.get(activeFileId);
    if (scopeType === "file" && activeFile) {
      setScopeValue(activeFile.path);
    }
  }, [activeFileId, filesById, scopeType]);

  const openFile = useCallback((file: FileNode) => {
    setActiveFileId(file.id);
    setOpenTabIds((prev) => (prev.includes(file.id) ? prev : [...prev, file.id]));
  }, []);

  const closeTab = useCallback((fileId: string) => {
    setOpenTabIds((prev) => prev.filter((idInList) => idInList !== fileId));
    if (activeFileId === fileId) {
      const next = openTabIds.find((idInList) => idInList !== fileId) || null;
      setActiveFileId(next);
    }
  }, [activeFileId, openTabIds]);

  const saveFileNow = useCallback(async (fileId: string) => {
    const content = draftByFileId[fileId] ?? filesById.get(fileId)?.content;
    if (content === undefined) return;

    setSavingByFileId((prev) => ({ ...prev, [fileId]: true }));
    try {
      const updated = await updateFile(fileId, content, "manual");
      setFiles((prev) => prev.map((file) => (file.id === fileId ? updated : file)));
      setDirtyByFileId((prev) => ({ ...prev, [fileId]: false }));
      setVersions(await listProjectFileVersions(fileId));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar";
      toast.error(message);
    }
    setSavingByFileId((prev) => ({ ...prev, [fileId]: false }));
  }, [draftByFileId, filesById]);

  const onChangeDraft = useCallback((fileId: string, content: string) => {
    setDraftByFileId((prev) => ({ ...prev, [fileId]: content }));
    setDirtyByFileId((prev) => ({ ...prev, [fileId]: true }));

    const current = autosaveRef.current[fileId];
    if (current) clearTimeout(current);

    autosaveRef.current[fileId] = setTimeout(() => {
      saveFileNow(fileId).catch(() => {});
    }, AUTOSAVE_DELAY_MS);
  }, [saveFileNow]);

  const handleRegenerate = useCallback(async () => {
    if (!id || !scopeValue.trim()) return;

    setRegenerating(true);
    try {
      await setProjectStatus(id, "parsing");
      await setProjectStatus(id, "generating");

      const response = await supabase.functions.invoke<{ files: Array<{ path: string; content: string }> }>("regenerate-project-scope", {
        body: {
          project_id: id,
          scope_type: scopeType,
          scope_value: scopeValue,
          instruction: scopeInstruction,
        },
      });

      if (response.error || !response.data?.files?.length) {
        throw response.error || new Error("Regeneração sem arquivos");
      }

      await setProjectStatus(id, "writing");

      for (const file of response.data.files) {
        const existing = filesByPath.get(file.path);
        if (existing) {
          await updateFile(existing.id, file.content, "ai");
        } else {
          await saveFilesBatch(id, [{ path: file.path, content: file.content, source: "ai" }], "ai");
        }
      }

      await createProjectVersion(id, project?.ai_provider || "gemini", `scope:${scopeType}:${scopeValue}`);
      await setProjectStatus(id, "ready");
      await refreshProjectData();
      toast.success("Escopo regenerado");
    } catch (error) {
      console.error(error);
      await setProjectStatus(id, "error").catch(() => {});
      toast.error("Falha ao regenerar escopo");
    }
    setRegenerating(false);
  }, [filesByPath, id, project?.ai_provider, refreshProjectData, scopeInstruction, scopeType, scopeValue]);

  const handleDownload = useCallback(async () => {
    if (!id) return;
    setDownloading(true);
    try {
      const response = await supabase.functions.invoke<{ url: string }>("project-download-zip", {
        body: { project_id: id },
      });
      if (response.error || !response.data?.url) {
        throw response.error || new Error("Sem URL de download");
      }
      window.open(response.data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro no download";
      toast.error(message);
    }
    setDownloading(false);
  }, [id]);

  const handleClone = useCallback(async () => {
    if (!id) return;
    setCloning(true);
    try {
      const cloned = await cloneProject(id);
      navigate(`/builder/project/${cloned.id}`);
      toast.success("Projeto clonado");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao clonar projeto";
      toast.error(message);
    }
    setCloning(false);
  }, [id, navigate]);

  const handleScrollPreview = () => {
    const node = document.getElementById("project-preview-panel");
    if (node) node.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <p className="text-sm text-muted-foreground">Projeto não encontrado.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">{project.name}</h1>
            <p className="text-xs text-muted-foreground">status: {project.status} · provider: {project.ai_provider || "n/a"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => activeFileId && setActiveFileId(activeFileId)}>
              Abrir Editor
            </Button>
            <Button size="sm" variant="outline" onClick={handleScrollPreview}>
              Preview
            </Button>
            <Button size="sm" variant="outline" onClick={handleRegenerate} disabled={regenerating || !scopeValue.trim()}>
              Regenerar
            </Button>
            <Button size="sm" variant="outline" onClick={() => refreshProjectData()}>
              <RefreshCw className="mr-1 h-3 w-3" /> Atualizar
            </Button>
            <Button size="sm" variant="outline" onClick={handleClone} disabled={cloning}>
              <Copy className="mr-1 h-3 w-3" /> Clonar
            </Button>
            <Button size="sm" onClick={handleDownload} disabled={downloading}>
              <Download className="mr-1 h-3 w-3" /> Download ZIP
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading}>
              Exportar e rodar local
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-3 rounded-lg border border-border bg-card/30 p-2" style={{ minHeight: "78vh" }}>
          <div className="col-span-2 min-h-0">
            <ProjectFileTree tree={tree} activeFileId={activeFileId} onOpenFile={openFile} />
          </div>

          <div className="col-span-7 min-h-0 border border-border">
            <ProjectEditorCore
              filesById={filesById}
              openTabIds={openTabIds}
              activeFileId={activeFileId}
              draftByFileId={draftByFileId}
              dirtyByFileId={dirtyByFileId}
              savingByFileId={savingByFileId}
              versions={versions}
              onSelectTab={setActiveFileId}
              onCloseTab={closeTab}
              onChangeDraft={onChangeDraft}
              onSave={saveFileNow}
            />
          </div>

          <div className="col-span-3 min-h-0 border border-border">
            <ProjectPreviewPanel projectId={project.id} files={files} />
          </div>

          <div className="col-span-12 grid grid-cols-12 gap-3">
            <div className="col-span-4 rounded border border-border p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Regenerar Parte</p>
              <div className="space-y-2">
                <Select value={scopeType} onValueChange={(value) => setScopeType(value as ScopeType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="file">arquivo</SelectItem>
                    <SelectItem value="folder">pasta</SelectItem>
                    <SelectItem value="module">módulo</SelectItem>
                  </SelectContent>
                </Select>
                <Input value={scopeValue} onChange={(event) => setScopeValue(event.target.value)} placeholder="src/app/page.tsx" />
                <Input value={scopeInstruction} onChange={(event) => setScopeInstruction(event.target.value)} placeholder="instrução opcional" />
                <Button size="sm" onClick={handleRegenerate} disabled={regenerating || !scopeValue.trim()}>
                  {regenerating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                  Regenerar
                </Button>
              </div>
            </div>
            <div className="col-span-8 border border-border">
              <ProjectLogsPanel logs={logs} />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
