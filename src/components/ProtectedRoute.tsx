import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAccountStatus } from "@/hooks/useAccountStatus";
import { AlertTriangle } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { accountStatus, loading: statusLoading } = useAccountStatus();
  const location = useLocation();

  if (loading || statusLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Suspended users can only access /account/suspended
  if (accountStatus === "suspended" && location.pathname !== "/account/suspended") {
    return <Navigate to="/account/suspended" replace />;
  }

  return <>{children}</>;
}

export function PastDueBanner() {
  const { accountStatus } = useAccountStatus();
  const { t } = useI18n();

  if (accountStatus !== "past_due") return null;

  return (
    <div className="bg-warning/10 border-b border-warning/30 px-4 py-2 flex items-center gap-2 text-sm text-warning">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{t("billing.pastDueBanner")}</span>
    </div>
  );
}
