import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Database,
  Lock,
  Rocket,
} from "lucide-react";
import { Btn, Chip, Panel, ProgressBar, Reveal } from "@/components/pathly/ui";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spell-spinner";
import { BlurReveal } from "@/components/ui/blur-reveal";
import { useLancamento } from "@/lib/lancamento/usar-lancamento";
import { promptDoPasso, temPrompt } from "@/lib/lancamento/prompts";
import { DESTINOS, ROTULO_DESTINO, type Destino } from "@/lib/copilot/prompt-builder";
import {
  AMBIENTES,
  DEFINICAO_AMBIENTE,
  DESCRICAO_TRILHA,
  ROTULO_AMBIENTE,
  ROTULO_ESTADO,
  ROTULO_TRILHA,
  TRILHAS,
  type Ambiente,
  type ContextoLancamento,
  type Estado,
  type Fonte,
  type Resultado,
} from "@/lib/lancamento/contrato";

export const Route = createFileRoute("/app/lancamento/$id")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Lançamento — Pathly" },
      {
        name: "description",
        content: "Do localhost à produção, com o que precisa ser verdade antes de cada passo.",
      },
    ],
  }),
  component: TelaLancamento,
});

/** Como cada estado se apresenta sem depender de cor — a identidade é monocromática. */
const APRESENTACAO: Record<Estado, { bloco: string; icone: typeof Check }> = {
  bloqueio: { bloco: "border-foreground/20 bg-foreground text-background", icone: Lock },
  atencao: { bloco: "border-foreground/20 bg-surface-2", icone: AlertTriangle },
  passou: { bloco: "border-border bg-surface", icone: Check },
};

const ROTULO_FONTE: Record<Fonte, string> = {
  sonda: "Sonda ao banco",
  automatica: "Verificado pelo app",
  confirmacao: "Confirmado por você",
  pendente: "Ninguém conferiu ainda",
};

