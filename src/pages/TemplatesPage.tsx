import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { FileText, Monitor } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";

const categoryColors: Record<string, string> = {
  content: "bg-primary/10 text-primary",
  social: "bg-success/10 text-success",
  email: "bg-warning/10 text-warning",
  ecommerce: "bg-destructive/10 text-destructive",
  marketing: "bg-accent/10 text-accent-foreground",
  seo: "bg-secondary text-secondary-foreground",
  system_builder: "bg-chart-4/20 text-chart-4",
  general: "bg-muted text-muted-foreground",
};

const categoryLabels: Record<string, string> = {
  content: "Conteúdo",
  social: "Social",
  email: "Email",
  ecommerce: "E-commerce",
  marketing: "Marketing",
  seo: "SEO",
  system_builder: "System Builder",
  general: "Geral",
};

const ALL_CATEGORIES = ["all", "content", "social", "email", "ecommerce", "marketing", "seo", "system_builder"] as const;

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Tables<"templates">[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  useEffect(() => {
    supabase.from("templates").select("*").order("category").then(({ data }) => {
      if (data) setTemplates(data);
      setLoading(false);
    });
  }, []);

  const filtered = activeCategory === "all"
    ? templates
    : templates.filter((t) => t.category === activeCategory);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground">Explore templates de geração de conteúdo e prompts de sistema</p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {ALL_CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(cat)}
              className="text-xs"
            >
              {cat === "all" ? "Todos" : categoryLabels[cat] || cat}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((template) => (
              <div key={template.id} className="glass-card rounded-lg p-5 hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  {template.category === "system_builder" ? (
                    <Monitor className="h-8 w-8 text-chart-4" />
                  ) : (
                    <FileText className="h-8 w-8 text-primary" />
                  )}
                  <div className="flex items-center gap-2">
                    {template.category === "system_builder" && (
                      <Badge variant="outline" className="border-chart-4/50 text-chart-4 text-[10px]">
                        System
                      </Badge>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full ${categoryColors[template.category] || categoryColors.general}`}>
                      {categoryLabels[template.category] || template.category}
                    </span>
                  </div>
                </div>
                <h3 className="font-semibold mb-1">{template.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{template.description}</p>
                {template.is_system && (
                  <span className="mt-3 inline-block text-xs text-primary">⚡ Template do sistema</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
