import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollText } from "lucide-react";
import { getPreviewRunnerLogs, getStoredSessionId } from "@/lib/previewRunnerClient";

interface Props {
  buildId: string;
}

export function BuilderLogs({ buildId }: Props) {
  const [logs, setLogs] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [runnerSessionId, setRunnerSessionId] = useState<string | null>(null);

  useEffect(() => {
    setRunnerSessionId(getStoredSessionId(buildId));
  }, [buildId]);

  useEffect(() => {
    if (runnerSessionId) {
      let stopped = false;

      const pull = async () => {
        try {
          const runtimeLogs = await getPreviewRunnerLogs(runnerSessionId);
          if (!stopped) {
            setLogs(runtimeLogs.join("\n"));
            setLoading(false);
          }
        } catch {
          if (!stopped) setLoading(false);
        }
      };

      pull();
      const interval = setInterval(pull, 2000);
      return () => {
        stopped = true;
        clearInterval(interval);
      };
    }

    supabase
      .from("build_previews")
      .select("logs_text")
      .eq("build_id", buildId)
      .maybeSingle()
      .then(({ data }) => {
        setLogs(data?.logs_text || null);
        setLoading(false);
      });
  }, [buildId, runnerSessionId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="glass-card rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <ScrollText className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-medium text-sm">Logs do Build</h3>
      </div>
      {logs ? (
        <pre className="bg-muted/50 rounded-md p-4 text-xs font-mono whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
          {logs}
        </pre>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum log disponível para este build.</p>
      )}
    </div>
  );
}
