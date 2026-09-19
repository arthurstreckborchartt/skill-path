import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AuthLayout, AuthError, AuthField, AuthSocial } from "@/components/pathly/auth";
import { Btn } from "@/components/pathly/ui";
import { authErrorMessage, signInWithGoogle } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/cadastro")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Criar conta na Pathly" },
      {
        name: "description",
        content: "Crie sua conta e transforme uma ideia em um SaaS planejado e executável.",
      },
      { property: "og:title", content: "Criar conta na Pathly" },
      {
        property: "og:description",
        content: "Descreva o produto e deixe o Pathly organizar o plano técnico.",
      },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/app`,
      },
    });
    if (signUpError) {
      setError(authErrorMessage(signUpError.message));
      setBusy(false);
      return;
    }
    // Com confirmação de e-mail ligada no Supabase o signUp não devolve sessão: a pessoa
    // precisa confirmar antes de entrar, então avisamos antes de abrir o espaço de criação.
    if (!data.session) {
      setNotice("Confirme seu e-mail pelo link que enviamos para começar.");
      setBusy(false);
      return;
    }
    navigate({ to: "/app" });
  }

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    const result = await signInWithGoogle("/app");
    // "redirecting" significa que o navegador já está saindo desta página: mexer no estado ou
    // navegar aqui só competiria com a saída.
    if (result.status === "redirecting") return;
    if (result.status === "error") {
      setError(result.message);
      setBusy(false);
      return;
    }
    navigate({ to: "/app" });
  }

  return (
    <AuthLayout
      title="Criar meu workspace"
      subtitle="Descreva seu SaaS e comece com um plano técnico organizado."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <AuthError message={error} />}
        {notice && (
          <p className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground">
            {notice}
          </p>
        )}
        <AuthField
          label="Nome"
          value={name}
          onChange={setName}
          autoComplete="name"
          required
          disabled={busy}
        />
        <AuthField
          label="E-mail"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
          disabled={busy}
        />
        <AuthField
          label="Senha"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          required
          disabled={busy}
        />
        <Btn type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Criando…" : "Continuar"} <ArrowRight className="size-4" />
        </Btn>
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          Ao continuar você concorda com os{" "}
          <Link to="/termos" className="text-primary underline underline-offset-2">
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link to="/privacidade" className="text-primary underline underline-offset-2">
            Política de Privacidade
          </Link>
          .
        </p>
      </form>

      <AuthSocial onGoogle={handleGoogle} disabled={busy} />

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
