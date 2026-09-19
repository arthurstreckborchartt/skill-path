import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  Database,
  LayoutPanelTop,
  Lock,
} from "lucide-react";
import { Btn, Panel, ProgressBar, Reveal } from "@/components/pathly/ui";
import { cn } from "@/lib/utils";
import { useRelatorio, useValidacao } from "@/lib/validacao/usar-validacao";
import {
  ROTULO_DOMINIO,
  ROTULO_ESTADO,
  type Estado,
  type Fonte,
  type Resultado,
} from "@/lib/validacao/contrato";
import { doDominio } from "@/lib/validacao/motor";
import { Spinner } from "@/components/ui/spell-spinner";
import { BlurReveal } from "@/components/ui/blur-reveal";

export const Route = createFileRoute("/app/validacao/$id")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Validação — Pathly" },
      {
        name: "description",
        content: "Confira se o que você construiu está de pé, com evidência e não com caixinha.",
      },
    ],
  }),
  component: TelaValidacao,
});

/**
 * A tela de validação.
 *
 * ## Por que o estado não é indicado por cor
 *
 * A identidade do Pathly é monocromática: `destructive` e `primary` são tons de cinza. Um
 * "passou" verde e um "bloqueio" vermelho simplesmente não existem aqui — e pintar os três
 * estados em cinzas próximos daria a pior combinação possível, a de parecer codificado por cor
 * sem ser distinguível.
 *
 * Então o estado é dito de três formas que não dependem de matiz: o rótulo por extenso, o ícone,
 * e o peso do bloco. Bloqueio é o único invertido — fundo sólido, texto do fundo da página. Numa
 * lista de trinta itens em cinza, o invertido é o que o olho encontra primeiro, que é exatamente
 * o que precisa acontecer com o que impede seguir.
 */
