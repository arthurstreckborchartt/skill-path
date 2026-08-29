import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AuthLayout, AuthField, AuthSocial } from "@/components/pathly/auth";
import { Btn } from "@/components/pathly/ui";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta na Pathly" },
      {
        name: "description",
        content: "Crie sua conta e monte a rota entre a sua renda atual e a renda que você quer.",
      },
      { property: "og:title", content: "Criar conta na Pathly" },
      {
        property: "og:description",
        content: "Dez perguntas e sua rota personalizada de habilidades está pronta.",
      },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  return (
    <AuthLayout
      title="Criar minha rota"
      subtitle="Leva dois minutos. Depois você responde 10 perguntas e a rota aparece."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <AuthField label="Nome" placeholder="Seu nome" />
        <AuthField label="E-mail" type="email" placeholder="voce@email.com" />
        <AuthField label="Senha" type="password" placeholder="mínimo 8 caracteres" />
        <Link to="/onboarding" className="block pt-1">
          <Btn size="lg" className="w-full">
            Continuar <ArrowRight className="size-4" />
          </Btn>
        </Link>
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          Ao continuar você concorda com os termos de uso e a política de privacidade.
        </p>
      </form>

      <AuthSocial />

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