function TelaLancamento() {
  const { id } = Route.useParams();
  const { estado, relatorio, sondando, sondarBanco, confirmarPasso, erroConfirmacao } =
    useLancamento(id);
  const [ambienteAberto, setAmbienteAberto] = useState<Ambiente | null>(null);

  if (estado.estado === "carregando") {
    return <p className="text-sm text-muted-foreground">Carregando o lançamento…</p>;
  }

  if (estado.estado === "erro" || !relatorio) {
    return (
      <Panel className="text-center">
        <p className="text-sm">
          {estado.estado === "erro" ? estado.mensagem : "Não consegui montar o relatório."}
        </p>
      </Panel>
    );
  }

  const { relatorio: rel, porAmbiente, veredito, contexto } = relatorio;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link
          to="/app/projeto/$id"
          params={{ id }}
          className="tap inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar ao projeto
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold sm:text-[1.75rem]">Lançamento</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Do localhost até produção, para {estado.nomeProjeto}
            </p>
          </div>
          <Chip tone="muted">
            <Rocket className="size-3" /> {rel.percentualGeral}% conferido
          </Chip>
        </div>
      </header>

      {/* ---------- O veredito ---------- */}
      <Reveal>
        <Panel
          invertido={!veredito.pode}
          {...(veredito.pode ? {} : { className: "border-foreground/20" })}
        >
          <div className="flex items-start gap-3">
            {veredito.pode ? (
              <Check className="mt-1 size-5 shrink-0" />
            ) : (
              <Lock className="mt-1 size-5 shrink-0" />
            )}
            <div className="min-w-0">
              <h2 className="font-display text-xl font-semibold sm:text-2xl">
                <BlurReveal>
                  {veredito.pode ? "Nada impede o lançamento." : "Ainda não dá para lançar."}
                </BlurReveal>
              </h2>
              <p
                className={cn(
                  "mt-2 max-w-2xl text-sm leading-relaxed",
                  veredito.pode ? "text-muted-foreground" : "text-background/75",
                )}
              >
                {veredito.frase}
              </p>
            </div>
          </div>
        </Panel>
      </Reveal>

      {/* ---------- Os três ambientes ---------- */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Os três ambientes</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Quase todo desastre de lançamento cabe numa frase: alguém achou que estava num ambiente
            e estava em outro. Por isso aqui eles não são etiqueta — cada passo diz em quais vale.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {AMBIENTES.map((amb, i) => {
            const p = porAmbiente.find((x) => x.ambiente === amb);
            const aberto = ambienteAberto === amb;
            return (
              <Reveal key={amb} delay={i * 70}>
                <Panel className="flex h-full flex-col">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-base font-semibold">{ROTULO_AMBIENTE[amb]}</h3>
                    <span className="font-display text-lg font-semibold tabular-nums">
                      {p?.percentual ?? 0}%
                    </span>
                  </div>
                  <ProgressBar value={p?.percentual ?? 0} className="mt-2.5 h-1" />
                  <p className="mt-3 text-sm leading-relaxed">{DEFINICAO_AMBIENTE[amb].resumo}</p>

                  <p className="mt-3 text-xs text-muted-foreground">
                    {p?.aplicaveis ?? 0} passos
                    {(p?.bloqueios ?? 0) > 0 && ` · ${p?.bloqueios} em bloqueio`}
                    {(p?.pendentes ?? 0) > 0 && ` · ${p?.pendentes} sem resposta`}
                  </p>

                  <button
                    type="button"
                    onClick={() => setAmbienteAberto(aberto ? null : amb)}
                    className="tap mt-auto flex items-center gap-1.5 pt-4 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <ChevronDown
                      className={cn("size-3.5 transition-transform", aberto && "rotate-180")}
                    />
                    A regra que não se quebra
                  </button>
                  {aberto && (
                    <p className="mt-2 border-t border-border pt-3 text-sm leading-relaxed">
                      {DEFINICAO_AMBIENTE[amb].regra}
                    </p>
                  )}
                </Panel>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ---------- A sonda ---------- */}
      <Panel className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Perguntar ao banco o que existe de verdade</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            É a única evidência aqui que não depende do que alguém escreveu no plano. Sem ela, o
            passo das migrations fica em “não sei”, que é diferente de “não existe”.
          </p>
          {estado.erroSonda && (
            <p role="alert" className="mt-2 text-sm font-medium">
              {estado.erroSonda}
            </p>
          )}
        </div>
        <Btn variant="outline" size="sm" disabled={sondando} onClick={() => void sondarBanco()}>
          {sondando ? <Spinner className="size-4" /> : <Database className="size-4" />}
          {estado.sondaFeita ? "Sondar de novo" : "Sondar o banco"}
        </Btn>
      </Panel>

      {/* ---------- As cinco trilhas ---------- */}
      {TRILHAS.map((trilha) => {
        const itens = rel.resultados.filter((r) => r.passo.trilha === trilha);
        if (itens.length === 0) return null;
        const p = rel.porTrilha.find((x) => x.trilha === trilha);

        return (
          <section key={trilha} className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-xl font-semibold">{ROTULO_TRILHA[trilha]}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {DESCRICAO_TRILHA[trilha]}
                </p>
              </div>
              <div className="text-right">
                <span className="font-display text-lg font-semibold tabular-nums">
                  {p?.percentual ?? 0}%
                </span>
                <p className="text-xs text-muted-foreground">
                  {p?.verificados ?? 0} verificados · {p?.confirmados ?? 0} confirmados
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {itens.map((r) => (
                <ItemPasso
                  key={r.passo.id}
                  r={r}
                  contexto={contexto}
                  progresso={rel.percentualGeral}
                  erro={erroConfirmacao?.id === r.passo.id ? erroConfirmacao.mensagem : null}
                  aoConfirmar={() => void confirmarPasso(r.passo.id)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {rel.naoAplicaveis > 0 && (
        <p className="text-sm text-muted-foreground">
          {rel.naoAplicaveis} {rel.naoAplicaveis === 1 ? "passo saiu" : "passos saíram"} da lista
          por não se aplicarem a este projeto. Lista cheia de item irrelevante ensina a ignorar a
          lista.
        </p>
      )}
    </div>
  );
}

function ItemPasso({
  r,
  contexto,
  progresso,
  erro,
  aoConfirmar,
}: {
  r: Resultado;
  contexto: ContextoLancamento;
  progresso: number;
  /** O que impediu de registrar a confirmação DESTE passo. Aparece colado no botão que falhou. */
  erro: string | null;
  aoConfirmar: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [destino, setDestino] = useState<Destino>("claude");
  const [copiado, setCopiado] = useState(false);

  const { passo, estado } = r;
  const { bloco, icone: Icone } = APRESENTACAO[estado];
  const invertido = estado === "bloqueio";
  const suave = invertido ? "text-background/70" : "text-muted-foreground";

  const copiarPrompt = async () => {
    const texto = promptDoPasso(passo, contexto, destino, progresso);
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Área de transferência negada pelo navegador. Silenciar aqui é aceitável porque o botão
      // não muda para "copiado" — a ausência de confirmação é o próprio recado.
    }
  };

  return (
    <div className={cn("rounded-md border p-4", bloco)}>
      <div className="flex items-start gap-3">
        <Icone className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                invertido ? "bg-background/20" : "bg-muted text-foreground/75",
              )}
            >
              {ROTULO_ESTADO[estado]}
            </span>
            <span className={cn("text-xs", suave)}>{ROTULO_FONTE[r.fonte]}</span>
            <span className={cn("text-xs", suave)}>
              · {passo.ambientes.map((a) => ROTULO_AMBIENTE[a]).join(", ")}
            </span>
          </div>

          <p className="mt-2 text-sm font-medium">{passo.titulo}</p>
          <p
            className={cn(
              "mt-1 text-sm leading-relaxed",
              invertido ? "text-background/85" : "text-foreground/80",
            )}
          >
            {passo.porque}
          </p>

          {r.evidencia && (
            <p className={cn("mt-2 text-xs leading-relaxed", suave)}>{r.evidencia}</p>
          )}

          <button
            type="button"
            onClick={() => setAberto(!aberto)}
            className={cn(
              "tap mt-3 flex items-center gap-1.5 text-xs font-medium",
              invertido
                ? "text-background/80 hover:text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ChevronDown className={cn("size-3.5 transition-transform", aberto && "rotate-180")} />
            {aberto ? "Fechar" : "Entender e conferir"}
          </button>

          {aberto && (
            <div
              className={cn(
                "mt-3 space-y-3 border-t pt-3 text-sm leading-relaxed",
                invertido ? "border-background/20" : "border-border",
              )}
            >
              <p className="whitespace-pre-line">{passo.ensina}</p>

              {passo.armadilha && (
                <div>
                  <p className="text-xs font-semibold uppercase">A armadilha</p>
                  <p className="mt-1">{passo.armadilha}</p>
                </div>
              )}

              {passo.porAmbiente && (
                <div>
                  <p className="text-xs font-semibold uppercase">O que muda por ambiente</p>
                  <ul className="mt-1 space-y-1">
                    {AMBIENTES.filter((a) => passo.porAmbiente?.[a]).map((a) => (
                      <li key={a}>
                        <span className="font-medium">{ROTULO_AMBIENTE[a]}:</span>{" "}
                        {passo.porAmbiente?.[a]}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase">Como conferir</p>
                <p className="mt-1">{passo.comoValidar}</p>
              </div>

              {/* O prompt só existe onde um agente de código resolve. Registrar domínio ou
                  restaurar backup não são disso, e oferecer prompt ali fingiria que a parte
                  difícil é escrever código. */}
              {temPrompt(passo) && (
                <div
                  className={cn(
                    "rounded-md border p-3",
                    invertido ? "border-background/20" : "border-border bg-surface-2",
                  )}
                >
                  <p className="text-xs font-semibold uppercase">Mandar para um agente</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={destino}
                      onChange={(e) => setDestino(e.target.value as Destino)}
                      aria-label="Para onde vai o prompt"
                      className={cn(
                        "h-9 rounded-md border px-2 text-sm",
                        invertido
                          ? "border-background/25 bg-transparent text-background"
                          : "border-border bg-surface text-foreground",
                      )}
                    >
                      {DESTINOS.map((d) => (
                        <option key={d} value={d} className="text-foreground">
                          {ROTULO_DESTINO[d]}
                        </option>
                      ))}
                    </select>
                    <Btn variant="outline" size="sm" onClick={() => void copiarPrompt()}>
                      <Copy className="size-4" />
                      {copiado ? "Copiado" : "Copiar prompt"}
                    </Btn>
                  </div>
                </div>
              )}

              {r.aceitaConfirmacao ? (
                <div>
                  <Btn
                    variant={r.fonte === "confirmacao" ? "ghost" : "outline"}
                    size="sm"
                    onClick={aoConfirmar}
                  >
                    <Check className="size-4" />
                    {r.fonte === "confirmacao" ? "Desmarcar" : "Confirmo que conferi"}
                  </Btn>
                  {erro && (
                    <p role="alert" className="mt-2 text-xs font-medium">
                      {erro}
                    </p>
                  )}
                </div>
              ) : (
                <p className={cn("text-xs", suave)}>
                  Este passo o Pathly confere sozinho — não há o que marcar. Corrija o plano e o
                  resultado muda.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
