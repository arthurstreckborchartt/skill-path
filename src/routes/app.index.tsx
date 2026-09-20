import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Compass,
  Copy,
  FolderKanban,
  MessageSquare,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { PathlyMark } from "@/components/pathly/project-chat";
import { Btn, Chip, Panel, Reveal } from "@/components/pathly/ui";
import { useDigitando } from "@/components/pathly/usar-digitando";
import { criarProjeto, useProjetos } from "@/lib/blueprint/usar-projetos";
import { RESPOSTAS_VAZIAS } from "@/lib/blueprint/respostas";
import { Spinner } from "@/components/ui/spell-spinner";
import { cn } from "@/lib/utils";
import { ProgressBar } from "@/components/pathly/ui";
import { usePainel } from "@/lib/painel/usar-painel";
import { DESCRICAO_FASE, ROTULO_FASE } from "@/lib/painel/fases";
import { ROTULO_TIPO_PROPOSTA } from "@/lib/copilot/contrato";
import { montarPrompt, DESTINOS, ROTULO_DESTINO, type Destino } from "@/lib/copilot/prompt-builder";

export const Route = createFileRoute("/app/")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Criar um SaaS — Pathly" },
      {
        name: "description",
        content: "Descreva sua ideia e transforme-a em um plano de SaaS executável.",
      },
      { property: "og:title", content: "Criar um SaaS — Pathly" },
      {
        property: "og:description",
        content: "Planejamento, decisões e execução coordenada em uma conversa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TelaInicial,
});

/**
 * A tela inicial decide entre duas coisas, e a decisão é o produto inteiro.
 *
 * Sem projeto, a resposta para "o que faço agora?" é criar o primeiro — e aí a tela de criação
 * **é** a resposta certa, não um obstáculo antes do painel.
 *
 * Com projeto, a pergunta muda para "o que faço agora NESTE projeto?", e aí um campo de texto
 * pedindo uma ideia nova é a pior resposta possível: manda recomeçar quem veio continuar.
 */
function TelaInicial() {
  const painel = usePainel();
  const [criando, setCriando] = useState(false);

  if (painel.estado === "carregando") {
    return <p className="py-10 text-sm text-muted-foreground">Carregando seus projetos…</p>;
  }
  if (painel.estado === "erro") {
    return (
      <Panel className="text-center">
        <p className="text-sm">{painel.mensagem}</p>
      </Panel>
    );
  }
  if (painel.estado === "vazio" || criando) {
    return (
      <CreateWorkspace aoCancelar={painel.estado === "vazio" ? null : () => setCriando(false)} />
    );
  }
  return <Painel painel={painel} aoCriar={() => setCriando(true)} />;
}

