import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type ProjectRow = Tables<"projects">;
export type ProjectFileRow = Tables<"project_files">;
export type ProjectFileVersionRow = Tables<"project_file_versions">;
export type ProjectVersionRow = Tables<"project_versions">;

export interface CreateProjectInput {
  user_id: string;
  name: string;
  description?: string | null;
  stack?: string[];
  ai_provider?: string | null;
  creation_mode?: "intent" | "manual" | null;
  original_prompt?: string | null;
  parsed_prompt?: string | null;
  status?: "draft" | "parsing" | "generating" | "writing" | "building" | "ready" | "error";
}

export interface SaveFileInput {
  path: string;
  content: string;
  source?: "ai" | "manual";
}

async function sha256(content: string): Promise<string> {
  const data = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) {
    throw new Error("Usuário não autenticado");
  }
  return data.user.id;
}

async function logProjectAction(projectId: string, action: string, filePath?: string | null, userId?: string): Promise<void> {
  const actorId = userId ?? (await getCurrentUserId());
  const payload: TablesInsert<"project_logs"> = {
    project_id: projectId,
    action,
    file_path: filePath ?? null,
    user_id: actorId,
  };

  const { error } = await supabase.from("project_logs").insert(payload);
  if (error) {
    console.warn("project log error", error.message);
  }
}

export async function createProject(input: CreateProjectInput): Promise<ProjectRow> {
  const payload: TablesInsert<"projects"> = {
    user_id: input.user_id,
    name: input.name,
    description: input.description ?? null,
    stack: input.stack ?? [],
    ai_provider: input.ai_provider ?? null,
    creation_mode: input.creation_mode ?? null,
    original_prompt: input.original_prompt ?? null,
    parsed_prompt: input.parsed_prompt ?? null,
    status: input.status ?? "draft",
  };

  const { data, error } = await supabase.from("projects").insert(payload).select("*").single();
  if (error || !data) {
    throw new Error(error?.message || "Erro ao criar projeto");
  }

  await logProjectAction(data.id, "project_created", null, input.user_id);
  return data;
}

export async function saveFilesBatch(projectId: string, files: SaveFileInput[], source: "ai" | "manual" = "ai"): Promise<ProjectFileRow[]> {
  if (files.length === 0) return [];

  const rows: TablesInsert<"project_files">[] = await Promise.all(
    files.map(async (file) => {
      const normalizedContent = file.content ?? "";
      return {
        project_id: projectId,
        path: file.path,
        content: normalizedContent,
        hash: await sha256(normalizedContent),
        size: normalizedContent.length,
        is_dirty: false,
      };
    }),
  );

  const { data, error } = await supabase
    .from("project_files")
    .upsert(rows, { onConflict: "project_id,path" })
    .select("*");

  if (error || !data) {
    throw new Error(error?.message || "Erro ao salvar arquivos");
  }

  const versions: TablesInsert<"project_file_versions">[] = data.map((fileRow) => ({
    file_id: fileRow.id,
    content: fileRow.content,
    source,
  }));

  const { error: versionsError } = await supabase.from("project_file_versions").insert(versions);
  if (versionsError) {
    throw new Error(versionsError.message);
  }

  for (const row of data) {
    await logProjectAction(projectId, "file_saved", row.path);
  }

  return data;
}

export async function listProjectFiles(projectId: string): Promise<ProjectFileRow[]> {
  const { data, error } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .order("path");

  if (error) {
    throw new Error(error.message);
  }
  return data || [];
}

