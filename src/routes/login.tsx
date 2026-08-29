import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AuthLayout, AuthField, AuthSocial } from "@/components/pathly/auth";
import { Btn } from "@/components/pathly/ui";

export const Route = createFileRoute("/login")({
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
  return (
    <AuthLayout
      title="Bem-vindo de volta"
      subtitle="Sua rota continua exatamente de onde você parou."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <AuthField label="E-mail" type="email" placeholder="voce@email.com" />
        <AuthField label="Senha" type="password" placeholder="••••••••" />
        <div className="flex justify-end">
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground">
            Esqueci minha senha
          </button>
        </div>
        <Link to="/app" className="block">
          <Btn size="lg" className="w-full">
            Entrar <ArrowRight className="size-4" />
          </Btn>
        </Link>
      </form>

      <AuthSocial />

      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link to="/cadastro" className="font-medium text-primary hover:underline">
          Criar minha rota
        </Link>
      </p>
    </AuthLayout>
  );
}
