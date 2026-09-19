import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Eye, ShieldAlert, Sparkles } from "lucide-react";
import { Btn, Chip, Panel, Reveal } from "@/components/pathly/ui";
import { BlocoCopiavel } from "@/components/pathly/banco-vistas";
import {
  VistaChecklistSeguranca,
  VistaConfirmados,
  VistaForaDoProjeto,
  VistaLimites,
  VistaParaConferir,
} from "@/components/pathly/seguranca-vistas";
import { useProjeto } from "@/lib/blueprint/usar-projetos";
import { useDerivadosSeguranca, useSeguranca } from "@/lib/seguranca/usar-seguranca";
import type { ContextoSeguranca } from "@/lib/seguranca/riscos";
import { completarBlueprint } from "@/lib/blueprint/contrato";
import { respostasSuficientes } from "@/lib/blueprint/respostas";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spell-spinner";

export const Route = createFileRoute("/app/seguranca/$id")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Segurança — Pathly" }] }),
  component: TelaSeguranca,
});

const ABAS = [
  { id: "achados", texto: "Achados" },
  { id: "conferir", texto: "A conferir" },
  { id: "checklist", texto: "Checklist" },
  { id: "relatorio", texto: "Relatório" },
  { id: "fora", texto: "Fora do escopo" },
] as const;
type Aba = (typeof ABAS)[number]["id"];