function TelaValidacao() {
  const { id } = Route.useParams();
  const { estado, sondando, sondarBanco, alternarConfirmacao } = useValidacao(id);
  const d = useRelatorio(estado);
  const [aberto, setAberto] = useState<string | null>(null);

  if (estado.estado === "carregando") {
    return <p className="text-sm text-muted-foreground">Carregando a validação…</p>;
  }

  if (estado.estado === "erro" || !d) {
    return (
      <Panel className="text-center">
        <p className="text-sm">
          {estado.estado === "erro" ? estado.mensagem : "Não consegui montar o relatório."}
        </p>
        <Link to="/app/blueprints" className="mt-4 inline-block text-sm font-medium underline">
          Voltar para seus projetos
        </Link>
      </Panel>
    );
  }

  const { relatorio, veredito } = d;
  const temModelo = (estado.contexto.modelo?.entidades ?? []).length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/app/projeto/$id"
          params={{ id }}
          className="tap inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {estado.nomeProjeto || "Projeto"}
        </Link>
        <Link to="/app/blueprint/$id" params={{ id }}>
          <Btn variant="outline" size="sm">
            <LayoutPanelTop className="size-4" /> Ver plano
          </Btn>
        </Link>
      </div>

      <div>
        <h1 className="font-display text-2xl font-semibold sm:text-[1.75rem]">Validação</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O que o app consegue conferir no seu plano, e o que só você pode confirmar.
        </p>
      </div>

      <Reveal>
        <VerditoPainel
          bloqueios={relatorio.bloqueios.length}
          motivo={veredito.pode ? null : veredito.motivo}
          progresso={relatorio.progressoGeral}
          verificadas={relatorio.verificadas}
          confirmadas={relatorio.confirmadas}
          total={relatorio.resultados.length}
        />
      </Reveal>

      {temModelo && (
        <Reveal delay={40}>
          <Panel>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="text-sm font-medium">Conferir o banco de verdade</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Pergunta ao seu banco quais tabelas do plano existem mesmo. É a única evidência
                  aqui que não depende do plano nem da sua palavra.
                </p>
              </div>
              <Btn
                variant="outline"
                size="sm"
                disabled={sondando}
                onClick={() => void sondarBanco()}
              >
                {sondando ? (
                  <>
                    <Spinner className="size-4" /> Sondando…
                  </>
                ) : (
                  <>
                    <Database className="size-4" />{" "}
                    {estado.sondaFeita ? "Sondar de novo" : "Sondar"}
                  </>
                )}
              </Btn>
            </div>
            {estado.erroSonda && (
              <p role="alert" className="mt-3 text-xs font-medium">
                {estado.erroSonda}
              </p>
            )}
            {estado.sondaFeita && !estado.erroSonda && (
              <ul className="mt-4 space-y-1.5 border-t border-border pt-3">
                {estado.contexto.tabelasNoBanco.map((t) => (
                  <li key={t.nome} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 shrink-0">
                      {t.existeNoBanco === true && <Check className="size-3.5" />}
                      {t.existeNoBanco === false && <Lock className="size-3.5" />}
                      {t.existeNoBanco === null && <AlertTriangle className="size-3.5" />}
                    </span>
                    <span className="min-w-0 leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">{t.nome}</span> —{" "}
                      {t.existeNoBanco === true && "existe no banco"}
                      {t.existeNoBanco === false && "não existe no banco"}
                      {t.existeNoBanco === null && "não deu para determinar"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </Reveal>
      )}

      <div className="space-y-2.5">
        {relatorio.porDominio.map((p, i) => {
          const itens = doDominio(relatorio, p.dominio);
          const estaAberto = aberto === p.dominio;

          return (
            <Reveal key={p.dominio} delay={60 + i * 12}>
              <div className="overflow-hidden rounded-lg border border-border bg-surface">
                <button
                  type="button"
                  aria-expanded={estaAberto}
                  onClick={() => setAberto(estaAberto ? null : p.dominio)}
                  className="tap grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 p-4 text-left hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-medium">{ROTULO_DOMINIO[p.dominio]}</h2>
                      {p.bloqueio > 0 && (
                        <span className="rounded-md bg-foreground px-2 py-0.5 text-[11px] font-semibold text-background">
                          {p.bloqueio} {p.bloqueio === 1 ? "bloqueio" : "bloqueios"}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.passou} de {p.aplicaveis} · {p.verificadas} verificadas pelo app
                      {p.confirmadas > 0 && `, ${p.confirmadas} confirmadas por você`}
                    </p>
                    <ProgressBar value={p.percentual} className="mt-2.5 h-1 max-w-48" />
                  </div>
                  <span className="text-sm font-medium tabular-nums">{p.percentual}%</span>
                  <ChevronDown
                    className={cn(
                      "size-4 text-muted-foreground transition-transform",
                      estaAberto && "rotate-180",
                    )}
                  />
                </button>

                {estaAberto && (
                  <div className="space-y-2 border-t border-border bg-background/40 p-3 sm:p-4">
                    {itens.map((r) => (
                      <ItemVerificacao
                        key={r.verificacao.id}
                        r={r}
                        erro={
                          estado.erroConfirmacao?.id === r.verificacao.id
                            ? estado.erroConfirmacao.mensagem
                            : null
                        }
                        aoConfirmar={() => void alternarConfirmacao(r.verificacao.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Reveal>
          );
        })}
      </div>

      {relatorio.foraDoEscopo.length > 0 && (
        <Reveal delay={200}>
          <Panel>
            <p className="text-sm font-medium">Fora do escopo deste projeto</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Estas verificações existem, mas não se aplicam ao que você está construindo. Ficam
              fora da conta de progresso — item irrelevante em lista longa ensina a ignorar a lista.
            </p>
            <ul className="mt-3 space-y-1">
              {relatorio.foraDoEscopo.map((v) => (
                <li key={v.id} className="text-xs leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground/75">
                    {ROTULO_DOMINIO[v.dominio]}
                  </span>{" "}
                  — {v.titulo}
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>
      )}
    </div>
  );
}

/**
 * O painel de veredito.
 *
 * Invertido quando há bloqueio, comum quando não há. É a mesma peça nos dois casos porque a
 * pessoa precisa aprender a ler um lugar só para saber se pode seguir.
 */
function VerditoPainel({
  bloqueios,
  motivo,
  progresso,
  verificadas,
  confirmadas,
  total,
}: {
  bloqueios: number;
  motivo: string | null;
  progresso: number;
  verificadas: number;
  confirmadas: number;
  total: number;
}) {
  const travado = bloqueios > 0;

  return (
    <div
      className={cn(
        "rounded-lg border p-5 sm:p-6",
        travado ? "border-foreground/20 bg-foreground text-background" : "border-border bg-surface",
      )}
    >
      <div className="flex items-center gap-2">
        {travado ? <Lock className="size-4" /> : <Check className="size-4" />}
        {/*
          Letra a letra, e não palavra a palavra como no resto do app: é o veredito, a frase mais
          importante da tela, e uma revelação mais lenta faz a pessoa ler em vez de varrer. Vale
          aqui justamente por ser uma frase curta e única — o componente custa uma `motion.span`
          por caractere, então não serve para bloco de texto.
        */}
        <BlurReveal
          as="h2"
          className="font-display text-lg font-semibold"
          speedReveal={2.2}
          speedSegment={0.4}
        >
          {travado ? "Há bloqueios para resolver" : "Nada bloqueia seguir"}
        </BlurReveal>
      </div>

      {motivo && <p className="mt-2 max-w-2xl text-sm leading-relaxed">{motivo}</p>}

      <div className="mt-5 flex items-baseline gap-2">
        <span className="font-display text-4xl font-semibold tabular-nums">{progresso}%</span>
        <span className={cn("text-xs", travado ? "text-background/65" : "text-muted-foreground")}>
          de {total} verificações que se aplicam a este projeto
        </span>
      </div>

      <div
        className={cn(
          "mt-3 h-1.5 w-full max-w-md overflow-hidden rounded-full",
          travado ? "bg-background/20" : "bg-muted",
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
            travado ? "bg-background" : "bg-foreground",
          )}
          style={{ width: `${progresso}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className={travado ? "text-background/75" : "text-muted-foreground"}>
          <span className="font-semibold">{verificadas}</span> verificadas pelo app
        </span>
        <span className={travado ? "text-background/75" : "text-muted-foreground"}>
          <span className="font-semibold">{confirmadas}</span> confirmadas por você
        </span>
      </div>

      {/*
        A frase que impede a barra de virar um número que a pessoa escolhe. Sem ela, "58%" parece
        progresso de obra; com ela, fica claro que confirmar pesa menos que conferir.
      */}
      <p
        className={cn(
          "mt-4 border-t pt-3 text-xs leading-relaxed",
          travado
            ? "border-background/20 text-background/65"
            : "border-border text-muted-foreground",
        )}
      >
        O que você confirma à mão vale 60% do que o app consegue verificar. Marcar tudo não chega a
        100% — e não remove bloqueio.
      </p>
    </div>
  );
}

/** Como cada estado se apresenta sem depender de cor. */
const APRESENTACAO: Record<Estado, { bloco: string; icone: typeof Check }> = {
  bloqueio: { bloco: "border-foreground/20 bg-foreground text-background", icone: Lock },
  atencao: { bloco: "border-foreground/20 bg-surface-2", icone: AlertTriangle },
  passou: { bloco: "border-border bg-surface", icone: Check },
};

const ROTULO_FONTE: Record<Fonte, string> = {
  sonda: "Sonda ao banco",
  automatica: "Verificado pelo app",
  confirmacao: "Confirmado por você",
  pendente: "Ninguém verificou ainda",
};

function ItemVerificacao({
  r,
  erro,
  aoConfirmar,
}: {
  r: Resultado;
  /** O que impediu de registrar a confirmação DESTE item. Aparece colado no botão que falhou. */
  erro: string | null;
  aoConfirmar: () => void;
}) {
  const { verificacao: v, estado, fonte, evidencia } = r;
  const { bloco, icone: Icone } = APRESENTACAO[estado];
  const invertido = estado === "bloqueio";

  return (
    <div className={cn("rounded-md border p-3.5", bloco)}>
      <div className="flex items-start gap-2.5">
        <Icone className="mt-0.5 size-4 shrink-0" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-medium">{v.titulo}</p>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                invertido ? "bg-background/20" : "bg-muted text-muted-foreground",
              )}
            >
              {ROTULO_ESTADO[estado]}
            </span>
          </div>

          {evidencia && (
            <p
              className={cn(
                "mt-1.5 text-xs leading-relaxed",
                invertido ? "text-background/85" : "text-foreground/80",
              )}
            >
              {evidencia}
            </p>
          )}

          <p
            className={cn(
              "mt-2.5 text-xs leading-relaxed",
              invertido ? "text-background/65" : "text-muted-foreground",
            )}
          >
            {v.porque}
          </p>
          <p
            className={cn(
              "mt-1.5 text-xs leading-relaxed",
              invertido ? "text-background/65" : "text-muted-foreground",
            )}
          >
            <span className="font-medium">Como conferir: </span>
            {v.comoValidar}
          </p>

          {/*
            O botão só existe onde o app não consegue verificar. Onde ele consegue, não há o que a
            pessoa acrescente — e oferecer a caixinha ali ensinaria que marcar resolve.
          */}
          {r.aceitaConfirmacao ? (
            <button
              type="button"
              aria-pressed={fonte === "confirmacao"}
              onClick={aoConfirmar}
              className={cn(
                "tap mt-3 inline-flex min-h-8 items-center gap-2 rounded-md border px-2.5 py-1 text-xs transition-colors",
                fonte === "confirmacao"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "grid size-3.5 shrink-0 place-items-center rounded-[3px] border",
                  fonte === "confirmacao" ? "border-background bg-background" : "border-current",
                )}
              >
                {fonte === "confirmacao" && <Check className="size-2.5 text-foreground" />}
              </span>
              {fonte === "confirmacao" ? "Você confirmou" : "Confirmo que conferi"}
            </button>
          ) : null}

          {erro && (
            <p
              role="alert"
              className={cn(
                "mt-2 rounded-md border px-2.5 py-1.5 text-xs leading-relaxed font-medium",
                invertido
                  ? "border-background/30 bg-background/10"
                  : "border-foreground/30 bg-surface-2",
              )}
            >
              {erro}
            </p>
          )}

          {!r.aceitaConfirmacao && (
            <p
              className={cn(
                "mt-3 flex flex-wrap items-center gap-1.5 text-[11px]",
                invertido ? "text-background/60" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 font-medium",
                  invertido ? "bg-background/20 text-background" : "bg-muted text-foreground/75",
                )}
              >
                {ROTULO_FONTE[fonte]}
              </span>
              não há o que marcar aqui
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
