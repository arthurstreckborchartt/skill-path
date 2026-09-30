import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ProjectChat } from "@/components/pathly/project-chat";
import { ContextoDaConversa } from "@/components/pathly/contexto-da-conversa";
import { cn } from "@/lib/utils";
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
  const [assunto, setAssunto] = useState<string | null>(null);

  const contagens = projeto ? estadoDasPartes(projeto) : {};

  /*
   * O painel só é montado quando há assunto E blueprint. `ContextoDaConversa` ainda decide sozinho
   * se tem o que mostrar, e devolve `null` na maioria dos assuntos — mas montá-lo à toa faria as
   * consultas de banco e API dispararem em conversas que não falam disso.
   */
  const contexto =
    projeto && assunto ? (
      <ContextoDaConversa projetoId={id} blueprint={projeto.conteudo} ultimaPergunta={assunto} />
    ) : null;

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

  /*
   * A conversa é centrada enquanto não há contexto, e desliza para a esquerda quando um painel
   * aparece — em vez de encolher no lugar. Deslizar mantém a coluna de texto na mesma largura, e
   * é a linha do texto que a leitura acompanha; encolher reformataria tudo a cada assunto novo.
   */
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-5",
        contexto
          ? "max-w-5xl lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start lg:gap-6"
          : "max-w-3xl",
      )}
    >
      <div className="min-w-0 space-y-5">
        <ProjectChat projetoId={id} aoMudarAssunto={setAssunto} />
        <FerramentasDoProjeto projetoId={id} />
      </div>

      {contexto && <div className="lg:sticky lg:top-8">{contexto}</div>}
    </div>
  );
}
