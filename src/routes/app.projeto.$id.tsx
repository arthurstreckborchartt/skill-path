import { createFileRoute } from "@tanstack/react-router";
import { ProjectChat } from "@/components/pathly/project-chat";
import { FerramentasDoProjeto } from "@/components/pathly/ferramentas-do-projeto";
import { PartesDoProjeto } from "@/components/pathly/partes-do-projeto";
import { SectionLabel, Skeleton } from "@/components/pathly/ui";
import { useProjeto } from "@/lib/blueprint/usar-projetos";

export const Route = createFileRoute("/app/projeto/$id")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Projeto — Pathly" },
      { name: "description", content: "Planeje e coordene a criação do seu produto com o Pathly." },
      { property: "og:title", content: "Projeto — Pathly" },
      {
        property: "og:description",
        content: "Conversa, decisões e execução do seu produto em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectPage,
});

/**
 * O projeto: a conversa no centro, o que ela produziu ao lado.
 *
 * ## A mudança de forma
 *
 * Antes havia uma barra de botões no topo — Validação, Lançamento, Ver plano — e as outras cinco
 * partes só existiam dentro da tela do plano, a dois cliques. Quem quisesse saber o que já estava
 * de pé abria uma por uma.
 *
 * Agora as oito ficam numa coluna, com o estado ao lado do nome. A conversa não divide espaço com
 * navegação: ela ocupa o centro, e a coluna responde "onde isto está" sem tirar ninguém de lá.
 *
 * No celular a coluna vai para baixo da conversa, não para uma gaveta. Numa tela estreita a
 * conversa é o que a pessoa veio fazer, e empurrar o painel para um botão esconderia justamente o
 * resumo que ela veio ler.
 */
function ProjectPage() {
  const { id } = Route.useParams();
  const { estado } = useProjeto(id);
  const projeto = estado.estado === "pronto" ? estado.projeto : null;

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start lg:gap-6">
      <div className="order-1 min-w-0">
        <ProjectChat projetoId={id} />
      </div>

      <aside className="order-2 flex flex-col gap-5 lg:sticky lg:top-8">
        <section>
          <SectionLabel>Este projeto</SectionLabel>
          <div className="mt-2">
            {projeto ? (
              <PartesDoProjeto projeto={projeto} />
            ) : (
              <div className="space-y-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-9 rounded-md" />
                ))}
              </div>
            )}
          </div>
        </section>

        {/*
          "Onde eu parei" fica na mesma coluna das partes, e não acima da conversa como estava.
          As duas coisas respondem à mesma pergunta — qual o estado do meu trabalho — e a conversa
          fica inteira para conversar.
        */}
        <FerramentasDoProjeto projetoId={id} />
      </aside>
    </div>
  );
}
