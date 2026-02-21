import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Enums, Tables } from "@/integrations/supabase/types";

type AccountStatus = "active" | "past_due" | "suspended";

interface AccountStatusContextType {
  accountStatus: AccountStatus;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  userRole: Enums<"app_role"> | "user";
  loading: boolean;
}

const AccountStatusContext = createContext<AccountStatusContextType>({
  accountStatus: "active",
  isAdmin: false,
  isSuperAdmin: false,
  userRole: "user",
  loading: true,
});

export function AccountStatusProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [accountStatus, setAccountStatus] = useState<AccountStatus>("active");
  const [userRole, setUserRole] = useState<Enums<"app_role"> | "user">("user");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const [profileRes, roleRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("account_status")
            .eq("user_id", user.id)
            .single(),
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id),
        ]);

        if (profileRes.data) {
          const status = profileRes.data.account_status as Tables<"profiles">["account_status"];
          if (status === "active" || status === "past_due" || status === "suspended") {
            setAccountStatus(status);
          }
        }

        if (roleRes.data && roleRes.data.length > 0) {
          const roles = roleRes.data.map((row) => row.role);
          if (roles.includes("superadmin")) {
            setUserRole("superadmin");
          } else if (roles.includes("admin")) {
            setUserRole("admin");
          } else {
            setUserRole("user");
          }
        } else {
          const [superRes, adminRes] = await Promise.all([
            supabase.rpc("has_role", { _user_id: user.id, _role: "superadmin" }),
            supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
          ]);
          if (superRes.data === true) {
            setUserRole("superadmin");
          } else if (adminRes.data === true) {
            setUserRole("admin");
          } else {
            setUserRole("user");
          }
        }
      } catch (error) {
        console.error("Failed to load account status", error);
        setUserRole("user");
        setAccountStatus("active");
      }

      setLoading(false);
    };

    load();
  }, [user]);

  const isAdmin = userRole === "admin" || userRole === "superadmin";
  const isSuperAdmin = userRole === "superadmin";

  return (
    <AccountStatusContext.Provider value={{ accountStatus, isAdmin, isSuperAdmin, userRole, loading }}>
      {children}
    </AccountStatusContext.Provider>
  );
}

export function useAccountStatus() {
  return useContext(AccountStatusContext);
}
