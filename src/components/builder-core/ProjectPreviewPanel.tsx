import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Eye } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectFileRow } from "@/services/projectService";

interface Props {
  projectId: string;
  files: ProjectFileRow[];
}

function extractRoutes(files: ProjectFileRow[]): string[] {
  return files
    .filter((file) => file.path.startsWith("src/app/") && file.path.endsWith("page.tsx"))
    .map((file) => {
      const route = file.path
        .replace("src/app", "")
        .replace(/\/page\.tsx$/, "")
        .replace(/\/+/g, "/");
      return route || "/";
    })
    .sort((a, b) => a.localeCompare(b));
}

export function ProjectPreviewPanel({ projectId, files }: Props) {
  const routes = useMemo(() => extractRoutes(files), [files]);
  const [selectedRoute, setSelectedRoute] = useState<string>(routes[0] || "/");
  const [renderedHtml, setRenderedHtml] = useState<string>("");
  const [previewFallback, setPreviewFallback] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedFile = useMemo(() => {
    const targetPath = selectedRoute === "/" ? "src/app/page.tsx" : `src/app${selectedRoute}/page.tsx`;
    return files.find((file) => file.path === targetPath) || files[0] || null;
  }, [files, selectedRoute]);

  useEffect(() => {
    let cancelled = false;

    const loadPreview = async () => {
      if (!projectId) return;
      setLoading(true);
      try {
        const response = await supabase.functions.invoke<{ html?: string; fallback?: boolean }>("preview-render", {
          body: { project_id: projectId, route: selectedRoute },
        });

        if (cancelled) return;

        if (response.error || !response.data?.html) {
          setPreviewFallback(true);
          setRenderedHtml("");
        } else {
          setPreviewFallback(Boolean(response.data.fallback));
          setRenderedHtml(response.data.html);
        }
      } catch {
        if (!cancelled) {
          setPreviewFallback(true);
          setRenderedHtml("");
        }
      }
      if (!cancelled) setLoading(false);
    };

    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [projectId, selectedRoute]);

  const copyCommands = async () => {
    await navigator.clipboard.writeText("npm install\nnpm run dev");
    toast.success("Comandos copiados");
  };

  return (
    <div id="project-preview-panel" className="flex h-full flex-col border-l border-border bg-card/30">
      <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">Preview</div>
      <div className="space-y-2 p-3">
        <label className="text-xs text-muted-foreground">Rota</label>
        <select
          className="w-full rounded border bg-background px-2 py-1 text-xs"
          value={selectedRoute}
          onChange={(event) => setSelectedRoute(event.target.value)}
        >
          {routes.length ? (
            routes.map((route) => (
              <option key={route} value={route}>
                {route}
              </option>
            ))
          ) : (
            <option value="/">/</option>
          )}
        </select>
      </div>

      <div className="h-full overflow-auto px-3 pb-3">
        {loading ? (
          <div className="flex h-[280px] items-center justify-center rounded border text-xs text-muted-foreground">
            <Eye className="mr-2 h-3 w-3" /> Renderizando preview...
          </div>
        ) : !previewFallback && renderedHtml ? (
          <iframe title="Virtual Preview" className="h-[280px] w-full rounded border bg-white" srcDoc={renderedHtml} />
        ) : (
          <div className="space-y-3 rounded border p-3">
            <p className="text-xs text-muted-foreground">Preview estrutural + fallback local</p>
            <pre className="max-h-[180px] overflow-auto rounded bg-muted p-2 text-xs">{selectedFile?.content || "Sem conteúdo."}</pre>
            <Button size="sm" variant="outline" onClick={copyCommands}>
              <Copy className="mr-1 h-3 w-3" /> Copiar comandos para rodar local
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
