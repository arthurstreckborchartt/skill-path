import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Chip } from "@/components/pathly/ui";
import { ProjectChat } from "@/components/pathly/project-chat";
import { ContextoDaConversa } from "@/components/pathly/contexto-da-conversa";
import { FerramentasDoProjeto } from "@/components/pathly/ferramentas-do-projeto";
import { PainelDaParte } from "@/components/pathly/partes-do-projeto";
import { lerParte, type SlugDeParte } from "@/components/pathly/partes";
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
      <div className="lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className="min-w-0 lg:order-2">
          <PainelDaParte projetoId={id} parte={parte} />
        </div>

        {/*
          No celular a parte aberta é a tela: a conversa sai de vista.

          Empilhar as duas numa tela de 375px daria meia conversa e meio painel, e nenhum dos dois
          serviria. Quem tocou em "Dados" quer ver os dados; a barra de cima diz onde ele está, e
          o botão dentro do painel volta para a conversa — que continua ali, com o histórico
          inteiro, a um toque.
        */}
        <div className="hidden min-w-0 lg:order-1 lg:block lg:sticky lg:top-8">
          {/* A parte aberta vira o contexto da pergunta — ver `facetaDaParte`. */}
          <ProjectChat projetoId={id} parteAberta={parte} />
        </div>
      </div>
    );
  }

  /*
   * A conversa é centrada enquanto não há contexto, e desliza para a esquerda quando um painel
   * aparece — em vez de encolher no lugar. Deslizar mantém a coluna de texto na mesma largura, e
   * é a linha do texto que a leitura acompanha; encolher reformataria tudo a cada assunto novo.
   */
  /*
   * As ferramentas vão para a coluna da direita, e não abaixo da conversa.
   *
   * Empilhadas elas nunca apareciam: o `ProjectChat` tem `min-h-[calc(100svh-8rem)]`, então o que
   * vem depois dele começa fora da tela por construção. Quem não soubesse que a seção existe não
   * teria motivo para rolar até ela — e rolar devolvia a conversa para fora de vista.
   *
   * A coluna rola por dentro (`overflow-y-auto` com teto de altura) em vez de esticar a página.
   * Sem isso, uma lateral alta traria o mesmo problema de volta pelo outro lado.
   *
   * No celular não há lateral, e aí elas voltam para baixo da conversa — empilhar é a única opção
   * em 375px, e meia conversa com meio painel não serviria nenhum dos dois.
   */
  return (
    /*
      `lg:h-full` para a conversa poder encostar embaixo, e `max-w-6xl` em vez de `5xl`.

      Com 5xl a grade travava em 1088px: a coluna da conversa ficava com 757 e a linha de texto com
      727, enquanto sobravam 1100px disponíveis numa janela de 1440. O chat ficava estreito e o
      resto da tela, vazio. Em 6xl a grade usa o espaço até o teto do <main>, a conversa chega aos
      ~768px de linha — a largura de leitura confortável — e a lateral fica onde está.
    */
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:grid-rows-[minmax(0,1fr)] lg:gap-6">
      <div className="h-full min-w-0 shrink-0 lg:min-h-0">
        <ProjectChat projetoId={id} aoMudarAssunto={setAssunto} />
      </div>

      {/* `lg:h-full` e rolagem por dentro, no lugar de `sticky` com um `max-h` calculado à mão:
          a coluna agora tem a altura da grade, que tem a altura do <main>. Sem número nenhum. */}
      <div className="barra-discreta flex flex-col gap-5 lg:h-full lg:min-h-0 lg:overflow-y-auto">
        {/*
          O aviso que morava no cabeçalho do chat.

          Ele saiu de lá junto com o cabeçalho, e não podia sair do app: é a frase que explica por
          que nada acontece sozinho. Aqui ele fica ao lado das ferramentas que ele governa, que é
          onde a afirmação tem contexto — no topo do chat ela era uma etiqueta solta.
        */}
        <Chip tone="muted" className="self-start">
          <ShieldCheck className="size-3" /> Ações exigem aprovação
        </Chip>

        {/* As ferramentas primeiro: estão sempre presentes, e eram elas que ninguém via. O
            contexto da conversa aparece e some conforme o assunto, então vem depois. */}
        <FerramentasDoProjeto projetoId={id} />
        {contexto}
      </div>
    </div>
  );
}