function TelaSeguranca() {
  const { id } = Route.useParams();
  const { estado: estadoProjeto } = useProjeto(id);
  const { estado, buscando, buscarExtras, alternarItem } = useSeguranca(id);
  const [aba, setAba] = useState<Aba>("achados");

  const projeto = estadoProjeto.estado === "pronto" ? estadoProjeto.projeto : null;

  /**
   * O contexto da análise, montado no cliente.
   *
   * Memoizado porque a identidade dele é o que decide se `analisar` roda de novo — e ela percorre
   * o catálogo inteiro contra todas as colunas do modelo.
   */
  const contexto = useMemo<ContextoSeguranca | null>(() => {
    if (!projeto || estado.estado !== "pronto") return null;
    return {
      respostas: projeto.respostas,
      blueprint: completarBlueprint(projeto.conteudo ?? {}),
      modelo: estado.modelo,
      api: estado.api,
    };
  }, [projeto, estado]);

  const extras = estado.estado === "pronto" ? estado.extras : [];
  const d = useDerivadosSeguranca(contexto, extras, projeto?.nome ?? "projeto");

  if (estadoProjeto.estado === "carregando" || estado.estado === "carregando") {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  if (!projeto) {
    return (
      <Panel className="text-center">
        <p className="text-sm text-muted-foreground">Não consegui carregar este projeto.</p>
        <Link
          to="/app/blueprints"
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          Voltar para seus projetos
        </Link>
      </Panel>
    );
  }

  const cabecalho = (
    <div>
      <Link
        to="/app/blueprint/$id"
        params={{ id }}
        className="tap inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Plano do projeto
      </Link>
      <h1 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
        Segurança — {projeto.nome}
      </h1>
    </div>
  );

  if (estado.estado === "erro") {
    return (
      <div className="space-y-6">
        {cabecalho}
        <Panel className="text-center">
          <ShieldAlert className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-destructive">{estado.mensagem}</p>
        </Panel>
      </div>
    );
  }

  /**
   * O questionário é a única dependência dura.
   *
   * Sem ele não há projeto para analisar — nem o catálogo sabe o que se aplica. Banco e API, ao
   * contrário, são opcionais: a análise roda sem eles e diz o que ficou fora do alcance.
   */
  if (!respostasSuficientes(projeto.respostas)) {
    return (
      <div className="space-y-6">
        {cabecalho}
        <Panel className="text-center">
          <ShieldAlert className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-foreground/90">
            Responda o questionário do projeto antes de analisar a segurança.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            A análise sai do que você respondeu: sem isso, ela listaria os mesmos riscos genéricos
            para todo mundo.
          </p>
          <Link
            to="/app/blueprint/$id"
            params={{ id }}
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            Ir para o plano
          </Link>
        </Panel>
      </div>
    );
  }

  if (!d) return null;

  const { analise, contagem, limites, checklist, relatorio } = d;

  return (
    <div className="space-y-6">
      {cabecalho}

      <Reveal>
        <Panel>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="flex flex-wrap gap-1.5">
              {contagem.evidencias > 0 ? (
                <Chip tone="accent">
                  <Eye className="size-3" /> {contagem.evidencias} no seu plano
                </Chip>
              ) : (
                <Chip tone="muted">
                  <Eye className="size-3" /> nenhum achado automático
                </Chip>
              )}
              {contagem.criticosConfirmados > 0 && (
                <Chip tone="accent">{contagem.criticosConfirmados} críticos</Chip>
              )}
              <Chip>{contagem.aplicaveis} riscos se aplicam</Chip>
              {contagem.foraDoProjeto > 0 && (
                <Chip tone="muted">{contagem.foraDoProjeto} fora do escopo</Chip>
              )}
            </div>
            <Btn
              variant="ghost"
              size="sm"
              disabled={buscando}
              onClick={() => void buscarExtras()}
              title="Buscar riscos específicos deste projeto"
            >
              {buscando ? <Spinner className="size-4" /> : <Sparkles className="size-4" />}
            </Btn>
          </div>

          {!estado.modelo || !estado.api ? (
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Esta análise rodou sem
              {!estado.modelo && " o modelo de dados"}
              {!estado.modelo && !estado.api && " nem"}
              {!estado.api && " o mapa de APIs"}. Projetar
              {!estado.modelo && !estado.api ? " os dois" : " ele"} aumenta o alcance das checagens.
            </p>
          ) : null}

          {extras.length === 0 && estado.extrasVieram === false && (
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Os riscos específicos não vieram desta vez — a análise acima não depende deles. Toque
              na varinha para tentar de novo.
            </p>
          )}

          {estado.erroExtras && (
            <p role="alert" className="mt-4 text-xs leading-relaxed text-destructive">
              {estado.erroExtras} A análise atual continua disponível; toque na varinha para tentar
              novamente.
            </p>
          )}
        </Panel>
      </Reveal>

      <Reveal delay={60}>
        <VistaLimites limites={limites} />
      </Reveal>

      <Reveal delay={90}>
        <div className="-mx-4 no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {ABAS.map((x) => (
            <button
              key={x.id}
              onClick={() => setAba(x.id)}
              className={cn(
                "tap shrink-0 rounded-full px-4 py-2 text-sm transition-colors",
                aba === x.id
                  ? "bg-primary/15 font-medium text-primary"
                  : "bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              {x.texto}
            </button>
          ))}
        </div>
      </Reveal>

      <Reveal delay={120}>
        {aba === "achados" && <VistaConfirmados achados={analise.confirmados} />}

        {aba === "conferir" && <VistaParaConferir achados={analise.paraConferir} extras={extras} />}

        {aba === "checklist" && (
          <Panel>
            {estado.erroChecklist && (
              <p role="alert" className="mb-4 text-sm text-destructive">
                {estado.erroChecklist}
              </p>
            )}
            <VistaChecklistSeguranca
              itens={checklist}
              feitos={estado.itensFeitos}
              aoAlternar={(chave) => void alternarItem(chave)}
            />
          </Panel>
        )}

        {aba === "relatorio" && (
          <Panel>
            <BlocoCopiavel
              texto={relatorio}
              rotulo="Análise de segurança, em Markdown — para o README ou para quem for revisar"
            />
          </Panel>
        )}

        {aba === "fora" && <VistaForaDoProjeto fora={analise.foraDoProjeto} />}
      </Reveal>
    </div>
  );
}
