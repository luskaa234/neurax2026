import { useState, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, File, FolderOpen, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BuildFile {
  id: string;
  path: string;
  content_text: string;
}

interface Props {
  buildId: string;
  files: BuildFile[];
  onFilesChange: (files: BuildFile[]) => void;
}

function getLanguage(path: string): string {
  if (path.endsWith(".tsx") || path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".jsx") || path.endsWith(".js")) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".sql")) return "sql";
  return "plaintext";
}

function buildTree(files: BuildFile[]): Map<string, BuildFile[]> {
  const tree = new Map<string, BuildFile[]>();
  for (const f of files) {
    const parts = f.path.split("/");
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
    if (!tree.has(dir)) tree.set(dir, []);
    tree.get(dir)!.push(f);
  }
  return tree;
}

export function BuilderEditor({ buildId, files, onFilesChange }: Props) {
  const [selectedFile, setSelectedFile] = useState<BuildFile | null>(files[0] || null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (!selectedFile || value === undefined) return;
    const updated = files.map((f) =>
      f.id === selectedFile.id ? { ...f, content_text: value } : f
    );
    onFilesChange(updated);
    setSelectedFile({ ...selectedFile, content_text: value });
    setDirty(true);
  }, [selectedFile, files, onFilesChange]);

  const handleSave = async () => {
    if (!selectedFile) return;
    setSaving(true);
    const { error } = await supabase
      .from("build_files")
      .update({ content_text: selectedFile.content_text })
      .eq("id", selectedFile.id);
    if (error) {
      toast.error("Erro ao salvar arquivo");
    } else {
      toast.success("Arquivo salvo");
      setDirty(false);
    }
    setSaving(false);
  };

  // Group files by directory
  const dirs = Array.from(new Set(files.map((f) => {
    const parts = f.path.split("/");
    return parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
  }))).sort();

  return (
    <div className="flex border border-border rounded-lg overflow-hidden" style={{ height: "70vh" }}>
      {/* File Tree */}
      <div className="w-60 border-r border-border bg-card/50 flex flex-col">
        <div className="p-2 border-b border-border flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <FolderOpen className="h-3.5 w-3.5" /> Arquivos ({files.length})
        </div>
        <ScrollArea className="flex-1">
          <div className="p-1">
            {dirs.map((dir) => (
              <div key={dir}>
                {dir !== "." && (
                  <div className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground font-medium">
                    <ChevronRight className="h-3 w-3" />
                    {dir}
                  </div>
                )}
                {files
                  .filter((f) => {
                    const parts = f.path.split("/");
                    const fDir = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
                    return fDir === dir;
                  })
                  .map((f) => {
                    const fileName = f.path.split("/").pop() || f.path;
                    return (
                      <button
                        key={f.id}
                        onClick={() => { setSelectedFile(f); setDirty(false); }}
                        className={cn(
                          "flex items-center gap-2 w-full px-3 py-1.5 text-xs rounded-sm transition-colors text-left",
                          selectedFile?.id === f.id
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <File className="h-3 w-3 shrink-0" />
                        <span className="truncate">{fileName}</span>
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        {selectedFile ? (
          <>
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/30">
              <span className="text-xs text-muted-foreground font-mono">{selectedFile.path}</span>
              <Button size="sm" variant="outline" onClick={handleSave} disabled={!dirty || saving}>
                <Save className="mr-1.5 h-3 w-3" />
                {saving ? "Salvando..." : dirty ? "Salvar" : "Salvo"}
              </Button>
            </div>
            <div className="flex-1">
              <Editor
                height="100%"
                language={getLanguage(selectedFile.path)}
                value={selectedFile.content_text}
                onChange={handleEditorChange}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  tabSize: 2,
                  automaticLayout: true,
                }}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Selecione um arquivo para editar
          </div>
        )}
      </div>
    </div>
  );
}
