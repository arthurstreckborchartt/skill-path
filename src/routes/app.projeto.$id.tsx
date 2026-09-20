import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, LayoutPanelTop, Rocket, ShieldCheck } from "lucide-react";
import { ProjectChat } from "@/components/pathly/project-chat";
import { Btn } from "@/components/pathly/ui";

export const Route = createFileRoute("/app/projeto/$id")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Projeto — Pathly" },
      { name: "description", content: "Planeje e coordene a criação do seu SaaS com o Pathly." },
      { property: "og:title", content: "Projeto — Pathly" },
      {
        property: "og:description",
        content: "Conversa, decisões e execução do seu SaaS em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectPage,
});

function ProjectPage() {
  const { id } = Route.useParams();
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/app/blueprints"
          className="tap inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Projetos
        </Link>
        {/*
          A validação fica ao lado do plano, e não dentro dele: conferir enquanto se constrói é o
          ponto. Escondida um nível abaixo, ela só seria aberta no fim — que é quando conserto já
          custa caro.
        */}
        <div className="flex shrink-0 items-center gap-2">
          <Link to="/app/validacao/$id" params={{ id }}>
            <Btn variant="ghost" size="sm">
              <ShieldCheck className="size-4" /> Validação
            </Btn>
          </Link>
          {/*
            Lançamento ao lado de validação, e não depois dela: as duas perguntam "isto está de
            pé?", só que sobre coisas diferentes — uma sobre o que foi construído, outra sobre
            onde isso vai rodar. Guardar a segunda para o fim é o que faz alguém descobrir na
            véspera que não tem backup.
          */}
          <Link to="/app/lancamento/$id" params={{ id }}>
            <Btn variant="ghost" size="sm">
              <Rocket className="size-4" /> Lançamento
            </Btn>
          </Link>
          <Link to="/app/blueprint/$id" params={{ id }}>
            <Btn variant="outline" size="sm">
              <LayoutPanelTop className="size-4" /> Ver plano
            </Btn>
          </Link>
        </div>
      </div>
      <ProjectChat projetoId={id} />
    </div>
  );
}
