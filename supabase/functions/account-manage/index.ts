import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "../../../lib/config.ts";

const PLAN_LIMITS: Record<string, number> = {
  starter: 50,
  pro: 150,
  elite: 500,
  free: 25,
};

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  console.log("CORS ORIGIN:", req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    getSupabaseUrl(),
    getSupabaseServiceRoleKey(),
  );

  const supabaseUser = createClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace("Bearer ", "");
  let userId: string | null = null;

  const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
  if (!claimsError && claimsData?.claims?.sub) {
    userId = claimsData.claims.sub;
  } else {
    const { data: userData, error: userError } = await supabaseUser.auth.getUser(token);
    if (!userError && userData?.user?.id) {
      userId = userData.user.id;
    }
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as {
      action?: string;
      payload?: Record<string, unknown>;
    };

    const action = body.action;
    if (!action) {
      return new Response(JSON.stringify({ error: "Missing action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isAdminAction =
      action === "admin_clear_user_history" ||
      action === "admin_delete_user" ||
      action === "admin_delete_audit_log" ||
      action === "admin_clear_subscription_logs";
    if (isAdminAction) {
      const { data: callerRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      const roleList = (callerRoles || []).map((row) => row.role);
      const canAdmin = roleList.includes("admin") || roleList.includes("superadmin");
      if (!canAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "update_plan") {
      const plan = String(body.payload?.plan || "").toLowerCase();
      if (!PLAN_LIMITS[plan]) {
        return new Response(JSON.stringify({ error: "Invalid plan" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const limit = PLAN_LIMITS[plan];
      await supabaseAdmin.from("user_quotas")
        .update({ plan, monthly_limit: limit })
        .eq("user_id", userId);
      await supabaseAdmin.from("profiles")
        .update({ plan })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ ok: true, plan, monthly_limit: limit }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "add_credits") {
      const amount = Number(body.payload?.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return new Response(JSON.stringify({ error: "Invalid amount" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: quota } = await supabaseAdmin
        .from("user_quotas")
        .select("monthly_limit")
        .eq("user_id", userId)
        .single();

      const newLimit = (quota?.monthly_limit || 0) + amount;
      await supabaseAdmin.from("user_quotas")
        .update({ monthly_limit: newLimit })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ ok: true, monthly_limit: newLimit }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "cancel_subscription") {
      await supabaseAdmin.from("user_quotas")
        .update({ plan: "free", monthly_limit: PLAN_LIMITS.free })
        .eq("user_id", userId);
      await supabaseAdmin.from("profiles")
        .update({ plan: "free" })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ ok: true, plan: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_account") {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteError) {
        throw deleteError;
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "admin_clear_user_history") {
      const targetUserId = String(body.payload?.target_user_id || "");
      if (!targetUserId) {
        return new Response(JSON.stringify({ error: "Missing target_user_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin.from("builds").delete().eq("user_id", targetUserId);
      await supabaseAdmin.from("generations").delete().eq("user_id", targetUserId);

      await supabaseAdmin.from("audit_logs").insert({
        actor_user_id: userId,
        target_user_id: targetUserId,
        action: "admin_clear_user_history",
        entity_type: "history",
        entity_id: targetUserId,
      });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "admin_delete_user") {
      const targetUserId = String(body.payload?.target_user_id || "");
      if (!targetUserId) {
        return new Response(JSON.stringify({ error: "Missing target_user_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
      if (deleteError) {
        throw deleteError;
      }

      await supabaseAdmin.from("audit_logs").insert({
        actor_user_id: userId,
        target_user_id: targetUserId,
        action: "admin_delete_user",
        entity_type: "auth_user",
        entity_id: targetUserId,
      });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "admin_delete_audit_log") {
      const logId = String(body.payload?.log_id || "");
      if (!logId) {
        return new Response(JSON.stringify({ error: "Missing log_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: deleteError } = await supabaseAdmin
        .from("audit_logs")
        .delete()
        .eq("id", logId);

      if (deleteError) {
        throw deleteError;
      }

      await supabaseAdmin.from("audit_logs").insert({
        actor_user_id: userId,
        action: "admin_delete_audit_log",
        entity_type: "audit_log",
        entity_id: logId,
      });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "admin_clear_subscription_logs") {
      const { error: clearError } = await supabaseAdmin
        .from("audit_logs")
        .delete()
        .in("action", [
          "quota_reset",
          "admin_clear_user_history",
          "admin_delete_user",
          "admin_delete_audit_log",
          "plan_changed_to_free",
          "plan_changed_to_starter",
          "plan_changed_to_pro",
          "plan_changed_to_elite",
          "status_changed_to_active",
          "status_changed_to_past_due",
          "status_changed_to_suspended",
        ]);

      if (clearError) {
        throw clearError;
      }

      await supabaseAdmin.from("audit_logs").insert({
        actor_user_id: userId,
        action: "admin_clear_subscription_logs",
        entity_type: "audit_log",
      });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("function error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});