import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function getAccountStatus(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<"active" | "past_due" | "suspended" | null> {
  if (!userId) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("account_status")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error({
        scope: "account-status",
        provider: "supabase",
        status: 500,
        message: error.message,
      });
      return null;
    }

    const status = data?.account_status;
    if (status === "active" || status === "past_due" || status === "suspended") {
      return status;
    }

    return null;
  } catch (error) {
    console.error({
      scope: "account-status",
      provider: "supabase",
      status: 500,
      message: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

export function isBillingBlocked(status: "active" | "past_due" | "suspended" | null): boolean {
  return status === "past_due" || status === "suspended";
}

export function getBillingBlockedReason(status: "active" | "past_due" | "suspended" | null): string {
  if (status === "past_due") {
    return "Pagamento pendente. Regularize a assinatura para gerar novos sistemas.";
  }
  if (status === "suspended") {
    return "Conta suspensa por inadimplência.";
  }
  return "Acesso de geração indisponível para este usuário.";
}
