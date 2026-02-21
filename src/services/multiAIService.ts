import { supabase } from "@/integrations/supabase/client";

export interface GenerateAIInput {
  task: "intent_parse" | "scaffold_extend" | "module_regen" | "file_regen";
  payload: Record<string, unknown>;
}

export async function generateAIWithRouter(input: GenerateAIInput): Promise<Record<string, unknown>> {
  if (input.task === "intent_parse") {
    const { data, error } = await supabase.functions.invoke("parse-system-intent", {
      body: { description: String(input.payload.description || "") },
    });
    if (error) throw error;
    return data as Record<string, unknown>;
  }

  const { data, error } = await supabase.functions.invoke("generate-content", {
    body: {
      category: "system_builder",
      fields: input.payload,
      context: { description: String(input.payload.description || "") },
    },
  });

  if (error) throw error;
  return data as Record<string, unknown>;
}