function CreateWorkspace({ aoCancelar }: { aoCancelar: (() => void) | null }) {
  const navigate = useNavigate();
  const projects = useProjetos();
  const [idea, setIdea] = useState("");
  const [audience, setAudience] = useState("");
  const [problem, setProblem] = useState("");
  const [step, setStep] = useState<"idea" | "details">("idea");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { ref: moldura, aoDigitar } = useDigitando();

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  async function create() {
    if (idea.trim().length < 15 || audience.trim().length < 5 || problem.trim().length < 15 || busy)
      return;
    setBusy(true);
    setError(null);
    const result = await criarProjeto({
      ...RESPOSTAS_VAZIAS,
      oQue: idea.trim(),
      paraQuem: audience.trim(),
      problema: problem.trim(),
    });
    if ("erro" in result) {
      setError(result.erro);
      setBusy(false);
      return;
    }
    window.sessionStorage.setItem(`pathly.project.prompt.${result.id}`, idea.trim());
    void navigate({ to: "/app/projeto/$id", params: { id: result.id } });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-12 py-4 sm:py-8">
      {aoCancelar && (
        <button
          type="button"
          onClick={aoCancelar}
          className="tap inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="size-4 rotate-180" /> Voltar ao painel
        </button>
      )}

      <section className="mx-auto max-w-3xl text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-md border border-border bg-foreground text-background">
          <PathlyMark className="size-5" />
        </span>
        <h1 className="mt-5 font-display text-3xl font-semibold text-balance sm:text-5xl">
          O que vamos construir?
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Descreva o SaaS com suas palavras. O Pathly organiza produto, tecnologia, segurança e
          execução.
        </p>

        <div
          ref={moldura}
          className="chat-composer-frame mt-7 text-left shadow-[var(--shadow-lift)]"
          data-processing={busy ? "true" : undefined}
        >
          <PromptInput
            onSubmit={({ text }) => {
              if (text.trim().length >= 15) {
                setIdea(text.trim());
                setStep("details");
              }
            }}
          >
            <PromptInputTextarea
              ref={inputRef}
              value={idea}
              onChange={(event) => {
                setIdea(event.target.value);
                aoDigitar();
              }}
              placeholder="Ex.: Quero construir um ERP simples para pequenas indústrias…"
              className="min-h-28 text-base"
            />
            <PromptInputFooter className="justify-between">
              <span className="px-1 text-xs text-muted-foreground">
                Você mantém o controle de cada decisão.
              </span>
              <PromptInputSubmit status="ready" disabled={idea.trim().length < 15} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </section>

      {step === "details" && (
        <Reveal>
          <Panel className="mx-auto max-w-3xl text-left">
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-2">
                <PathlyMark className="size-4" />
              </span>
              <div>
                <h2 className="font-display text-xl font-semibold">
                  Só preciso confirmar duas coisas
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Isso evita um plano genérico e define o primeiro recorte do produto.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Para quem é?
                <textarea
                  value={audience}
                  onChange={(event) => setAudience(event.target.value)}
                  placeholder="Ex.: gestores de pequenas indústrias"
                  className="mt-2 min-h-24 w-full resize-none rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="text-sm font-medium">
                Qual problema resolve?
                <textarea
                  value={problem}
                  onChange={(event) => setProblem(event.target.value)}
                  placeholder="Ex.: estoque, produção e pedidos ficam espalhados em planilhas"
                  className="mt-2 min-h-24 w-full resize-none rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>
            {error && (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Btn variant="ghost" onClick={() => setStep("idea")} disabled={busy}>
                Voltar
              </Btn>
              <Btn
                onClick={() => void create()}
                disabled={busy || audience.trim().length < 5 || problem.trim().length < 15}
              >
                {busy ? (
                  <>
                    <Spinner className="size-4" /> Criando projeto…
                  </>
                ) : (
                  <>
                    Criar espaço do projeto <ArrowRight className="size-4" />
                  </>
                )}
              </Btn>
            </div>
          </Panel>
        </Reveal>
      )}
    </div>
  );
}

/* =============================================================================================
   O PAINEL

   A ordem das seções não é a ordem em que foram pedidas: é a ordem em que a pessoa precisa delas.
   `PRÓXIMO PASSO` vem antes de riscos, decisões e prompt porque é a única que responde à pergunta
   que o produto não pode deixar acontecer — "o que eu faço agora?". Enterrá-la depois de três
   listas seria construir exatamente o painel que faz alguém perguntar isso.

   `MEUS PROJETOS` fica no topo, mas compacto: serve para saber onde você está e trocar, não para
   escolher de novo a cada visita.
   ============================================================================================= */

type PainelPronto = Extract<ReturnType<typeof usePainel>, { estado: "pronto" }>;

function Painel({ painel, aoCriar }: { painel: PainelPronto; aoCriar: () => void }) {
  const { projetos, atual, resumo, extrasIncompletos } = painel;
  const { proximoPasso, riscos, decisoesPendentes } = resumo;
  const invertido = !proximoPasso.concluido;

  return (
    <div className="mx-auto max-w-5xl space-y-10 py-4 sm:py-8">
      {/* ---------- MEUS PROJETOS ---------- */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Meus projetos</p>
          <div className="flex items-center gap-2">
            <Btn variant="ghost" size="sm" onClick={aoCriar}>
              <Plus className="size-4" /> Novo
            </Btn>
            <Link to="/app/blueprints">
              <Btn variant="ghost" size="sm">
                Ver todos <ArrowRight className="size-4" />
              </Btn>
            </Link>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {projetos.slice(0, 6).map((p) => (
            <Link key={p.id} to="/app/projeto/$id" params={{ id: p.id }}>
              <Chip tone={p.id === atual.id ? "primary" : "neutral"}>
                <FolderKanban className="size-3" /> {p.nome}
              </Chip>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- PROJETO ATUAL, PROGRESSO E FASE ---------- */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Projeto atual</p>
            <h1 className="mt-1 truncate font-display text-2xl font-semibold sm:text-3xl">
              {atual.nome}
            </h1>
          </div>
          <Link to="/app/projeto/$id" params={{ id: atual.id }}>
            <Btn variant="outline" size="sm">
              Abrir conversa <ArrowRight className="size-4" />
            </Btn>
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Panel>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Progresso</p>
              <span className="font-display text-2xl font-semibold tabular-nums">
                {resumo.progresso}%
              </span>
            </div>
            <ProgressBar value={resumo.progresso} className="mt-3 h-1.5" />
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Metade é o plano, metade é a execução — {atual.etapasConcluidas} de{" "}
              {atual.etapasTotal} etapas concluídas. Plano pronto com nada construído não é 100%.
            </p>
          </Panel>

          <Panel>
            <div className="flex items-center gap-2">
              <Compass className="size-4" />
              <p className="text-xs font-semibold uppercase text-muted-foreground">Fase atual</p>
            </div>
            <p className="mt-2 font-display text-xl font-semibold">{ROTULO_FASE[resumo.fase]}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {DESCRICAO_FASE[resumo.fase]}
            </p>
          </Panel>
        </div>
      </section>

      {/* ---------- PRÓXIMO PASSO ---------- */}
      <Reveal>
        <Panel invertido={invertido}>
          <p
            className={cn(
              "text-xs font-semibold uppercase",
              invertido ? "text-background/70" : "text-muted-foreground",
            )}
          >
            Próximo passo
          </p>
          <h2 className="mt-2 max-w-2xl font-display text-xl font-semibold sm:text-2xl">
            {proximoPasso.titulo}
          </h2>
          <p
            className={cn(
              "mt-2 max-w-2xl text-sm leading-relaxed",
              invertido ? "text-background/75" : "text-muted-foreground",
            )}
          >
            {proximoPasso.porque}
          </p>
          {proximoPasso.rota && (
            <div className="mt-5">
              <Link to={proximoPasso.rota}>
                <Btn variant={invertido ? "soft" : "primary"} size="sm">
                  Fazer isso agora <ArrowRight className="size-4" />
                </Btn>
              </Link>
            </div>
          )}
        </Panel>
      </Reveal>

      {extrasIncompletos && (
        <p role="alert" className="text-sm font-medium">
          Não consegui ler o modelo de dados, a API e as propostas agora. Riscos e decisões abaixo
          podem estar incompletos — recarregue antes de confiar na lista.
        </p>
      )}

      {/* ---------- RISCOS E DECISÕES PENDENTES ---------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4" />
            <h2 className="text-xs font-semibold uppercase text-muted-foreground">Riscos</h2>
          </div>
          <Panel className="mt-3">
            {riscos.length === 0 ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Nenhum risco com evidência nos seus artefatos. Isso não é o mesmo que estar seguro:
                a análise só enxerga o que está no plano.
              </p>
            ) : (
              <ul className="space-y-3">
                {riscos.slice(0, 3).map(({ risco, evidencias }) => (
                  <li key={risco.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-foreground/75">
                        {risco.gravidade}
                      </span>
                      <span className="text-sm font-medium">{risco.titulo}</span>
                    </div>
                    {evidencias[0] && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {evidencias[0]}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              <Link to="/app/seguranca/$id" params={{ id: atual.id }}>
                <Btn variant="ghost" size="sm">
                  {riscos.length > 3 ? "Ver todos os riscos" : "Abrir a análise"}
                  <ArrowRight className="size-4" />
                </Btn>
              </Link>
            </div>
          </Panel>
        </section>

        <section>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4" />
            <h2 className="text-xs font-semibold uppercase text-muted-foreground">
              Decisões pendentes
            </h2>
          </div>
          <Panel className="mt-3">
            {decisoesPendentes.length === 0 ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Nada esperando você. Quando o Copilot propuser mudar o plano, a proposta aparece
                aqui antes de virar decisão — nada muda sem a sua aprovação.
              </p>
            ) : (
              <ul className="space-y-3">
                {decisoesPendentes.slice(0, 3).map((p) => (
                  <li key={p.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-foreground/75">
                        {ROTULO_TIPO_PROPOSTA[p.tipo]}
                      </span>
                      <span className="text-sm font-medium">{p.titulo}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.motivo}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              <Link to="/app/projeto/$id" params={{ id: atual.id }}>
                <Btn variant="ghost" size="sm">
                  {decisoesPendentes.length > 0 ? "Decidir agora" : "Abrir a conversa"}
                  <ArrowRight className="size-4" />
                </Btn>
              </Link>
            </div>
          </Panel>
        </section>
      </div>

      {/* ---------- PROMPT PRONTO E IA DO PATHLY ---------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PromptPronto painel={painel} />

        <section>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4" />
            <h2 className="text-xs font-semibold uppercase text-muted-foreground">IA do Pathly</h2>
          </div>
          <Panel className="mt-3 flex h-full flex-col">
            <p className="text-sm leading-relaxed">
              O Copilot conhece este projeto: o plano, as decisões já tomadas e onde você parou.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Ele não altera nada sozinho. Quando propõe mudar o plano, a proposta vem para Decisões
              pendentes e espera você.
            </p>
            <div className="mt-auto pt-4">
              <Link to="/app/projeto/$id" params={{ id: atual.id }}>
                <Btn size="sm">
                  <MessageSquare className="size-4" /> Perguntar sobre este projeto
                </Btn>
              </Link>
            </div>
          </Panel>
        </section>
      </div>
    </div>
  );
}

/**
 * O prompt do próximo passo, pronto para colar num agente de código.
 *
 * Monta no clique, e não a cada render do painel: `montarPrompt` percorre blueprint, modelo e mapa
 * de API inteiros, e fazer isso sem ninguém pedir gastaria trabalho em toda visita para produzir
 * um texto que quase sempre ninguém lê.
 */
function PromptPronto({ painel }: { painel: PainelPronto }) {
  const { atual, resumo } = painel;
  const [destino, setDestino] = useState<Destino>("claude");
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    const texto = montarPrompt({
      destino,
      tipo: "implementacao",
      alvo: {
        tipo: "livre",
        tarefa: resumo.proximoPasso.titulo + ". " + resumo.proximoPasso.porque,
      },
      nomeProjeto: atual.nome,
      blueprint: atual.conteudo,
      modelo: resumo.modelo,
      api: resumo.api,
      decisoes: [],
      estadoBanco: null,
      jaExiste: [],
      etapasConcluidas: [],
      progresso: resumo.progresso,
    });
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Área de transferência negada pelo navegador. O botão não muda para "copiado", e a
      // ausência de confirmação é o próprio recado.
    }
  };

  return (
    <section>
      <div className="flex items-center gap-2">
        <Copy className="size-4" />
        <h2 className="text-xs font-semibold uppercase text-muted-foreground">Prompt pronto</h2>
      </div>
      <Panel className="mt-3 flex h-full flex-col">
        <p className="text-sm leading-relaxed">
          O próximo passo, escrito para um agente de código — com o contexto deste projeto e as
          regras que ele precisa respeitar.
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          <select
            value={destino}
            onChange={(e) => setDestino(e.target.value as Destino)}
            aria-label="Para onde vai o prompt"
            className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-foreground"
          >
            {DESTINOS.map((d) => (
              <option key={d} value={d}>
                {ROTULO_DESTINO[d]}
              </option>
            ))}
          </select>
          <Btn variant="outline" size="sm" onClick={() => void copiar()}>
            <Copy className="size-4" /> {copiado ? "Copiado" : "Copiar prompt"}
          </Btn>
        </div>
      </Panel>
    </section>
  );
}
