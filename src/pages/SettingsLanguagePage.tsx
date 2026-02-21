import { AppLayout } from "@/components/AppLayout";
import { useI18n } from "@/hooks/useI18n";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export default function SettingsLanguagePage() {
  const { locale, setLocale, localeNames, availableLocales, t } = useI18n();

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in max-w-lg">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            {t("settings.languageTitle")}
          </h1>
          <p className="text-muted-foreground">{t("settings.languageSubtitle")}</p>
        </div>

        <div className="glass-card rounded-lg p-6 space-y-3">
          {availableLocales.map((l) => (
            <Button
              key={l}
              variant={locale === l ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => setLocale(l)}
            >
              {localeNames[l]}
            </Button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
