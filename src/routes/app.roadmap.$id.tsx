import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Map as MapIcon, SkipForward, X } from "lucide-react";
import { Btn, Chip, Panel, Reveal } from "@/components/pathly/ui";
import {
  BarraProgresso,
  CartaoAtual,
  FasesForaDoProjeto,
  TrilhaDeFases,
} from "@/components/pathly/roadmap";
import { DetalheEtapa } from "@/components/pathly/etapa-detalhe";
import { SessaoDeDesenvolvimento } from "@/components/pathly/sessao-de-desenvolvimento";
import { useProjeto } from "@/lib/blueprint/usar-projetos";
import {
  contarProgresso,
  ondeEstou,
  useConteudoEtapa,
  useProgresso,
  useRoadmap,
} from "@/lib/blueprint/usar-roadmap";
import { Spinner } from "@/components/ui/spell-spinner";

export const Route = createFileRoute("/app/roadmap/$id")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Roadmap — Pathly" }] }),
  component: TelaRoadmap,
});

function TelaRoadmap() {
  const { id } = Route.useParams();
  const { estado } = useProjeto(id);
  const { porOrdem, salvar } = useProgresso(id);
  const [aberta, setAberta] = useState<number | null>(null);

  const projeto = estado.estado === "pronto" ? estado.projeto : null;
  const { fases, foraDoProjeto } = useRoadmap(
    projeto?.conteudo ?? {},
    projeto?.respostas ?? ({} as never),
    porOrdem,
  );

  const conteudo = useConteudoEtapa(id, aberta);

  if (estado.estado === "carregando") {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }
  if (estado.estado === "erro" || !projeto) {
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

  const temRoadmap = fases.length > 0;

  /**
   * Execução existe, mas nenhuma etapa caiu numa fase canônica.
   *
   * Acontece com roadmaps gerados antes das fases fixas, quando a IA inventava os nomes ("Fundação
   * Técnica", "Setup Inicial"). A tela precisa dizer isso: sem a mensagem ela ficaria vazia
   * exatamente como um projeto sem plano, e a pessoa concluiria que o app perdeu o trabalho dela.
   */
  const roadmapAntigo = !temRoadmap && (projeto.conteudo.execucao?.etapas.length ?? 0) > 0;
  const atual = ondeEstou(fases);
  const numeros = contarProgresso(fases);
  const etapaAberta =
    aberta === null ? null : fases.flatMap((f) => f.etapas).find((e) => e.ordem === aberta);
  const faseDaAtual = atual ? fases.find((f) => f.fase.nome === atual.fase)?.fase : undefined;
  /* A etapa do plano, que é a que carrega entrega e fase — a do progresso só carrega o estado. */
  const etapaDoPlano = etapaAberta
    ? projeto.conteudo.execucao?.etapas.find((e) => e.ordem === etapaAberta.ordem)
    : undefined;

  async function alternarItem(indice: number) {
    if (!etapaAberta) return;
    const feitos = etapaAberta.checklistFeito;
    const novo = feitos.includes(indice) ? feitos.filter((x) => x !== indice) : [...feitos, indice];
    await salvar(etapaAberta.ordem, { checklistFeito: novo });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/app/blueprint/$id"
          params={{ id }}
          className="tap inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Plano do projeto
        </Link>
        <h1 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">{projeto.nome}</h1>
      </div>

      {!temRoadmap && (
        <Panel className="text-center">
          <MapIcon className="mx-auto size-8 text-muted-foreground" />
          {roadmapAntigo ? (
            <>
              <p className="mt-3 text-sm text-foreground/90">
                Este roadmap foi montado antes das fases fixas existirem.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                As etapas continuam salvas no plano. Refaça o bloco de Execução para elas se
                encaixarem nas 18 fases e o acompanhamento começar a funcionar.
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-foreground/90">
                O roadmap nasce do bloco de Execução do plano.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Gere as cinco partes do plano e a trilha aparece aqui.
              </p>
            </>
          )}
          <Link
            to="/app/blueprint/$id"
            params={{ id }}
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            Ir para o plano
          </Link>
        </Panel>
      )}

      {temRoadmap && (
        <>
          {/* "O que já fiz?" e "O que falta?" numa linha só, antes de qualquer detalhe. */}
          <Reveal>
            <Panel>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-display text-3xl font-semibold">{numeros.pct}%</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {numeros.feitas} de {numeros.total} etapas
                    {numeros.puladas > 0 &&
                      ` · ${numeros.puladas} pulada${numeros.puladas > 1 ? "s" : ""}`}
                  </p>
                </div>
                <Chip tone="muted">~{numeros.horasRestantes}h restantes</Chip>
              </div>
              <div className="mt-4">
                <BarraProgresso pct={numeros.pct} />
              </div>
            </Panel>
          </Reveal>

          {atual && (
            <Reveal delay={60}>
              <CartaoAtual
                etapa={atual}
                fase={faseDaAtual}
                aoAbrir={() => setAberta(atual.ordem)}
              />
            </Reveal>
          )}

          {!atual && (
            <Reveal delay={60}>
              <Panel className="text-center">
                <Check className="mx-auto size-8 text-primary" />
                <p className="mt-3 font-display text-lg font-semibold">Roadmap concluído.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Todas as etapas foram marcadas. A fase de Evolução começa com o uso real.
                </p>
              </Panel>
            </Reveal>
          )}

          <Reveal delay={120}>
            <TrilhaDeFases
              fases={fases}
              ordemAtual={atual?.ordem ?? null}
              aoAbrir={(ordem) => setAberta(ordem)}
            />
          </Reveal>

          <Reveal delay={180}>
            <FasesForaDoProjeto itens={foraDoProjeto} />
          </Reveal>
        </>
      )}

      {/*
        A etapa abre como painel em cima, não como página nova.
        Assim a pessoa não perde o lugar na trilha ao fechar — e "onde estou" continua verdadeiro.
      */}
      {etapaAberta && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-foreground/20">
          <div className="mx-auto min-h-full w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
            <Panel>
              <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border pb-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      ETAPA {String(etapaAberta.ordem).padStart(2, "0")}
                    </span>
                    <Chip tone="muted">{etapaAberta.fase}</Chip>
                    {etapaAberta.status === "concluida" && <Chip tone="primary">concluída</Chip>}
                  </div>
                  <h2 className="mt-2 font-display text-xl font-semibold sm:text-2xl">
                    {etapaAberta.titulo}
                  </h2>
                </div>
                <Btn variant="ghost" size="sm" onClick={() => setAberta(null)} title="Fechar">
                  <X className="size-4" />
                </Btn>
              </header>

              <div className="mt-5">
                {conteudo.estado === "carregando" && (
                  <div className="flex items-center gap-2.5 py-8 text-sm text-muted-foreground">
                    <Spinner className="size-4" />
                    Escrevendo esta etapa para o seu projeto — leva até um minuto e meio.
                  </div>
                )}

                {conteudo.estado === "erro" && (
                  <div className="py-6">
                    <p className="text-sm text-destructive">{conteudo.mensagem}</p>
                    <Btn variant="outline" className="mt-4" onClick={conteudo.tentarNovamente}>
                      Tentar de novo
                    </Btn>
                  </div>
                )}

                {conteudo.estado === "pronta" && (
                  <DetalheEtapa
                    conteudo={conteudo.conteudo}
                    checklistFeito={etapaAberta.checklistFeito}
                    aoAlternarItem={(i) => void alternarItem(i)}
                  />
                )}

                {/*
                  A sessão entra depois do conteúdo da etapa, não antes: o brief só faz sentido
                  para quem já leu o que a etapa pede. Antes, viraria um botão de copiar sem saber
                  o que se está copiando.
                */}
                {conteudo.estado === "pronta" && etapaDoPlano && (
                  <SessaoDeDesenvolvimento
                    projetoId={id}
                    nomeProjeto={projeto.nome}
                    blueprint={projeto.conteudo}
                    etapa={etapaDoPlano}
                    etapasConcluidas={numeros.feitas}
                    etapasTotal={numeros.total}
                  />
                )}
              </div>

              {/* As ações de status ficam no rodapé, depois de ler — não antes. */}
              {conteudo.estado === "pronta" && (
                <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
                  {etapaAberta.status !== "concluida" ? (
                    <>
                      <Btn
                        onClick={() => {
                          void salvar(etapaAberta.ordem, { status: "concluida" });
                          setAberta(null);
                        }}
                      >
                        <Check className="size-4" /> Marcar como concluída
                      </Btn>
                      {etapaAberta.status !== "fazendo" && (
                        <Btn
                          variant="outline"
                          onClick={() => void salvar(etapaAberta.ordem, { status: "fazendo" })}
                        >
                          Estou fazendo esta
                        </Btn>
                      )}
                      <Btn
                        variant="ghost"
                        onClick={() => {
                          void salvar(etapaAberta.ordem, { status: "pulada" });
                          setAberta(null);
                        }}
                        title="Esta etapa não se aplica ao meu caso"
                      >
                        <SkipForward className="size-4" /> Pular
                      </Btn>
                    </>
                  ) : (
                    <Btn
                      variant="outline"
                      onClick={() => void salvar(etapaAberta.ordem, { status: "pendente" })}
                    >
                      Reabrir etapa
                    </Btn>
                  )}
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
