import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";

function getFriendlyAuthError(message: string, isLogin: boolean): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("email rate limit exceeded")) {
    return "Você atingiu o limite de tentativas de e-mail. Aguarde alguns minutos e tente novamente.";
  }
  if (normalized.includes("invalid login credentials")) {
    return "E-mail ou senha inválidos. Confira os dados e tente novamente.";
  }
  if (normalized.includes("user already registered")) {
    return "Este e-mail já está cadastrado. Tente entrar na conta.";
  }
  if (normalized.includes("password should be at least")) {
    return "Sua senha está muito curta. Use pelo menos 6 caracteres.";
  }
  if (normalized.includes("signup is disabled")) {
    return "Cadastro temporariamente indisponível. Tente novamente mais tarde.";
  }

  return isLogin
    ? "Não foi possível entrar agora. Tente novamente em instantes."
    : "Não foi possível criar sua conta agora. Tente novamente em instantes.";
}

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(getFriendlyAuthError(error.message, true));
      } else {
        navigate("/dashboard");
      }
    } else {
      const { error } = await signUp(email, password, fullName);
      if (error) {
        toast.error(getFriendlyAuthError(error.message, false));
      } else {
        toast.success("Conta criada, acesse agora.");
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="fixed right-4 top-4 z-10 flex items-center gap-1 rounded-md border border-border/60 bg-card/70 px-1 py-1 backdrop-blur-sm">
        <ThemeToggle />
        <LanguageSelector />
      </div>
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Logo to="/" size="lg" className="mb-6" labelClassName="text-2xl" />
          <h1 className="text-2xl font-bold tracking-tight">
            {isLogin ? "Entrar na conta" : "Criar conta"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isLogin ? "Acesse sua plataforma Neurax AI" : "Comece a gerar conteúdo profissional com a Neurax AI"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card rounded-lg p-6 space-y-4">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome"
                required={!isLogin}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Carregando..." : isLogin ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary hover:underline font-medium"
          >
            {isLogin ? "Criar conta" : "Entrar"}
          </button>
        </p>
      </div>
    </div>
  );
}
