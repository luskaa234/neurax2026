import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { AlertTriangle } from "lucide-react";

export default function SuspendedPage() {
  const { signOut } = useAuth();
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="fixed right-4 top-4 z-10 flex items-center gap-1 rounded-md border border-border/60 bg-card/70 px-1 py-1 backdrop-blur-sm">
        <ThemeToggle />
        <LanguageSelector />
      </div>
      <div className="glass-card rounded-lg p-8 max-w-md text-center space-y-4">
        <AlertTriangle className="mx-auto h-12 w-12 text-warning" />
        <h1 className="text-xl font-bold">{t("billing.suspended")}</h1>
        <p className="text-muted-foreground text-sm">{t("billing.suspendedMessage")}</p>
        <Button variant="outline" onClick={signOut}>{t("nav.logout")}</Button>
      </div>
    </div>
  );
}
