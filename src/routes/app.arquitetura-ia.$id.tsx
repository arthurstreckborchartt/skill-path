import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Brain, Loader2, RefreshCw } from "lucide-react";
import { Btn, Panel, Reveal } from "@/components/pathly/ui";
import { BlocoCopiavel } from "@/components/pathly/banco-vistas";
import {
  NotaDoCatalogo,
  VistaConceitosIa,
  VistaDescartadas,
  VistaFuncionalidades,
  VistaPromptsIa,
  VistaVeredito,
} from "@/components/pathly/arquitetura-ia-vistas";
import { useProjeto } from "@/lib/blueprint/usar-projetos";
import { useArquiteturaIa, useDerivadosIa } from "@/lib/arquitetura-ia/usar-arquitetura-ia";
import type { ContextoProjeto } from "@/lib/arquitetura-ia/derivados";
import { completarBlueprint } from "@/lib/blueprint/contrato";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/arquitetura-ia/$id")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Arquitetura de IA — Pathly" }] }),
  component: TelaArquiteturaIa,
});

const ABAS = [
  { id: "veredito", texto: "Veredito" },
  { id: "funcionalidades", texto: "Arquitetura" },
  { id: "semIa", texto: "Sem IA" },
  { id: "conceitos", texto: "Conceitos" },
  { id: "prompts", texto: "Prompts" },
  { id: "relatorio", texto: "Relatório" },
] as const;
type Aba = (typeof ABAS)[number]["id"];

function TelaArquiteturaIa() {
  const { id } = Route.useParams();
  const { estado: estadoProjeto } = useProjeto(id);
  const { estado, gerando, gerar } = useArquiteturaIa(id);
  const [aba, setAba] = useState<Aba>("veredito");

  const projeto = estadoProjeto.estado === "pronto" ? estadoProjeto.projeto : null;
  const plano = estado.estado === "pronto" ? estado.plano : null;

  const contexto = useMemo<ContextoProjeto | null>(() => {
    if (!projeto || (estado.estado !== "pronto" && estado.estado !== "vazio")) return null;
    return {
      nome: projeto.nome,
      blueprint: completarBlueprint(projeto.conteudo ?? {}),
      modelo: estado.modelo,
      api: estado.api,
    };
  }, [projeto, estado]);

  const d = useDerivadosIa(plano, contexto);

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
        Arquitetura de IA — {projeto.nome}
      </h1>
    </div>
  );

  if (estado.estado === "vazio" || estado.estado === "erro") {
    const semProduto = estado.estado === "erro" && estado.motivo === "sem-produto";
    const semQuestionario = estado.estado === "erro" && estado.motivo === "questionario-incompleto";
    const faltaAlgo = semProduto || semQuestionario;

    return (
      <div className="space-y-6">
        {cabecalho}
        <Panel className="text-center">
          <Brain className="mx-auto size-8 text-muted-foreground" />
          {estado.estado === "erro" ? (
            <p className="mt-3 text-sm text-destructive">{estado.mensagem}</p>
          ) : (
            <>
              <p className="mt-3 text-sm text-foreground/90">
                Antes de implementar IA: você precisa de IA?
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                A análise olha cada funcionalidade do seu MVP e diz o que resolve sem IA, o que
                resolve com uma chamada só, e o que realmente precisa de mais que isso — com custo
                por mês e o prompt de implementação de cada uma.
              </p>
            </>
          )}

          {faltaAlgo ? (
            <Link
              to="/app/blueprint/$id"
              params={{ id }}
              className="mt-4 inline-block text-sm text-primary hover:underline"
            >
              Ir para o plano
            </Link>
          ) : (
            <Btn className="mt-5" disabled={gerando} onClick={() => void gerar(false)}>
              {gerando ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Analisando — leva até dois minutos
                </>
              ) : (
                <>
                  <Brain className="size-4" /> Analisar
                </>
              )}
            </Btn>
          )}
        </Panel>
      </div>
    );
  }

  if (!plano || !d) return null;

  return (
    <div className="space-y-6">
      {cabecalho}

      <Reveal>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <VistaVeredito
              precisaDeIa={plano.precisaDeIa}
              veredito={plano.veredito}
              resumo={d.resumo}
            />
          </div>
          <Btn
            variant="ghost"
            size="sm"
            disabled={gerando}
            onClick={() => void gerar(true)}
            title="Analisar de novo"
          >
            {gerando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </Btn>
        </div>
      </Reveal>

      {(!contexto?.modelo || !contexto?.api) && (
        <Reveal delay={40}>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Os prompts de implementação saíram sem
            {!contexto?.modelo && " o modelo de dados"}
            {!contexto?.modelo && !contexto?.api && " nem"}
            {!contexto?.api && " o mapa de APIs"}. Projetar
            {!contexto?.modelo && !contexto?.api ? " os dois" : " ele"} faz cada prompt citar as
            suas tabelas e rotas pelo nome.
          </p>
        </Reveal>
      )}

      <Reveal delay={60}>
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
        {aba === "veredito" && (
          <Panel>
            <p className="text-sm leading-relaxed text-muted-foreground">
              O veredito acima é o resultado principal desta tela. As outras abas detalham: o que
              foi descartado e por quê, a arquitetura do que sobrou, os conceitos que este plano
              usa, e os prompts para implementar.
            </p>
            <div className="mt-4">
              <NotaDoCatalogo />
            </div>
          </Panel>
        )}

        {aba === "funcionalidades" && <VistaFuncionalidades calculadas={d.calculadas} />}

        {aba === "semIa" && (
          <Panel>
            <VistaDescartadas descartadas={plano.descartadas} />
          </Panel>
        )}

        {aba === "conceitos" && <VistaConceitosIa conceitos={d.conceitos} fora={d.conceitosFora} />}

        {aba === "prompts" && (
          <Panel>
            <VistaPromptsIa calculadas={d.calculadas} />
          </Panel>
        )}

        {aba === "relatorio" && (
          <Panel>
            <BlocoCopiavel
              texto={d.relatorio}
              rotulo="Arquitetura de IA, em Markdown — para o README ou para quem for revisar"
            />
          </Panel>
        )}
      </Reveal>
    </div>
  );
}
