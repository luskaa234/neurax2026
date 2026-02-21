import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, FolderOpen, Trash2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export default function ProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<Tables<"projects">[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contextText, setContextText] = useState("");
  const [creating, setCreating] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data) setProjects(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setOpen(true);
    }
  }, [searchParams]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreating(true);

    const context = contextText
      ? { description: contextText }
      : {};

    const { data, error } = await supabase
      .from("projects")
      .insert({ name, description, context, user_id: user.id })
      .select()
      .single();

    if (error) {
      toast.error("Erro ao criar projeto");
    } else {
      toast.success("Projeto criado!");
      setOpen(false);
      setName("");
      setDescription("");
      setContextText("");
      navigate(`/projects/${data.id}`);
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error: buildsError } = await supabase
        .from("builds")
        .delete()
        .eq("project_id", id);
      if (buildsError) throw buildsError;

      const { error: projectError } = await supabase
        .from("projects")
        .delete()
        .eq("id", id);
      if (projectError) throw projectError;

      toast.success("Projeto excluído");
      loadProjects();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao excluir projeto";
      toast.error(message);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Projetos</h1>
            <p className="text-muted-foreground">Gerencie seus projetos de conteúdo</p>
          </div>
          <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
              setOpen(nextOpen);
              if (!nextOpen && searchParams.get("new") === "1") {
                searchParams.delete("new");
                setSearchParams(searchParams, { replace: true });
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Novo Projeto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Projeto</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do projeto" required />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descrição" />
                </div>
                <div className="space-y-2">
                  <Label>Contexto do Projeto</Label>
                  <Textarea
                    value={contextText}
                    onChange={(e) => setContextText(e.target.value)}
                    placeholder="Descreva o contexto, tom de voz, público-alvo, nicho..."
                    rows={4}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? "Criando..." : "Criar Projeto"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : projects.length === 0 ? (
          <div className="glass-card rounded-lg p-12 text-center">
            <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum projeto</h3>
            <p className="text-muted-foreground mb-4">Crie seu primeiro projeto para começar a gerar conteúdo.</p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Criar Projeto
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div key={project.id} className="glass-card rounded-lg p-5 hover:border-primary/30 transition-colors group">
                <Link to={`/projects/${project.id}`} className="block">
                  <h3 className="font-semibold mb-1">{project.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{project.description || "Sem descrição"}</p>
                  <p className="text-xs text-muted-foreground mt-3">
                    Atualizado em {new Date(project.updated_at).toLocaleDateString("pt-BR")}
                  </p>
                </Link>
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                    onClick={() => handleDelete(project.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
