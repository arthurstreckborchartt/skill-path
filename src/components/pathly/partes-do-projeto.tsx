import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, X } from "lucide-react";
import { Skeleton } from "./ui";
import { PARTES, type SlugDeParte } from "./partes";
import { cn } from "@/lib/utils";
import type { Projeto } from "@/lib/blueprint/usar-projetos";

/**
 * As partes de um projeto — a coluna, as abas e o painel que as abre sem tirar a conversa da tela.
 *
 * ## O que mudou
 *
 * Plano, Etapas, Dados, API, IA, Validação, Segurança e Lançamento eram oito rotas. Abrir uma
 * substituía a tela inteira, e a conversa — que é o centro do produto — desaparecia.
 *
 * As oito telas foram soltas da própria rota: cada uma recebe o `id` por prop em vez de chamar
 * `Route.useParams()`. Com isso a mesma tela roda dentro deste painel, e as rotas continuam
 * existindo como casca de duas linhas — todo link que já existia continua abrindo.
 *
 * ## Por que `lazy`
 *
 * Importar as oito direto puxaria todas para o pacote da conversa, e quem só quer conversar
 * baixaria oito telas que não vai abrir. Com `lazy` o código continua dividido e cada parte chega
 * quando é pedida.
 */

type PropsDaTela = { id: string; emPainel?: boolean };

const TELAS: Record<SlugDeParte, LazyExoticComponent<ComponentType<PropsDaTela>>> = {
  plano: lazy(() =>
    import("@/routes/app.blueprint.$id").then((m) => ({ default: m.TelaBlueprint })),
  ),
  /*
   * Decisões é a única que nunca foi uma rota: nasceu direto como painel. As decisões eram
   * gravadas e mandadas para o prompt do Copilot desde sempre, mas nunca apareceram para quem as
   * tomou.
   */
  decisoes: lazy(() =>
    import("./decisoes-do-projeto").then((m) => ({
      default: ({ id }: PropsDaTela) => <m.DecisoesDoProjeto projetoId={id} />,
    })),
  ),
  etapas: lazy(() => import("@/routes/app.roadmap.$id").then((m) => ({ default: m.TelaRoadmap }))),
  dados: lazy(() => import("@/routes/app.banco.$id").then((m) => ({ default: m.TelaBanco }))),
  api: lazy(() => import("@/routes/app.api.$id").then((m) => ({ default: m.TelaApi }))),
  ia: lazy(() =>
    import("@/routes/app.arquitetura-ia.$id").then((m) => ({ default: m.TelaArquiteturaIa })),
  ),
  validacao: lazy(() =>
    import("@/routes/app.validacao.$id").then((m) => ({ default: m.TelaValidacao })),
  ),
  seguranca: lazy(() =>
    import("@/routes/app.seguranca.$id").then((m) => ({ default: m.TelaSeguranca })),
  ),
  publicar: lazy(() =>
    import("@/routes/app.lancamento.$id").then((m) => ({ default: m.TelaLancamento })),
  ),
};

/*
 * A coluna vertical de partes morava aqui e foi para a sidebar, junto do nome do projeto. Lá ela
 * é contexto: fica visível com qualquer parte aberta, em vez de sumir na hora em que a pessoa
 * abre uma. O que sobrou neste arquivo é o painel.
 */

export function PainelDaParte({ projetoId, parte }: { projetoId: string; parte: SlugDeParte }) {
  const Tela = TELAS[parte];

  return (
    <section
      aria-label={PARTES.find((p) => p.slug === parte)?.rotulo}
      className="rounded-lg border border-border bg-surface"
    >
      {/*
        As abas ficam no topo do painel, e não numa terceira coluna: com o painel aberto o que
        falta é espaço horizontal, e uma coluna a mais espremeria a conversa até ela deixar de
        servir para conversar.
      */}
      {/*
        A volta para a conversa, só no celular.

        O X de fechar fica no fim desta fileira, que com nove abas rola para fora da tela num
        aparelho — a saída existia e não dava para alcançar. No desktop a conversa está ao lado e
        o botão seria ruído.
      */}
      <Link
        to="/app/projeto/$id"
        params={{ id: projetoId }}
        search={{}}
        className="tap flex items-center gap-1.5 border-b border-border px-3 py-2.5 text-sm text-muted-foreground lg:hidden"
      >
        <ArrowLeft className="size-4" />
        Voltar à conversa
      </Link>

      {/*
        A fileira de nove abas saiu daqui.

        Ela duplicava a coluna da sidebar — os mesmos nove destinos, duas vezes na mesma tela — e
        era a cópia pior: rolava horizontalmente e, medido em 1280px, já cortava "Validação" ao
        meio e escondia Segurança e Publicar. Num aparelho escondia quase tudo, incluindo o X que
        era a única saída do painel.

        A sidebar faz esse trabalho melhor: coluna vertical, nome por extenso, ícone, contador, e
        a parte aberta marcada. No celular ela é a gaveta, a um toque no nome do projeto.

        Sobra aqui só a saída — "Voltar à conversa" no celular, o X no desktop.
      */}
      <div className="hidden justify-end border-b border-border px-2 py-2 lg:flex">
        <Link
          to="/app/projeto/$id"
          params={{ id: projetoId }}
          search={{}}
          aria-label="Fechar painel"
          className="tap grid size-7 place-items-center rounded-md text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </Link>
      </div>

      <div className="p-4 sm:p-5">
        <Suspense
          fallback={
            <div className="space-y-3">
              <Skeleton className="h-6 w-1/3 rounded-md" />
              <Skeleton className="h-40 rounded-lg" />
            </div>
          }
        >
          <Tela id={projetoId} emPainel />
        </Suspense>
      </div>
    </section>
  );
}