export async function getFileContent(fileId: string): Promise<ProjectFileRow | null> {
  const { data, error } = await supabase
    .from("project_files")
    .select("*")
    .eq("id", fileId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function createFileVersion(fileId: string, content: string, source: "ai" | "manual" = "manual"): Promise<ProjectFileVersionRow> {
  const payload: TablesInsert<"project_file_versions"> = {
    file_id: fileId,
    content,
    source,
  };

  const { data, error } = await supabase
    .from("project_file_versions")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Erro ao criar versão de arquivo");
  }

  return data;
}

export async function updateFile(
  fileId: string,
  content: string,
  source: "ai" | "manual" = "manual",
): Promise<ProjectFileRow> {
  const { data: current, error: currentError } = await supabase
    .from("project_files")
    .select("id, project_id, path")
    .eq("id", fileId)
    .single();

  if (currentError || !current) {
    throw new Error(currentError?.message || "Arquivo não encontrado");
  }

  const updatePayload: TablesUpdate<"project_files"> = {
    content,
    hash: await sha256(content),
    size: content.length,
    is_dirty: false,
  };

  const { data, error } = await supabase
    .from("project_files")
    .update(updatePayload)
    .eq("id", fileId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Erro ao atualizar arquivo");
  }

  await createFileVersion(fileId, content, source);
  await logProjectAction(current.project_id, source === "ai" ? "file_regenerated" : "file_updated", current.path);

  return data;
}

export async function createProjectVersion(
  projectId: string,
  aiProvider: string | null,
  buildNotes: string,
): Promise<ProjectVersionRow> {
  const { data: latestVersion } = await supabase
    .from("project_versions")
    .select("version")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latestVersion?.version || 0) + 1;

  const payload: TablesInsert<"project_versions"> = {
    project_id: projectId,
    version: nextVersion,
    ai_provider: aiProvider,
    build_notes: buildNotes,
  };

  const { data, error } = await supabase.from("project_versions").insert(payload).select("*").single();
  if (error || !data) {
    throw new Error(error?.message || "Erro ao criar versão do projeto");
  }

  await logProjectAction(projectId, "project_version_created");
  return data;
}

export async function cloneProject(projectId: string): Promise<ProjectRow> {
  const userId = await getCurrentUserId();

  const { data: sourceProject, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (projectError || !sourceProject) {
    throw new Error(projectError?.message || "Projeto não encontrado");
  }

  const clonedProject = await createProject({
    user_id: userId,
    name: `${sourceProject.name} (Clone)`,
    description: sourceProject.description,
    stack: sourceProject.stack,
    ai_provider: sourceProject.ai_provider,
    creation_mode: sourceProject.creation_mode,
    original_prompt: sourceProject.original_prompt,
    parsed_prompt: sourceProject.parsed_prompt,
    status: "draft",
  });

  const files = await listProjectFiles(projectId);
  const clonedFiles = await saveFilesBatch(
    clonedProject.id,
    files.map((file) => ({ path: file.path, content: file.content, source: "ai" })),
    "ai",
  );

  const sourceVersions = await supabase
    .from("project_versions")
    .select("version, ai_provider, build_notes")
    .eq("project_id", projectId)
    .order("version", { ascending: true });

  if (sourceVersions.data?.length) {
    const versionRows: TablesInsert<"project_versions">[] = sourceVersions.data.map((version) => ({
      project_id: clonedProject.id,
      version: version.version,
      ai_provider: version.ai_provider,
      build_notes: version.build_notes,
    }));
    await supabase.from("project_versions").insert(versionRows);
  }

  const sourceFileVersions = await supabase
    .from("project_file_versions")
    .select("file_id, content, source")
    .in("file_id", files.map((file) => file.id));

  if (sourceFileVersions.data?.length) {
    const fileIdByPath = new Map(clonedFiles.map((f) => [f.path, f.id]));
    const sourcePathById = new Map(files.map((f) => [f.id, f.path]));

    const versionRows: TablesInsert<"project_file_versions">[] = [];
    for (const version of sourceFileVersions.data) {
      const path = sourcePathById.get(version.file_id);
      if (!path) continue;
      const clonedFileId = fileIdByPath.get(path);
      if (!clonedFileId) continue;
      versionRows.push({
        file_id: clonedFileId,
        content: version.content,
        source: version.source,
      });
    }

    if (versionRows.length) {
      await supabase.from("project_file_versions").insert(versionRows);
    }
  }

  await logProjectAction(clonedProject.id, "project_cloned", null, userId);
  return clonedProject;
}

export async function setProjectStatus(projectId: string, status: ProjectRow["status"]): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  await logProjectAction(projectId, `status_${status}`);
}

export async function listProjectFileVersions(fileId: string): Promise<ProjectFileVersionRow[]> {
  const { data, error } = await supabase
    .from("project_file_versions")
    .select("*")
    .eq("file_id", fileId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function listProjectLogs(projectId: string): Promise<Tables<"project_logs">[]> {
  const { data, error } = await supabase
    .from("project_logs")
    .select("*")
    .eq("project_id", projectId)
    .order("timestamp", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}
