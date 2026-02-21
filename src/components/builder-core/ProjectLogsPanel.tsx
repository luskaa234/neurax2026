import type { Tables } from "@/integrations/supabase/types";

interface Props {
  logs: Tables<"project_logs">[];
}

export function ProjectLogsPanel({ logs }: Props) {
  return (
    <div className="h-full border-t border-border bg-card/30">
      <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">Logs</div>
      <div className="h-[180px] overflow-auto p-3">
        {logs.length ? (
          <ul className="space-y-1">
            {logs.map((log) => (
              <li key={log.id} className="font-mono text-xs text-muted-foreground">
                [{new Date(log.timestamp).toLocaleString("pt-BR")}] {log.action}
                {log.file_path ? ` (${log.file_path})` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Sem logs.</p>
        )}
      </div>
    </div>
  );
}
