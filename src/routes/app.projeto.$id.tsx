import { createFileRoute } from "@tanstack/react-router";
import { ProjectChat } from "@/components/pathly/project-chat";
import { FerramentasDoProjeto } from "@/components/pathly/ferramentas-do-projeto";
import { PainelDaParte } from "@/components/pathly/partes-do-projeto";
import { estadoDasPartes, lerParte, type SlugDeParte } from "@/components/pathly/partes";
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
   * Na URL, e não em estado de componente: o botão voltar do navegador fecha o painel como a
   * pessoa espera, o endereço pode ser compartilhado com a parte aberta, e recarregar não perde
   * o lugar. A sidebar lê a mesma query para saber o que destacar.
   *
   * `lerParte` só aceita os slugs conhecidos — o valor vem da URL e aqui ele escolhe qual
   * componente renderiza.
   */
  validateSearch: (busca: Record<string, unknown>): { parte?: SlugDeParte } => {
    const p = lerParte(busca["parte"]);
    return p ? { parte: p } : {};
  },
  component: ProjectPage,
});

/**
 * O projeto: a conversa, e o que ela produziu.
 *
 * ## Onde as partes foram parar
 *
 * Elas ficaram um tempo numa coluna à direita desta página. Subiram para a sidebar, junto do nome
 * do projeto, por dois motivos.
 *
 * O primeiro é que lá elas são **contexto**, não conteúdo: ficam visíveis em qualquer parte
 * aberta, e a pessoa sempre sabe onde está dentro do projeto. Na coluna da direita elas sumiam
 * assim que uma parte abria.
 *
 * O segundo é que a direita ficou livre. É onde vão aparecer os painéis que reagem ao assunto da
 * conversa — quando ela toca em banco, o banco aparece — e isso não caberia numa tela que já
 * tivesse três colunas.
 *
 * ## Sem parte aberta, a conversa é a tela
 *
 * Não há coluna lateral de apoio, não há cartões em volta. Só a conversa e, abaixo dela, onde
 * você parou. É o estado que a pessoa vê na maior parte do tempo, e é o mais limpo que ele
 * consegue ser.
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
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <ProjectChat projetoId={id} />
      <FerramentasDoProjeto projetoId={id} />
    </div>
  );
}
