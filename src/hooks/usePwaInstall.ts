import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt: () => Promise<void>;
}

type InstallLocale = "pt-BR" | "en" | "es";

interface InstallGuide {
  browser: string;
  steps: string[];
  summary: string;
}

function getInstallGuide(locale: InstallLocale): InstallGuide {
  const copy: Record<InstallLocale, Record<string, string[] | string>> = {
    "pt-BR": {
      samsungBrowser: "Samsung Internet (Android)",
      samsungSummary: "Instale como app para abrir em tela cheia e acesso rápido.",
      samsungStep1: "Toque no menu (≡).",
      samsungStep2: "Selecione Adicionar página à / Instalar aplicativo.",
      samsungStep3: "Confirme para criar o atalho do app.",
      iosBrowser: "Safari (iPhone/iPad)",
      iosSummary: "No iOS, a instalação é feita pelo menu de compartilhamento.",
      iosStep1: "Toque em Compartilhar.",
      iosStep2: "Escolha Adicionar à Tela de Início.",
      iosStep3: "Confirme em Adicionar.",
      safariMacBrowser: "Safari (macOS)",
      safariMacSummary: "Use Add to Dock para instalar com experiência de app no Mac.",
      safariMacStep1: "Abra o menu File no topo do Safari.",
      safariMacStep2: "Clique em Add to Dock.",
      safariMacStep3: "Confirme o nome e clique em Add.",
      edgeChromeBrowser: "Desktop Browser",
      edgeChromeSummary: "Instalação nativa disponível diretamente no navegador.",
      edgeChromeStep1: "Clique no menu do navegador (⋯).",
      edgeChromeStep2: "Selecione Install app / Instalar aplicativo.",
      edgeChromeStep3: "Confirme em Instalar.",
      windowsBrowser: "Windows Desktop",
      windowsSummary: "Use Edge ou Chrome para instalar com suporte completo.",
      windowsStep1: "Abra no Edge ou Chrome.",
      windowsStep2: "Clique no menu do navegador.",
      windowsStep3: "Use a opção Instalar aplicativo.",
      fallbackBrowser: "Desktop",
      fallbackSummary: "Para melhor compatibilidade, instale via Chrome, Edge ou Safari.",
      fallbackStep1: "Abra no Chrome, Edge ou Safari.",
      fallbackStep2: "Use o menu do navegador.",
      fallbackStep3: "Clique em Instalar aplicativo / Add to Dock.",
    },
    en: {
      samsungBrowser: "Samsung Internet (Android)",
      samsungSummary: "Install as an app for full-screen mode and quick access.",
      samsungStep1: "Tap the menu (≡).",
      samsungStep2: "Select Add page to / Install app.",
      samsungStep3: "Confirm to create the app shortcut.",
      iosBrowser: "Safari (iPhone/iPad)",
      iosSummary: "On iOS, installation is done from the share menu.",
      iosStep1: "Tap Share.",
      iosStep2: "Choose Add to Home Screen.",
      iosStep3: "Tap Add to confirm.",
      safariMacBrowser: "Safari (macOS)",
      safariMacSummary: "Use Add to Dock for an app-like experience on Mac.",
      safariMacStep1: "Open the File menu in Safari.",
      safariMacStep2: "Click Add to Dock.",
      safariMacStep3: "Confirm the name and click Add.",
      edgeChromeBrowser: "Desktop Browser",
      edgeChromeSummary: "Native install is available directly in your browser.",
      edgeChromeStep1: "Open the browser menu (⋯).",
      edgeChromeStep2: "Select Install app.",
      edgeChromeStep3: "Confirm by clicking Install.",
      windowsBrowser: "Windows Desktop",
      windowsSummary: "Use Edge or Chrome for full install support.",
      windowsStep1: "Open in Edge or Chrome.",
      windowsStep2: "Open the browser menu.",
      windowsStep3: "Choose Install app.",
      fallbackBrowser: "Desktop",
      fallbackSummary: "For best compatibility, install with Chrome, Edge, or Safari.",
      fallbackStep1: "Open in Chrome, Edge, or Safari.",
      fallbackStep2: "Use the browser menu.",
      fallbackStep3: "Choose Install app / Add to Dock.",
    },
    es: {
      samsungBrowser: "Samsung Internet (Android)",
      samsungSummary: "Instala como app para pantalla completa y acceso rápido.",
      samsungStep1: "Toca el menú (≡).",
      samsungStep2: "Selecciona Añadir página a / Instalar aplicación.",
      samsungStep3: "Confirma para crear el acceso directo.",
      iosBrowser: "Safari (iPhone/iPad)",
      iosSummary: "En iOS, la instalación se hace desde el menú de compartir.",
      iosStep1: "Toca Compartir.",
      iosStep2: "Elige Añadir a pantalla de inicio.",
      iosStep3: "Confirma en Añadir.",
      safariMacBrowser: "Safari (macOS)",
      safariMacSummary: "Usa Add to Dock para instalar con experiencia tipo app en Mac.",
      safariMacStep1: "Abre el menú File de Safari.",
      safariMacStep2: "Haz clic en Add to Dock.",
      safariMacStep3: "Confirma el nombre y pulsa Add.",
      edgeChromeBrowser: "Navegador de escritorio",
      edgeChromeSummary: "La instalación nativa está disponible en el navegador.",
      edgeChromeStep1: "Abre el menú del navegador (⋯).",
      edgeChromeStep2: "Selecciona Instalar aplicación.",
      edgeChromeStep3: "Confirma en Instalar.",
      windowsBrowser: "Windows Desktop",
      windowsSummary: "Usa Edge o Chrome para soporte completo de instalación.",
      windowsStep1: "Abre en Edge o Chrome.",
      windowsStep2: "Abre el menú del navegador.",
      windowsStep3: "Selecciona Instalar aplicación.",
      fallbackBrowser: "Escritorio",
      fallbackSummary: "Para mejor compatibilidad, instala con Chrome, Edge o Safari.",
      fallbackStep1: "Abre en Chrome, Edge o Safari.",
      fallbackStep2: "Usa el menú del navegador.",
      fallbackStep3: "Selecciona Instalar aplicación / Add to Dock.",
    },
  };

  const t = copy[locale];
  const ua = navigator.userAgent;
  const isAndroid = /Android/.test(ua);
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isMac = /Macintosh|Mac OS X/.test(ua);
  const isWindows = /Windows/.test(ua);
  const isEdge = /Edg\//.test(ua);
  const isChrome = /Chrome\//.test(ua) && !isEdge;
  const isSafari = /Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua);
  const isSamsung = /SamsungBrowser\//.test(ua);

  if (isSamsung && isAndroid) {
    return {
      browser: t.samsungBrowser as string,
      summary: t.samsungSummary as string,
      steps: [t.samsungStep1 as string, t.samsungStep2 as string, t.samsungStep3 as string],
    };
  }

  if (isIOS) {
    return {
      browser: t.iosBrowser as string,
      summary: t.iosSummary as string,
      steps: [t.iosStep1 as string, t.iosStep2 as string, t.iosStep3 as string],
    };
  }

  if (isSafari && isMac) {
    return {
      browser: t.safariMacBrowser as string,
      summary: t.safariMacSummary as string,
      steps: [t.safariMacStep1 as string, t.safariMacStep2 as string, t.safariMacStep3 as string],
    };
  }
  if (isEdge || isChrome) {
    return {
      browser: isEdge ? "Microsoft Edge" : "Google Chrome",
      summary: t.edgeChromeSummary as string,
      steps: [t.edgeChromeStep1 as string, t.edgeChromeStep2 as string, t.edgeChromeStep3 as string],
    };
  }
  if (isWindows) {
    return {
      browser: t.windowsBrowser as string,
      summary: t.windowsSummary as string,
      steps: [t.windowsStep1 as string, t.windowsStep2 as string, t.windowsStep3 as string],
    };
  }
  return {
    browser: t.fallbackBrowser as string,
    summary: t.fallbackSummary as string,
    steps: [t.fallbackStep1 as string, t.fallbackStep2 as string, t.fallbackStep3 as string],
  };
}

export function usePwaInstall(locale: InstallLocale = "pt-BR") {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const media = window.matchMedia("(display-mode: standalone)");
    if (media.matches) {
      setIsInstalled(true);
    }

    const handleInstalled = () => {
      setInstallEvent(null);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = async (): Promise<"accepted" | "dismissed" | "not_available"> => {
    if (!installEvent) return "not_available";
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstallEvent(null);
      return "accepted";
    }
    return "dismissed";
  };

  return {
    canInstall: !!installEvent && !isInstalled,
    isInstalled,
    installGuide: getInstallGuide(locale),
    install,
  };
}
