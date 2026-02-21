import { supabase } from "@/integrations/supabase/client";

export interface StructuredLog {
  event: string;
  level: "info" | "warn" | "error";
  projectId?: string;
  context?: Record<string, unknown>;
}

export async function logAuditEvent(log: StructuredLog): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  await supabase.from("audit_logs").insert({
    actor_user_id: userId,
    target_user_id: userId,
    action: log.event,
    entity_type: log.projectId ? "project" : "system",
    entity_id: log.projectId || null,
    meta_json: {
      level: log.level,
      ...log.context,
    },
  });
}
