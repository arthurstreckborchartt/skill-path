import { Check, ChevronRight, CircleDashed, Lock, Play, SkipForward } from "lucide-react";
import { Chip } from "./ui";
import { cn } from "@/lib/utils";
import type { EtapaNoRoadmap, FaseNoRoadmap, StatusEtapa } from "@/lib/blueprint/usar-roadmap";
import type { Fase } from "@/lib/blueprint/fases";

/**
 * A trilha visual do roadmap.
 *
 * O desenho responde às cinco perguntas na ordem em que elas aparecem na cabeça de quem abre o
 * app: onde estou (o cartão do topo), o que já fiz (a barra e os marcadores verdes), o que falta
 * (o resto da lista, visível), por que estou fazendo isso (o objetivo da fase, sempre ao lado) e
 * qual é o próximo passo (o botão grande, um só).
 *
 * A linha vertical existe para dar a sensação de caminho: cada etapa é uma parada, e o que já
 * passou fica preenchido. Sem ela a lista viraria um monte de cartões sem direção.
 */

const CORES: Record<StatusEtapa, { ponto: string; anel: string; texto: string }> = {
  concluida: { ponto: "bg-primary", anel: "border-primary", texto: "text-foreground" },
  fazendo: { ponto: "bg-accent", anel: "border-accent", texto: "text-foreground" },
  pendente: { ponto: "bg-surface-2", anel: "border-border", texto: "text-foreground/80" },
  pulada: { ponto: "bg-muted", anel: "border-border", texto: "text-muted-foreground" },
};

function IconeStatus({ status, bloqueada }: { status: StatusEtapa; bloqueada: boolean }) {
  if (status === "concluida") return <Check className="size-3.5 text-primary-foreground" />;
  if (status === "pulada") return <SkipForward className="size-3 text-muted-foreground" />;
  if (bloqueada) return <Lock className="size-3 text-muted-foreground" />;
  if (status === "fazendo") return <Play className="size-3 fill-current text-accent-foreground" />;
  return <CircleDashed className="size-3.5 text-muted-foreground" />;
}

export function BarraProgresso({ pct }: { pct: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** "Onde estou?" — o cartão que abre a tela, com o próximo passo e nada mais competindo. */
export function CartaoAtual({
  etapa,
  fase,
  aoAbrir,
}: {
  etapa: EtapaNoRoadmap;
  fase: Fase | undefined;
  aoAbrir: () => void;
}) {
  return (
    <button
      onClick={aoAbrir}
      className="tap group relative w-full overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-surface to-surface p-5 text-left transition-colors hover:border-primary/50 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="primary">Você está aqui</Chip>
        {fase && (
          <span className="text-xs text-muted-foreground">
            Fase {String(fase.numero).padStart(2, "0")} · {fase.nome}
          </span>
        )}
      </div>

      <h2 className="mt-3 font-display text-xl font-semibold sm:text-2xl">{etapa.titulo}</h2>
      <p className="mt-1.5 text-sm text-foreground/90">{etapa.entrega}</p>

      {/* "Por que estou fazendo isso?" fica junto do passo, não escondido numa aba. */}
      {fase && (
        <p className="mt-3 border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground">
          {fase.objetivo}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-transform group-hover:translate-x-0.5">
          {etapa.status === "fazendo" ? "Continuar" : "Começar esta etapa"}
          <ChevronRight className="size-4" />
        </span>
        <span className="text-xs text-muted-foreground">~{etapa.estimativaHoras}h</span>
      </div>

      {!etapa.liberada && (
        <p className="mt-3 text-xs text-muted-foreground">
          Depende da etapa {etapa.bloqueadaPor.join(", ")} — dá para adiantar, mas o caminho mais
          curto passa por lá primeiro.
        </p>
      )}
    </button>
  );
}

function LinhaEtapa({
  etapa,
  atual,
  aoAbrir,
}: {
  etapa: EtapaNoRoadmap;
  atual: boolean;
  aoAbrir: () => void;
}) {
  const cor = CORES[etapa.status];
  const bloqueada = !etapa.liberada && etapa.status === "pendente";

  return (
    <button
      onClick={aoAbrir}
      className={cn(
        "tap group relative grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg py-3 pl-1 pr-2 text-left transition-colors hover:bg-surface/60",
        atual && "bg-surface/80",
      )}
    >
      {/* O marcador na linha do tempo. `z-10` para o fundo dele cobrir a linha que passa atrás. */}
      <span
        className={cn(
          "relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2",
          cor.ponto,
          cor.anel,
        )}
      >
        <IconeStatus status={etapa.status} bloqueada={bloqueada} />
      </span>

      <span className="min-w-0">
        <span className={cn("block text-sm font-medium", cor.texto)}>
          <span className="mr-1.5 font-mono text-xs text-muted-foreground">
            {String(etapa.ordem).padStart(2, "0")}
          </span>
          {etapa.titulo}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{etapa.entrega}</span>

        {bloqueada && (
          <span className="mt-1.5 inline-block text-xs text-muted-foreground">
            Precisa antes: etapa {etapa.bloqueadaPor.join(", ")}
          </span>
        )}
      </span>

      <span className="mt-0.5 shrink-0 text-xs text-muted-foreground">
        {etapa.estimativaHoras}h
      </span>
    </button>
  );
}

export function TrilhaDeFases({
  fases,
  ordemAtual,
  aoAbrir,
}: {
  fases: FaseNoRoadmap[];
  ordemAtual: number | null;
  aoAbrir: (ordem: number) => void;
}) {
  return (
    <div className="space-y-7">
      {fases.map((f) => {
        const completa = f.concluidas === f.etapas.length;
        return (
          <section key={f.fase.numero}>
            <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "font-mono text-xs font-semibold",
                      completa ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    FASE {String(f.fase.numero).padStart(2, "0")}
                  </span>
                  {completa && <Chip tone="primary">concluída</Chip>}
                </div>
                <h3 className="mt-0.5 font-display text-lg font-semibold">{f.fase.nome}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{f.fase.objetivo}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {f.concluidas}/{f.etapas.length}
              </span>
            </header>

            {/* A linha vertical atrás dos marcadores, criando o fio do caminho. */}
            <div className="relative mt-3">
              <span aria-hidden className="absolute bottom-6 left-4 top-4 w-px bg-border" />
              <div className="relative space-y-0.5">
                {f.etapas.map((e) => (
                  <LinhaEtapa
                    key={e.ordem}
                    etapa={e}
                    atual={e.ordem === ordemAtual}
                    aoAbrir={() => aoAbrir(e.ordem)}
                  />
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

/**
 * As fases que este projeto não tem, com o motivo.
 *
 * Mostrar em vez de omitir: uma fase ausente em silêncio parece esquecimento do app. Dizendo
 * "Pagamentos não entra porque você respondeu que o projeto não cobra", a ausência vira decisão —
 * e fica claro onde mexer se a resposta estiver errada.
 */
export function FasesForaDoProjeto({ itens }: { itens: { fase: Fase; porque: string }[] }) {
  if (itens.length === 0) return null;

  return (
    <div className="rounded-lg border border-dashed border-border p-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Fases que seu projeto não precisa
      </h3>
      <div className="mt-3 space-y-2">
        {itens.map(({ fase, porque }) => (
          <div key={fase.numero} className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-mono text-xs text-muted-foreground">
              {String(fase.numero).padStart(2, "0")}
            </span>
            <span className="text-foreground/70">{fase.nome}</span>
            <span className="text-muted-foreground">— {porque}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
