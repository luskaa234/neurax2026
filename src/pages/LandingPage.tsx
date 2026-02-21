import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useEffect } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Layers,
  LayoutTemplate,
  MessageCircle,
  Rocket,
  Shield,
  Smartphone,
  Sparkles,
  Workflow,
  Wrench,
} from "lucide-react";

const WHATSAPP_PHONE = "5598933000286";
const WHATSAPP_MESSAGE = encodeURIComponent(
  "Olá! Quero um orçamento completo para sistema, aplicativo, automação, página de vendas e landing page.",
);
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_PHONE}?text=${WHATSAPP_MESSAGE}`;

const SERVICES = [
  {
    icon: Workflow,
    title: "Desenvolvimento de sistemas",
    description: "Sistemas sob medida para sua operação, com arquitetura sólida e foco em escala.",
  },
  {
    icon: Bot,
    title: "Automação de processos",
    description: "Automatizamos tarefas e fluxos para reduzir custo, erro operacional e retrabalho.",
  },
  {
    icon: LayoutTemplate,
    title: "Páginas de vendas",
    description: "Páginas de vendas com estrutura de conversão, copy estratégica e performance.",
  },
  {
    icon: Smartphone,
    title: "Aplicativos nativos",
    description: "Apps Android e iOS com experiência fluida, estabilidade e alta performance.",
  },
  {
    icon: Rocket,
    title: "Landing pages",
    description: "Landing pages prontas para captação de leads, validação de oferta e campanhas.",
  },
  {
    icon: Wrench,
    title: "Entrega ponta a ponta",
    description: "Da estratégia ao deploy, com desenvolvimento completo e evolução contínua.",
  },
];

const FLOW = [
  { title: "Definição do projeto", description: "Entendemos sua meta, público e prioridade para desenhar a solução certa." },
  { title: "Estrutura e design", description: "Montamos arquitetura técnica e interface alinhadas ao objetivo do negócio." },
  { title: "Construção e automação", description: "Desenvolvemos sistema, aplicativo e integrações com foco em resultado." },
  { title: "Publicação e crescimento", description: "Colocamos no ar e seguimos com melhorias orientadas por dados." },
];

const DELIVERABLES = [
  "Sistema web completo",
  "Aplicativo nativo",
  "Automação de processos",
  "Página de vendas",
  "Landing page de alta conversão",
  "Integrações e APIs",
  "Painel administrativo",
  "Deploy e suporte técnico",
];

export default function LandingPage() {
  useEffect(() => {
    const revealNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const staggerGroups = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal-stagger]"));

    for (const group of staggerGroups) {
      const nodes = Array.from(group.querySelectorAll<HTMLElement>("[data-reveal]"));
      for (const [index, node] of nodes.entries()) {
        if (!node.style.getPropertyValue("--reveal-delay")) {
          const delay = Math.min(index * 80, 560);
          node.style.setProperty("--reveal-delay", `${delay}ms`);
        }
      }
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || !("IntersectionObserver" in window)) {
      for (const node of revealNodes) node.classList.add("reveal-visible");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("reveal-visible");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -12% 0px" },
    );

    for (const node of revealNodes) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/60 backdrop-blur-sm transition-colors">
        <div className="container flex min-h-16 flex-wrap items-center justify-between gap-2 py-2 sm:h-16 sm:flex-nowrap sm:py-0" data-reveal-stagger>
          <div data-reveal>
            <Logo to="/" />
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground" data-reveal>
            <a href="#servicos" className="hover:text-foreground">Serviços</a>
            <a href="#fluxo" className="hover:text-foreground">Fluxo</a>
            <a href="#entregas" className="hover:text-foreground">Entregas</a>
            <a href="#contato" className="hover:text-foreground">Contato</a>
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3" data-reveal>
            <div className="flex items-center gap-1 rounded-md border border-border/60 bg-card/50 px-1 py-1" data-reveal>
              <ThemeToggle />
              <LanguageSelector />
            </div>
            <Button className="rounded-full" asChild>
              <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden" data-reveal>
        <div className="absolute inset-0 bg-aurora bg-grid opacity-70" />
        <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-orbit opacity-60 float-slow" />
        <div className="pointer-events-none absolute -right-10 bottom-10 h-80 w-80 rounded-full bg-orbit opacity-50 float-slow" />
        <div className="bubble-field pointer-events-none absolute inset-0">
          <span className="bubble bubble-a" />
          <span className="bubble bubble-b" />
          <span className="bubble bubble-c" />
          <span className="bubble bubble-d" />
          <span className="bubble bubble-e" />
        </div>

        <div className="container relative py-16 md:py-28">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center" data-reveal-stagger>
            <div data-reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-primary" data-reveal>
                <Sparkles className="h-3.5 w-3.5" />
                Soluções digitais completas
              </div>
              <h1 className="mt-6 text-3xl sm:text-4xl md:text-6xl font-bold font-display leading-tight" data-reveal>
                Desenvolvemos seu sistema e aplicativo
              </h1>
              <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl" data-reveal>
                Automação, páginas de vendas, aplicativos nativos e landing page: esses são nossos serviços para transformar
                sua operação em resultado real.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3" data-reveal>
                <Button size="lg" className="glow pulse-ring w-full sm:w-auto font-display tracking-wide" asChild>
                  <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer">
                    Falar no WhatsApp <MessageCircle className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
                  <a href="#servicos">Ver serviços</a>
                </Button>
              </div>
              <div className="mt-10 grid max-w-md grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground sm:gap-6 sm:text-sm" data-reveal>
                <div className="rounded-xl border border-border/60 bg-background/30 px-2 py-3">
                  <p className="text-xl font-semibold text-foreground sm:text-2xl">100%</p>
                  <p>Personalizado</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/30 px-2 py-3">
                  <p className="text-xl font-semibold text-foreground sm:text-2xl">Ponta</p>
                  <p>a ponta</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/30 px-2 py-3">
                  <p className="text-xl font-semibold text-foreground sm:text-2xl">Rápido</p>
                  <p>e escalável</p>
                </div>
              </div>
            </div>

            <div className="glass-strong rounded-2xl p-6 md:p-8 border border-primary/20 shadow-2xl soft-shadow lift" data-reveal>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-[0.3em]">Projeto completo</p>
                  <h3 className="text-lg font-semibold font-display mt-1">Sistema + App + Conversão</h3>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary shimmer">Ativo</span>
              </div>
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                  <p className="text-xs text-muted-foreground">Seu objetivo</p>
                  <p className="mt-2 text-sm">
                    “Preciso vender mais, automatizar processos e ter um produto digital robusto.”
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                  <p className="text-xs text-muted-foreground">Nossa entrega</p>
                  <p className="mt-2 text-sm">
                    Sistema completo, aplicativo nativo, páginas de vendas e landing page com execução completa.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div className="rounded-lg bg-background/40 p-3 text-center">
                    <Layers className="mx-auto h-4 w-4 text-primary mb-2" />
                    Estrutura
                  </div>
                  <div className="rounded-lg bg-background/40 p-3 text-center">
                    <Rocket className="mx-auto h-4 w-4 text-primary mb-2" />
                    Deploy
                  </div>
                  <div className="rounded-lg bg-background/40 p-3 text-center">
                    <Shield className="mx-auto h-4 w-4 text-primary mb-2" />
                    Qualidade
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="servicos" className="container py-16 md:py-20" data-reveal>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6" data-reveal-stagger>
          <div data-reveal>
            <p className="text-sm text-primary uppercase tracking-[0.3em]" data-reveal>Serviços</p>
            <h2 className="text-3xl md:text-4xl font-bold font-display mt-3" data-reveal>
              Esses são nossos serviços
            </h2>
          </div>
          <p className="text-muted-foreground max-w-md" data-reveal>
            Desenvolvemos seu sistema e aplicativo com estratégia, execução e suporte técnico.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-reveal-stagger>
          {SERVICES.map((service) => (
            <div key={service.title} className="glass-strong rounded-2xl p-6 lift reveal-on-scroll" data-reveal>
              <service.icon className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">{service.title}</h3>
              <p className="text-sm text-muted-foreground">{service.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="fluxo" className="container py-16 md:py-20" data-reveal>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] items-center" data-reveal-stagger>
          <div data-reveal>
            <p className="text-sm text-primary uppercase tracking-[0.3em]" data-reveal>Fluxo</p>
            <h2 className="text-3xl md:text-4xl font-bold font-display mt-3" data-reveal>
              Processo claro, entrega completa
            </h2>
            <p className="mt-4 text-muted-foreground" data-reveal>
              Da ideia à publicação, conduzimos todas as etapas com foco em velocidade e resultado.
            </p>
            <div className="mt-6 space-y-3 text-sm text-muted-foreground" data-reveal-stagger>
              {FLOW.map((step, idx) => (
                <div key={step.title} className="flex gap-3" data-reveal>
                  <div className="mt-1 h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-foreground font-medium">{step.title}</p>
                    <p>{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4" data-reveal-stagger>
            <div className="glass-strong rounded-2xl p-6 lift" data-reveal>
              <p className="text-xs text-muted-foreground uppercase tracking-[0.3em]">Resultado</p>
              <h3 className="mt-3 text-xl font-semibold font-display">Operação mais rápida e previsível</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                Com tecnologia certa, sua empresa ganha eficiência, conversão e controle da operação.
              </p>
            </div>
            <div className="glass-strong rounded-2xl p-6 lift" data-reveal>
              <p className="text-xs text-muted-foreground uppercase tracking-[0.3em]">Canal direto</p>
              <h3 className="mt-3 text-xl font-semibold font-display">Atendimento via WhatsApp</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                Fale agora no número (98) 93300-0286 e receba uma proposta completa para o seu projeto.
              </p>
              <Button className="mt-4" asChild>
                <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer">Chamar no WhatsApp</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="entregas" className="container py-16 md:py-20" data-reveal>
        <div className="glass-strong rounded-3xl p-8 md:p-12 soft-shadow">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6" data-reveal-stagger>
            <div data-reveal>
              <p className="text-sm text-primary uppercase tracking-[0.3em]" data-reveal>Entregas</p>
              <h2 className="text-3xl md:text-4xl font-bold font-display mt-3" data-reveal>
                O que você recebe no projeto
              </h2>
              <p className="mt-3 text-muted-foreground max-w-lg" data-reveal>
                Pacote completo para estruturar seu produto e acelerar sua operação comercial.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground" data-reveal>
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Execução completa
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-reveal-stagger>
            {DELIVERABLES.map((item) => (
              <div key={item} className="rounded-full border border-border/60 bg-background/40 px-4 py-2 text-sm" data-reveal>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contato" className="container pb-16 md:pb-24" data-reveal>
        <div className="glass-strong rounded-3xl p-10 md:p-14 flex flex-col md:flex-row md:items-center md:justify-between gap-8 soft-shadow" data-reveal-stagger>
          <div data-reveal>
            <h2 className="text-3xl md:text-4xl font-bold font-display" data-reveal>
              Pronto para desenvolver seu sistema e aplicativo?
            </h2>
            <p className="mt-3 text-muted-foreground" data-reveal>
              Automação, páginas de vendas, aplicativos nativos e landing page em um projeto completo.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto" data-reveal>
            <Button size="lg" className="glow w-full sm:w-auto" asChild>
              <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer">
                WhatsApp <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
              <a href="tel:+5598933000286">Ligar: (98) 93300-0286</a>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/50 py-8" data-reveal>
        <div className="container flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-sm text-muted-foreground" data-reveal-stagger>
          <div data-reveal>
            <Logo to="/" size="sm" labelClassName="text-base" />
          </div>
          <p data-reveal>© 2026 Neurax. Desenvolvemos seu sistema e aplicativo com automação e foco em resultado.</p>
        </div>
      </footer>

      <a
        href={WHATSAPP_LINK}
        target="_blank"
        rel="noreferrer"
        aria-label="Conversar no WhatsApp"
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-green-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105"
      >
        <MessageCircle className="h-5 w-5" />
        WhatsApp
      </a>
    </div>
  );
}
