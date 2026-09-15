import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Calendar, Clock, Layers, Sparkles, Target, TrendingUp, Zap } from "lucide-react";
import { Chip, PageHeader, Panel, ProgressBar, Reveal } from "@/components/pathly/ui";
import { DetailSheet, RouteTrack, StepActions, StepDetail } from "@/components/pathly/route-map";
import type { StepView } from "@/lib/route-map";
import { useRouteProgressContext } from "@/lib/route-progress-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/rota")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Minha rota — Pathly" },
      {
        name: "description",
        content:
          "O mapa visual entre a sua renda atual e a sua meta: etapas, projetos, XP e impacto de cada habilidade.",
      },
      { property: "og:title", content: "Minha rota na Pathly" },
      {
        property: "og:description",
        content: "Etapas, projetos e habilidades na ordem dos pré-requisitos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoutePage,
});

type View = "geral" | "semana" | "proximas";

const views: { id: View; label: string }[] = [
  { id: "geral", label: "Visão geral" },
  { id: "semana", label: "Semana atual" },
  { id: "proximas", label: "Próximas etapas" },
];

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-4">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1.5 font-display text-lg font-semibold">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function RoutePage() {
  const {
    views: steps,
    stats,
    profile,
    celebrating,
    toggleCheck,
    completeStep,
    reopenStep,
  } = useRouteProgressContext();
  const [view, setView] = useState<View>("geral");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const current = stats.current;
  const selected: StepView | undefined =
    steps.find((s) => s.id === selectedId) ?? current ?? steps[0];

  const visible = useMemo(() => {
    if (view === "semana") return current ? [current] : steps.slice(0, 1);
    if (view === "proximas") return steps.filter((s) => s.state !== "concluído");
    return steps;
  }, [view, steps, current]);

  /**
   * O prazo escolhido no onboarding não entra na geração da rota — o ritmo sai só das horas por
   * semana. Em vez de deixar a resposta sem efeito nenhum, aqui ela vira a comparação honesta
   * entre o prazo que a pessoa quer e o que o ritmo dela realmente entrega.
   */
  const ritmo = useMemo(() => {
    const horasRestantes = steps
      .filter((s) => s.state !== "concluído")
      .reduce((total, s) => total + (s.hours * (100 - s.checkPct)) / 100, 0);
    const prazoMeses = profile.deadlineMonths;
    if (!prazoMeses || horasRestantes <= 0) return null;
    const cabe = stats.monthsLeft <= prazoMeses;
    const horasNecessarias = Math.ceil(horasRestantes / (prazoMeses * 4.3));
    return { cabe, prazoMeses, horasNecessarias };
  }, [steps, profile.deadlineMonths, stats.monthsLeft]);

  function select(id: string) {
    setSelectedId(id);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minha rota"
        subtitle={`${profile.firstName ? `${profile.firstName}, ` : ""}${stats.percent}% da rota concluída — de R$ ${profile.currentIncome.toLocaleString("pt-BR")} até R$ ${profile.goalIncome.toLocaleString("pt-BR")}`}
        action={
          <Chip tone="primary">
            <Sparkles className="size-3.5" /> {stats.doneCount}/{stats.total} etapas
          </Chip>
        }
      />

      {/* painel de progresso */}
      <Reveal>
        <Panel>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Meta atual</p>
              <p className="font-display text-2xl font-semibold">
                R$ {profile.currentIncome.toLocaleString("pt-BR")}{" "}
                <span className="text-muted-foreground">→</span>{" "}
                <span className="text-primary">
                  R$ {profile.goalIncome.toLocaleString("pt-BR")}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Marco alcançado: R$ {stats.incomeNow.toLocaleString("pt-BR")} — divisão da distância
                até a sua meta, não previsão de salário.
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-3xl font-semibold text-primary">{stats.percent}%</p>
              <p className="text-xs text-muted-foreground">da rota concluída</p>
            </div>
          </div>
          <ProgressBar value={stats.percent} className="mt-4" />

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat
              icon={<Calendar className="size-3" />}
              label="Tempo previsto"
              value={`${stats.monthsLeft} meses`}
              hint={`${profile.hoursPerWeek}h por semana`}
            />
            <Stat
              icon={<Clock className="size-3" />}
              label="Horas estudadas"
              value={`${stats.hours}h`}
            />
            <Stat
              icon={<Target className="size-3" />}
              label="Projetos concluídos"
              value={String(stats.projects.length)}
            />
            <Stat
              icon={<Layers className="size-3" />}
              label="Habilidades"
              value={String(stats.skills.length)}
            />
            <Stat
              icon={<Zap className="size-3" />}
              label="XP da rota"
              value={stats.totalXp.toLocaleString("pt-BR")}
            />
          </div>

          {ritmo && (
            <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
              {ritmo.cabe ? (
                <>
                  No seu ritmo de {profile.hoursPerWeek}h por semana, a rota cabe no prazo de{" "}
                  {ritmo.prazoMeses} meses que você definiu.
                </>
              ) : (
                <>
                  Você definiu {ritmo.prazoMeses} meses de prazo, mas a {profile.hoursPerWeek}h por
                  semana a rota leva cerca de {stats.monthsLeft}. Para caber no prazo seriam{" "}
                  {ritmo.horasNecessarias}h por semana — ou dá para manter o ritmo e mover o prazo.
                </>
              )}
            </p>
          )}
        </Panel>
      </Reveal>

      {/* etapa atual em destaque */}
      {current && (
        <Reveal delay={60}>
          <button
            onClick={() => select(current.id)}
            className="tap panel panel-hover w-full p-5 text-left"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
                  <Sparkles className="size-3" /> Você está aqui
                </span>
                <p className="mt-1.5 font-display text-lg font-semibold text-balance">
                  {current.title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {current.eta} · {current.checksDone}/{current.checksTotal} tarefas ·{" "}
                  {current.impactLevel} impacto
                </p>
              </div>
              <Chip tone="primary">
                <TrendingUp className="size-3" /> R$ {current.incomeAfter.toLocaleString("pt-BR")}
              </Chip>
            </div>
            <ProgressBar value={current.checkPct} className="mt-4" />
          </button>
        </Reveal>
      )}

      {/* seletor de visualização */}
      <div className="inline-flex gap-1 rounded-full border border-border bg-surface/60 p-1">
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={cn(
              "tap rounded-full px-3.5 py-2 text-xs font-medium transition-all duration-300 sm:text-sm",
              view === v.id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* mapa + detalhe */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
        <div>
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-border bg-surface/50 px-4 py-3">
            <div>
              <p className="text-[11px] text-muted-foreground">Hoje</p>
              <p className="font-display text-sm font-semibold">
                R$ {profile.currentIncome.toLocaleString("pt-BR")}/mês
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{profile.role}</span>
          </div>

          <RouteTrack steps={visible} selectedId={selected?.id ?? null} onSelect={select} />

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/[0.06] px-4 py-3">
            <div>
              <p className="text-[11px] text-muted-foreground">Objetivo</p>
              <p className="font-display text-sm font-semibold text-primary">
                R$ {profile.goalIncome.toLocaleString("pt-BR")}/mês
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{profile.target}</span>
          </div>
        </div>

        {/* detalhe fixo no desktop */}
        {selected && (
          <Panel className="hidden lg:sticky lg:top-6 lg:block">
            <StepDetail
              step={selected}
              allSteps={steps}
              onToggleCheck={(checkId) => toggleCheck(selected.id, checkId)}
              onComplete={() => completeStep(selected.id)}
              onReopen={() => reopenStep(selected.id)}
              justCompleted={celebrating?.id === selected.id}
            />
          </Panel>
        )}
      </div>

      {/* bottom sheet no mobile — ação principal fixa no rodapé, na altura do polegar */}
      {sheetOpen && selected && (
        <DetailSheet
          step={selected}
          onClose={() => setSheetOpen(false)}
          footer={
            <StepActions
              step={selected}
              prereqsDone={selected.prereqs.every((id) =>
                steps.some((s) => s.id === id && s.state === "concluído"),
              )}
              onComplete={() => completeStep(selected.id)}
              onReopen={() => reopenStep(selected.id)}
              full
            />
          }
        >
          <StepDetail
            step={selected}
            allSteps={steps}
            onToggleCheck={(checkId) => toggleCheck(selected.id, checkId)}
            onComplete={() => completeStep(selected.id)}
            onReopen={() => reopenStep(selected.id)}
            justCompleted={celebrating?.id === selected.id}
            hideActions
          />
        </DetailSheet>
      )}
    </div>
  );
}
