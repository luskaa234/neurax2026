import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAccountStatus } from "@/hooks/useAccountStatus";
import { useI18n } from "@/hooks/useI18n";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { PastDueBanner } from "@/components/ProtectedRoute";
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  History,
  LogOut,
  Menu,
  X,
  Package,
  Shield,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { signOut, user } = useAuth();
  const { isAdmin } = useAccountStatus();
  const { t } = useI18n();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const navItems = [
    { to: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { to: "/projects", label: t("nav.projects"), icon: FolderOpen },
    { to: "/builder", label: t("nav.builder"), icon: Package },
    { to: "/templates", label: t("nav.templates"), icon: FileText },
    { to: "/history", label: t("nav.history"), icon: History },
    ...(isAdmin ? [{ to: "/admin", label: t("nav.admin"), icon: Shield }] : []),
  ];

  const mobileQuickNav = navItems.slice(0, 3);

  const renderNavLink = (
    item: { to: string; label: string; icon: React.ComponentType<{ className?: string }> },
    compact = false,
  ) => {
    const active = location.pathname.startsWith(item.to);

    return (
      <Link
        key={item.to}
        to={item.to}
        title={compact ? item.label : undefined}
        className={cn(
          "group flex items-center rounded-lg text-sm font-medium transition-all",
          compact ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
          active
            ? "bg-primary/10 text-primary ring-1 ring-primary/30 shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <item.icon
          className={cn(
            "h-4 w-4 shrink-0",
            active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
          )}
        />
        {!compact && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen flex-col border-r border-border bg-card/60 p-4 backdrop-blur-xl transition-all lg:flex",
          desktopCollapsed ? "lg:w-24" : "lg:w-72",
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-3">
          <div className={cn("min-w-0", desktopCollapsed && "sr-only")}>
            <Logo />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={desktopCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
            onClick={() => setDesktopCollapsed((prev) => !prev)}
          >
            {desktopCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto pr-1">
          {!desktopCollapsed && (
            <p className="px-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/80">Workspace</p>
          )}

          <div className="space-y-1">{navItems.map((item) => renderNavLink(item, desktopCollapsed))}</div>

          {!desktopCollapsed && (
            <p className="px-2 pt-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/80">Preferences</p>
          )}

          {renderNavLink({ to: "/settings", label: t("nav.settings"), icon: Settings }, desktopCollapsed)}
        </nav>

        <div className="mt-4 rounded-xl border border-border/60 bg-background/40 p-2">
          <div className={cn("flex items-center", desktopCollapsed ? "justify-center" : "justify-between gap-2")}>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              {!desktopCollapsed && <LanguageSelector />}
            </div>
            {!desktopCollapsed && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-foreground"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4" />
                {t("nav.logout")}
              </Button>
            )}
            {desktopCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
          {!desktopCollapsed && user?.email && (
            <div className="mt-2 rounded-lg border border-border/60 bg-background/60 px-2 py-1.5 text-xs text-muted-foreground">
              {user.email}
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-card/80 p-3 backdrop-blur-sm lg:hidden">
          <Logo />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <LanguageSelector />
            <Button
              variant="ghost"
              size="icon"
              aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
              onClick={() => setMobileOpen((prev) => !prev)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </header>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Fechar menu"
              className="absolute inset-0 bg-background/70 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <nav className="absolute left-3 right-3 top-[4.25rem] rounded-xl border border-border bg-card p-3 shadow-xl">
              <div className="space-y-1">
                {navItems.map((item) => renderNavLink(item))}
                {renderNavLink({ to: "/settings", label: t("nav.settings"), icon: Settings })}
              </div>
              <Button
                variant="ghost"
                className="mt-3 w-full justify-start gap-3 text-muted-foreground"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4" />
                {t("nav.logout")}
              </Button>
            </nav>
          </div>
        )}

        <PastDueBanner />
        <main className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 pb-24 md:p-8 lg:pb-8">{children}</main>

        <nav className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-border/70 bg-card/90 p-2 backdrop-blur-xl shadow-xl lg:hidden">
          <div className="grid grid-cols-4 gap-1">
            {mobileQuickNav.map((item) => {
              const active = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium ${
                    active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
            <Link
              to="/settings"
              className={`flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium ${
                location.pathname.startsWith("/settings") ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Settings className="h-4 w-4" />
              <span className="truncate">{t("nav.settings")}</span>
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}
