import { createFileRoute } from "@tanstack/react-router";
import { ProjectChat } from "@/components/pathly/project-chat";
import { FerramentasDoProjeto } from "@/components/pathly/ferramentas-do-projeto";
import { PainelDaParte, PartesDoProjeto } from "@/components/pathly/partes-do-projeto";
import { estadoDasPartes, lerParte, type SlugDeParte } from "@/components/pathly/partes";
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
  /**
   * `?parte=dados` abre aquela parte ao lado da conversa.
   *
   * Na URL, e não em estado de componente, por três razões: o botão voltar do navegador fecha o
   * painel como a pessoa espera, o endereço pode ser compartilhado com a parte já aberta, e
   * recarregar não perde onde ela estava.
   *
   * `lerParte` só aceita os oito slugs conhecidos. Qualquer outra coisa vira `null` e o painel não
   * abre — um valor vindo da URL é entrada externa, e aqui ele escolhe qual componente renderiza.
   */
  validateSearch: (busca: Record<string, unknown>): { parte?: SlugDeParte } => {
    const p = lerParte(busca["parte"]);
    return p ? { parte: p } : {};
  },
  component: ProjectPage,
});

/**
 * O projeto: a conversa no centro, o que ela produziu ao lado.
 *
 * ## As duas formas
 *
 * **Sem parte aberta**, a conversa ocupa a largura e a coluna da direita lista as oito partes com
 * o estado ao lado do nome.
 *
 * **Com parte aberta**, a conversa encolhe e o painel entra ao lado dela, com as abas no topo. A
 * conversa nunca sai da tela — que era o ponto: ela é o centro do produto, e substituí-la por uma
 * tela de artefato desfaz o modelo inteiro.
 *
 * No celular não há duas colunas, então o painel entra acima da conversa: quem pediu para ver os
 * dados quer ver os dados, e a conversa fica logo abaixo, inteira.
 */
function ProjectPage() {
  const { id } = Route.useParams();
  const { parte } = Route.useSearch();
  const { estado } = useProjeto(id);
  const projeto = estado.estado === "pronto" ? estado.projeto : null;

  const contagens = projeto ? estadoDasPartes(projeto) : {};

  if (parte) {
    return (
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* No celular o painel vem primeiro; no desktop volta para a direita. */}
        <div className="order-1 min-w-0 lg:order-2">
          <PainelDaParte projetoId={id} parte={parte} estado={contagens} />
        </div>
        <div className="order-2 min-w-0 lg:order-1 lg:sticky lg:top-8">
          <ProjectChat projetoId={id} />
        </div>
      </div>
    );
  }

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
              <PartesDoProjeto projeto={projeto} aberta={null} estado={contagens} />
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
          "Onde eu parei" fica na mesma coluna das partes, e não acima da conversa como estava. As
          duas coisas respondem à mesma pergunta — qual o estado do meu trabalho — e a conversa
          fica inteira para conversar.
        */}
        <FerramentasDoProjeto projetoId={id} />
      </aside>
    </div>
  );
}
