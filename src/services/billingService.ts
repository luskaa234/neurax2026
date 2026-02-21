import { supabase } from "@/integrations/supabase/client";

export type AccountStatus = "active" | "past_due" | "suspended";

export async function updateAccountStatus(userId: string, status: AccountStatus): Promise<void> {
  await supabase.from("profiles").update({ status }).eq("user_id", userId);
  await supabase.from("billing_events").insert({
    user_id: userId,
    event_type: "status_change",
    status,
    provider: "manual",
    payload: { reason: "admin_action" },
  });
}

export async function ensureBillingAccessOrThrow(): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("unauthorized");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("status")
    .eq("user_id", userData.user.id)
    .single();

  if (error) throw new Error(error.message);
  if (data?.status === "suspended") {
    throw new Error("account_suspended");
  }
}
