import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, LayoutPanelTop } from "lucide-react";
import { ProjectChat } from "@/components/pathly/project-chat";
import { Btn } from "@/components/pathly/ui";

export const Route = createFileRoute("/app/projeto/$id")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Projeto — Pathly" },
      { name: "description", content: "Planeje e coordene a criação do seu SaaS com o Pathly." },
      { property: "og:title", content: "Projeto — Pathly" },
      { property: "og:description", content: "Conversa, decisões e execução do seu SaaS em um só lugar." },
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
        <Link to="/app/blueprints" className="tap inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Projetos
        </Link>
        <Link to="/app/blueprint/$id" params={{ id }}>
          <Btn variant="outline" size="sm"><LayoutPanelTop className="size-4" /> Ver plano</Btn>
        </Link>
      </div>
      <ProjectChat projetoId={id} />
    </div>
  );
}