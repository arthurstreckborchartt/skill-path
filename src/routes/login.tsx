import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AuthLayout, AuthError, AuthField, AuthSocial } from "@/components/pathly/auth";
import { Btn } from "@/components/pathly/ui";
import { authErrorMessage, signInWithGoogle } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Entrar na Pathly" },
      { name: "description", content: "Acesse sua rota personalizada de habilidades na Pathly." },
      { property: "og:title", content: "Entrar na Pathly" },
      { property: "og:description", content: "Continue de onde parou na sua rota." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Quando a pessoa volta pelo link do e-mail de recuperação, o Supabase abre uma sessão de
  // recuperação e emite este evento: aí a tela vira "defina a nova senha" em vez de login.
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function handleReset() {
    if (!email.trim()) {
      setError("Digite seu e-mail primeiro para receber o link.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setBusy(false);
    if (resetError) {
      setError(authErrorMessage(resetError.message));
      return;
    }
    setNotice("Enviamos um link de recuperação para o seu e-mail.");
  }

  async function handleNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(authErrorMessage(updateError.message));
      setBusy(false);
      return;
    }
    navigate({ to: "/app" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(authErrorMessage(signInError.message));
      setBusy(false);
      return;
    }
    navigate({ to: "/app" });
  }

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    const { error: oauthError } = await signInWithGoogle("/app");
    if (oauthError) {
      setError(authErrorMessage(oauthError.message));
      setBusy(false);
    }
  }

  if (recovering) {
    return (
      <AuthLayout title="Defina uma nova senha" subtitle="Escolha a senha que você vai usar agora.">
        <form className="space-y-4" onSubmit={handleNewPassword}>
          {error && <AuthError message={error} />}
          <AuthField
            label="Nova senha"
            type="password"
            placeholder="mínimo 8 caracteres"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            required
            disabled={busy}
          />
          <Btn type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Salvando…" : "Salvar e entrar"} <ArrowRight className="size-4" />
          </Btn>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Bem-vindo de volta"
      subtitle="Sua rota continua exatamente de onde você parou."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <AuthError message={error} />}
        {notice && (
          <p className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground">
            {notice}
          </p>
        )}
        <AuthField
          label="E-mail"
          type="email"
          placeholder="voce@email.com"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
          disabled={busy}
        />
        <AuthField
          label="Senha"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
          disabled={busy}
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleReset}
            disabled={busy}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            Esqueci minha senha
          </button>
        </div>
        <Btn type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"} <ArrowRight className="size-4" />
        </Btn>
      </form>

      <AuthSocial onGoogle={handleGoogle} disabled={busy} />

      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link to="/cadastro" className="font-medium text-primary hover:underline">
          Criar minha rota
        </Link>
      </p>
    </AuthLayout>
  );
}
