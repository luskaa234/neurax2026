import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { History, Copy, ChevronDown, ChevronUp, Trash2, Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Generation = Tables<"generations"> & {
  projects?: { name: string } | null;
  templates?: { name: string; category: string } | null;
};

export default function HistoryPage() {
  const { user } = useAuth();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("generations")
      .select("*, projects(name), templates(name, category)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setGenerations(data as Generation[]);
        setLoading(false);
      });
  }, [user]);

  const deleteGeneration = async (generationId: string) => {
    const confirmed = window.confirm("Excluir este item do histórico?");
    if (!confirmed) return;
    setBusyId(generationId);
    const { error } = await supabase.from("generations").delete().eq("id", generationId);
    if (error) {
      toast.error("Falha ao excluir item do histórico.");
      setBusyId(null);
      return;
    }
    setGenerations((prev) => prev.filter((item) => item.id !== generationId));
    if (expanded === generationId) setExpanded(null);
    if (editingId === generationId) setEditingId(null);
    setBusyId(null);
    toast.success("Item removido do histórico.");
  };

  const clearHistory = async () => {
    if (!user) return;
    const confirmed = window.confirm("Excluir todo o histórico de gerações?");
    if (!confirmed) return;
    setBusyId("all");
    const { error } = await supabase.from("generations").delete().eq("user_id", user.id);
    if (error) {
      toast.error("Falha ao excluir histórico.");
      setBusyId(null);
      return;
    }
    setGenerations([]);
    setExpanded(null);
    setEditingId(null);
    setBusyId(null);
    toast.success("Histórico apagado com sucesso.");
  };

  const startEdit = (generation: Generation) => {
    setEditingId(generation.id);
    setEditText(generation.result || "");
    setExpanded(generation.id);
  };

  const saveEdit = async (generationId: string) => {
    setBusyId(generationId);
    const { error } = await supabase
      .from("generations")
      .update({ result: editText })
      .eq("id", generationId);
    if (error) {
      toast.error("Falha ao atualizar histórico.");
      setBusyId(null);
      return;
    }
    setGenerations((prev) =>
      prev.map((item) => (item.id === generationId ? { ...item, result: editText } : item)),
    );
    setEditingId(null);
    setBusyId(null);
    toast.success("Histórico atualizado.");
  };

  const statusColors: Record<string, string> = {
    completed: "bg-success/10 text-success",
    generating: "bg-warning/10 text-warning",
    failed: "bg-destructive/10 text-destructive",
    pending: "bg-muted text-muted-foreground",
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Histórico</h1>
          <p className="text-muted-foreground">Todas as suas gerações de conteúdo</p>
        </div>
        {generations.length > 0 && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={clearHistory} disabled={busyId === "all"}>
              <Trash2 className="mr-2 h-4 w-4" /> Excluir histórico completo
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : generations.length === 0 ? (
          <div className="glass-card rounded-lg p-12 text-center">
            <History className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sem histórico</h3>
            <p className="text-muted-foreground">Suas gerações aparecerão aqui.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {generations.map((gen) => {
              const isSystem = gen.templates?.category === "system_builder";
              return (
                <div key={gen.id} className="glass-card rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpanded(expanded === gen.id ? null : gen.id)}
                    className="w-full p-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${statusColors[gen.status]}`}>
                        {gen.status}
                      </span>
                      {isSystem && (
                        <Badge variant="outline" className="border-chart-4/50 text-chart-4 text-[10px] shrink-0">
                          System
                        </Badge>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {gen.templates?.name || "Template removido"}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {gen.projects?.name || "Projeto removido"} · {new Date(gen.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    {expanded === gen.id ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                  </button>
                  {expanded === gen.id && (
                    <div className="border-t border-border p-4 space-y-3">
                      {editingId === gen.id ? (
                        <>
                          <Textarea
                            value={editText}
                            onChange={(event) => setEditText(event.target.value)}
                            className="min-h-40"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveEdit(gen.id)} disabled={busyId === gen.id}>
                              <Save className="mr-2 h-3 w-3" /> Salvar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={busyId === gen.id}>
                              <X className="mr-2 h-3 w-3" /> Cancelar
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="rounded-md bg-muted p-4 whitespace-pre-wrap text-sm max-h-96 overflow-y-auto">
                            {gen.result || "Sem conteúdo salvo nesta geração."}
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {gen.result && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(gen.result!);
                                  toast.success("Copiado!");
                                }}
                              >
                                <Copy className="mr-2 h-3 w-3" /> Copiar
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => startEdit(gen)}>
                              <Pencil className="mr-2 h-3 w-3" /> Editar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => deleteGeneration(gen.id)} disabled={busyId === gen.id}>
                              <Trash2 className="mr-2 h-3 w-3" /> Excluir
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
