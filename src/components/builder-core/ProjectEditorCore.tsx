import { useMemo, useState } from "react";
import Editor, { DiffEditor } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { detectCodeLanguage } from "@/lib/codeLanguage";
import type { ProjectFileRow, ProjectFileVersionRow } from "@/services/projectService";

interface Props {
  filesById: Map<string, ProjectFileRow>;
  openTabIds: string[];
  activeFileId: string | null;
  draftByFileId: Record<string, string>;
  dirtyByFileId: Record<string, boolean>;
  savingByFileId: Record<string, boolean>;
  versions: ProjectFileVersionRow[];
  onSelectTab: (fileId: string) => void;
  onCloseTab: (fileId: string) => void;
  onChangeDraft: (fileId: string, content: string) => void;
  onSave: (fileId: string) => Promise<void>;
}

export function ProjectEditorCore({
  filesById,
  openTabIds,
  activeFileId,
  draftByFileId,
  dirtyByFileId,
  savingByFileId,
  versions,
  onSelectTab,
  onCloseTab,
  onChangeDraft,
  onSave,
}: Props) {
  const [diffMode, setDiffMode] = useState(false);
  const [baseVersionId, setBaseVersionId] = useState<string>("");

  const activeFile = activeFileId ? filesById.get(activeFileId) || null : null;

  const editorValue = activeFile ? draftByFileId[activeFile.id] ?? activeFile.content : "";

  const baseVersion = useMemo(
    () => versions.find((v) => v.id === baseVersionId) || versions[0] || null,
    [versions, baseVersionId],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex items-center gap-1 px-2 py-1">
            {openTabIds.map((tabId) => {
              const file = filesById.get(tabId);
              if (!file) return null;
              const isActive = tabId === activeFileId;
              const isDirty = !!dirtyByFileId[tabId];
              return (
                <div
                  key={tabId}
                  className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                >
                  <button onClick={() => onSelectTab(tabId)}>{file.path.split("/").pop() || file.path}{isDirty ? " *" : ""}</button>
                  <button className="text-muted-foreground hover:text-foreground" onClick={() => onCloseTab(tabId)}>x</button>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {!activeFile ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Selecione um arquivo</div>
      ) : (
        <>
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs">
            <span className="font-mono text-muted-foreground">{activeFile.path}</span>
            <div className="flex items-center gap-2">
              <select
                className="h-7 rounded border bg-background px-2 text-xs"
                value={baseVersionId}
                onChange={(event) => setBaseVersionId(event.target.value)}
              >
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {new Date(version.created_at).toLocaleString("pt-BR")} ({version.source})
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={() => setDiffMode((value) => !value)}>
                {diffMode ? "Editor" : "Diff"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => onSave(activeFile.id)} disabled={!dirtyByFileId[activeFile.id] || savingByFileId[activeFile.id]}>
                {savingByFileId[activeFile.id] ? "Salvando..." : dirtyByFileId[activeFile.id] ? "Salvar" : "Salvo"}
              </Button>
            </div>
          </div>
          <div className="h-full">
            {diffMode ? (
              <DiffEditor
                original={baseVersion?.content || ""}
                modified={editorValue}
                language={detectCodeLanguage(activeFile.path)}
                theme="vs-dark"
                height="100%"
                options={{ readOnly: true, renderSideBySide: true, minimap: { enabled: false }, automaticLayout: true }}
              />
            ) : (
              <Editor
                height="100%"
                language={detectCodeLanguage(activeFile.path)}
                value={editorValue}
                onChange={(value) => onChangeDraft(activeFile.id, value || "")}
                theme="vs-dark"
                options={{ minimap: { enabled: false }, automaticLayout: true, fontSize: 13, wordWrap: "on", tabSize: 2 }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
