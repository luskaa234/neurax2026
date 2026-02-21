import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, ExternalLink, File, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import {
  clearStoredSessionId,
  getPreviewRunnerSession,
  getStoredSessionId,
  startPreviewRunner,
  stopPreviewRunner,
  storeSessionId,
  type PreviewRunnerSession,
} from "@/lib/previewRunnerClient";

interface Props {
  buildId: string;
}

interface BuildFileRow {
  path: string;
  content_text: string;
}

export function BuilderPreview({ buildId }: Props) {
  const [preview, setPreview] = useState<Tables<"build_previews"> | null>(null);
  const [files, setFiles] = useState<BuildFileRow[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<PreviewRunnerSession | null>(null);
  const [runnerLoading, setRunnerLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase
        .from("build_previews")
        .select("*")
        .eq("build_id", buildId)
        .maybeSingle(),
      supabase
        .from("build_files")
        .select("path, content_text")
        .eq("build_id", buildId)
        .order("path"),
    ]).then(([previewRes, filesRes]) => {
      setPreview(previewRes.data);
      setFiles(filesRes.data || []);
      setSelectedPath((filesRes.data && filesRes.data[0]?.path) || null);
      setLoading(false);
    });
    setSessionId(getStoredSessionId(buildId));
  }, [buildId]);

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      return;
    }

    let stopped = false;

    const pull = async () => {
      try {
        const data = await getPreviewRunnerSession(sessionId);
        if (!stopped) setSession(data);
        if (data.state === "stopped") {
          clearStoredSessionId(buildId);
          if (!stopped) setSessionId(null);
        }
      } catch (error) {
        if (!stopped) {
          const message = error instanceof Error ? error.message : "Falha ao consultar runner";
          if (message.includes("not found")) {
            clearStoredSessionId(buildId);
            setSessionId(null);
          }
        }
      }
    };

    pull();
    const interval = setInterval(pull, 2000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [buildId, sessionId]);

  const selectedFile = useMemo(
    () => files.find((file) => file.path === selectedPath) || files[0] || null,
    [files, selectedPath],
  );

  const executableCommands = "npm install\nnpm run dev\n# depois abra http://localhost:3000";

  const handleCopyCommands = async () => {
    try {
      await navigator.clipboard.writeText(executableCommands);
      toast.success("Comandos copiados para a área de transferência.");
    } catch {
      toast.error("Não foi possível copiar os comandos.");
    }
  };

  const handleStartRunner = async () => {
    setRunnerLoading(true);
    try {
      const nextSession = await startPreviewRunner(buildId);
      setSession(nextSession);
      setSessionId(nextSession.id);
      storeSessionId(buildId, nextSession.id);
      toast.success("Runner iniciado. Preparando preview executavel.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao iniciar runner";
      toast.error(message);
    }
    setRunnerLoading(false);
  };

  const handleStopRunner = async () => {
    if (!sessionId) return;
    setRunnerLoading(true);
    try {
      const stoppedSession = await stopPreviewRunner(sessionId);
      setSession(stoppedSession);
      clearStoredSessionId(buildId);
      setSessionId(null);
      toast.success("Runner encerrado.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao encerrar runner";
      toast.error(message);
    }
    setRunnerLoading(false);
  };

  const canStop = !!sessionId && !!session && session.state !== "stopped";
  const isRunning = session?.status === "running" && !!session.url;
  const hasRunnerFailure = session?.status === "failed";

  const fileGroups = useMemo(() => {
    return Array.from(
      new Set(
        files.map((file) => {
          const parts = file.path.split("/");
          return parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
        }),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [files]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline">Preview estrutural + preview executavel local.</Badge>
          {session?.status && <span className="text-xs text-muted-foreground">Runner: {session.status}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleStartRunner} disabled={runnerLoading || !!canStop}>
            Rodar Local
          </Button>
          <Button size="sm" variant="outline" onClick={handleStopRunner} disabled={runnerLoading || !canStop}>
            Parar Runner
          </Button>
        </div>
      </div>

      <Tabs defaultValue="structural" className="w-full">
        <TabsList>
          <TabsTrigger value="structural">Preview estrutural</TabsTrigger>
          <TabsTrigger value="executable">Preview executavel</TabsTrigger>
        </TabsList>

        <TabsContent value="structural" className="mt-4">
          <div className="flex border border-border rounded-lg overflow-hidden" style={{ height: "65vh" }}>
            <div className="w-72 border-r border-border bg-card/50 flex flex-col">
              <div className="p-2 border-b border-border flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <FolderOpen className="h-3.5 w-3.5" /> File tree ({files.length})
              </div>
              <ScrollArea className="flex-1">
                <div className="p-1">
                  {fileGroups.map((group) => (
                    <div key={group}>
                      {group !== "." && (
                        <p className="px-2 py-1 text-xs font-medium text-muted-foreground">{group}</p>
                      )}
                      {files
                        .filter((file) => {
                          const parts = file.path.split("/");
                          const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
                          return dir === group;
                        })
                        .map((file) => {
                          const fileName = file.path.split("/").pop() || file.path;
                          const isSelected = selectedFile?.path === file.path;
                          return (
                            <button
                              key={file.path}
                              onClick={() => setSelectedPath(file.path)}
                              className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs rounded-sm text-left transition-colors ${
                                isSelected
                                  ? "bg-primary/10 text-primary"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              }`}
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

            <div className="flex-1 flex flex-col">
              <div className="px-3 py-2 border-b border-border bg-card/30 text-xs text-muted-foreground">
                Editor (somente leitura): {selectedFile?.path || "Nenhum arquivo selecionado"}
              </div>
              <div className="flex-1 overflow-auto bg-[#0d1117] text-[#f5f5f5]">
                <pre className="text-xs leading-5 p-4 whitespace-pre-wrap">
                  {selectedFile?.content_text || "Nenhum conteúdo disponível para preview."}
                </pre>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="executable" className="mt-4">
          <div className="border border-border rounded-lg p-4 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Preview executavel com runner local</h3>
              <p className="text-sm text-muted-foreground">Status: {session?.status || "idle"}</p>
            </div>

            {isRunning && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  URL local: <a className="underline" href={session.url!} target="_blank" rel="noreferrer">{session.url}</a>
                  {session.port ? ` (porta ${session.port})` : ""}
                </div>
                <iframe
                  src={session.url!}
                  title="Runtime preview"
                  className="w-full h-[60vh] border rounded-md bg-background"
                />
              </div>
            )}

            {!isRunning && (
              <pre className="rounded-md border border-border bg-muted p-3 text-xs leading-5">
{`npm install
npm run dev
# abrir http://localhost:3000`}
              </pre>
            )}

            {hasRunnerFailure && (
              <p className="text-sm text-destructive">
                Runner falhou: {session?.lastError || "erro desconhecido"}. Use fallback estrutural e os comandos manuais.
              </p>
            )}

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleCopyCommands}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copiar comandos de execução
              </Button>
              {preview?.preview_url && (
                <Button size="sm" variant="ghost" asChild>
                  <a href={preview.preview_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Abrir deploy externo
                  </a>
                </Button>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
