import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import ptBR from "@/locales/pt-BR.json";
import en from "@/locales/en.json";
import es from "@/locales/es.json";

type Locale = "pt-BR" | "en" | "es";
type TranslationNode = string | Record<string, TranslationNode>;

const translations: Record<Locale, typeof ptBR> = { "pt-BR": ptBR, en, es };

const localeNames: Record<Locale, string> = {
  "pt-BR": "Português (BR)",
  en: "English",
  es: "Español",
};

interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
  localeNames: Record<Locale, string>;
  availableLocales: Locale[];
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

function getNestedValue(obj: Record<string, TranslationNode>, path: string): string {
  const value = path.split(".").reduce<TranslationNode | undefined>((acc, part) => {
    if (!acc || typeof acc === "string") return undefined;
    return acc[part];
  }, obj);

  return typeof value === "string" ? value : path;
}

function detectLocale(): Locale {
  const stored = localStorage.getItem("locale") as Locale | null;
  if (stored && translations[stored]) return stored;
  const browserLang = navigator.language;
  if (browserLang.startsWith("pt")) return "pt-BR";
  if (browserLang.startsWith("es")) return "es";
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    localStorage.setItem("locale", nextLocale);
  }, []);

  const t = useCallback(
    (key: string): string => {
      const value = getNestedValue(translations[locale] as Record<string, TranslationNode>, key);
      if (value !== key) return value;
      return getNestedValue(translations["pt-BR"] as Record<string, TranslationNode>, key);
    },
    [locale],
  );

  return (
    <I18nContext.Provider
      value={{ locale, setLocale, t, localeNames, availableLocales: ["pt-BR", "en", "es"] }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
