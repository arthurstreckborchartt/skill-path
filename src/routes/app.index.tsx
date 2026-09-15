import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  Clock,
  Compass,
  Flame,
  Lightbulb,
  Lock,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { AnimatedNumber, Chip, Panel, ProgressBar, Reveal, Ring } from "@/components/pathly/ui";
import {
  getInsights,
  getNextAction,
  getWeekPlan,
  levelFromXp,
  type WeekPlanState,
} from "@/lib/route-map";
import { useRouteProgressContext } from "@/lib/route-progress-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Início — Pathly" },
      {
        name: "description",
        content: "Seu progresso, a próxima etapa e o plano da semana em um só lugar.",
      },
      { property: "og:title", content: "Seu painel na Pathly" },
      { property: "og:description", content: "Veja onde você está na rota e o próximo passo." },
    ],
  }),
  component: Dashboard,
});

const weekStateIcon: Record<WeekPlanState, typeof Check> = {
  concluído: Check,
  hoje: Sparkles,
  próximo: Clock,
  bloqueado: Lock,
};

const weekStateTone: Record<WeekPlanState, "primary" | "accent" | "muted" | "neutral"> = {
  concluído: "primary",
  hoje: "accent",
  próximo: "neutral",
  bloqueado: "muted",
};

function Dashboard() {
  const { views, currentIndex, stats, profile } = useRouteProgressContext();
  const level = levelFromXp(stats.totalXp);
  const nextAction = getNextAction(views, currentIndex);
  const weekPlan = getWeekPlan(views);
  const insights = getInsights(views, stats, profile.hoursPerWeek);
  const completed = views.filter((s) => s.state === "concluído");
  const routeDone = stats.percent >= 100;

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">
              {profile.firstName ? `Olá, ${profile.firstName}` : "Olá!"}
            </p>
            <h1 className="mt-1 font-display text-2xl leading-tight font-semibold text-balance sm:text-3xl">
              {routeDone
                ? "Você concluiu sua rota"
                : `Você está a ${stats.total - stats.doneCount} etapas da meta`}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {stats.streak > 0 && (
              <Chip tone="xp">
                <Flame className="size-3.5" /> {stats.streak} dia{stats.streak === 1 ? "" : "s"}
              </Chip>
            )}
            <Chip tone="primary" className="hidden sm:inline-flex">
              <Sparkles className="size-3.5" /> Nível {level.level}
            </Chip>
          </div>
        </div>
      </Reveal>

      {/* Continue sua jornada */}
      <Reveal delay={80}>
        <Panel className="overflow-hidden">
          <div className="grid gap-8 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <div className="flex items-center gap-6">
              <Ring value={stats.percent} label={`${stats.percent}%`} sub="da rota" />
              <div>
                <p className="text-xs text-muted-foreground">{profile.target}</p>
                <p className="font-display text-3xl font-semibold text-primary">
                  <AnimatedNumber value={profile.goalIncome} prefix="R$ " />
                </p>
                {/* Renda informada por quem usa. Concluir etapa não muda renda de ninguém —
                    o número da etapa é marco da meta, e fica na tela da rota. */}
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="size-3.5 text-primary" />
                  sua renda hoje: R$ {profile.currentIncome.toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
            <div className="min-w-0">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Progresso da rota</span>
                <span>
                  {stats.doneCount}/{stats.total} etapas · {stats.monthsLeft} meses restantes
                </span>
              </div>
              <ProgressBar value={stats.percent} />
            </div>
          </div>
        </Panel>
      </Reveal>

      {routeDone || !nextAction ? (
        <Reveal delay={140}>
          <Panel className="text-center">
            <p className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">
              <Sparkles className="size-6" />
            </p>
            <h2 className="mt-4 font-display text-xl font-semibold">Rota concluída</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Você percorreu todas as etapas até {profile.target.toLowerCase()}. Suas habilidades e
              projetos ficam disponíveis para revisão a qualquer momento.
            </p>
          </Panel>
        </Reveal>
      ) : (
        <Reveal delay={140}>
          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
                  <Compass className="size-3" /> {nextAction.stepTitle}
                </span>
                <p className="mt-1.5 font-display text-xl font-semibold text-balance">
                  {nextAction.label}
                </p>
                <p className="mt-1.5 flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" /> {nextAction.timeLabel}
                  </span>
                  <span className="flex items-center gap-1 text-xp">
                    <Zap className="size-3.5" /> +{nextAction.xp} XP
                  </span>
                </p>
              </div>
              {/* Largura total no celular: a ação principal da tela precisa ser fácil de acertar
                  com o polegar, não um botão estreito no canto. */}
              <Link
                to="/app/rota"
                className="tap inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-signal px-5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110 sm:h-11 sm:w-auto"
              >
                Continuar <ArrowRight className="size-4" />
              </Link>
            </div>
          </Panel>
        </Reveal>
      )}

      {/* Plano da semana */}
      {weekPlan.length > 0 && (
        <Reveal delay={180}>
          <Panel>
            <h3 className="font-display text-lg font-semibold">Seu plano desta semana</h3>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {weekPlan.map((item) => {
                const Icon = weekStateIcon[item.state];
                return (
                  <div
                    key={`${item.day}-${item.label}`}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-2xl border p-3 text-center",
                      item.state === "hoje"
                        ? "border-primary/40 bg-primary/[0.06]"
                        : "border-border bg-surface-2/30",
                    )}
                  >
                    <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground">
                      {item.day}
                    </span>
                    <Chip tone={weekStateTone[item.state]} className="!p-0 size-7 justify-center">
                      <Icon className="size-3.5" />
                    </Chip>
                    <span className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </Panel>
        </Reveal>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <Reveal delay={220}>
          <Panel>
            <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Lightbulb className="size-4.5 text-accent" /> Insights
            </h3>
            <ul className="mt-4 space-y-2.5">
              {insights.map((text) => (
                <li key={text} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                  {text}
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>
      )}

      {/* Gamificação + atividade */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Reveal delay={260}>
          <Panel className="h-full">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Nível {level.level}</p>
                <p className="font-display text-lg font-semibold">{level.name}</p>
              </div>
              <Chip tone="xp">
                <Zap className="size-3.5" /> {level.xp} XP
              </Chip>
            </div>
            <ProgressBar value={level.progressPct} tone="xp" className="mt-5" delay={320} />
            <p className="mt-2 text-xs text-muted-foreground">
              {level.maxed
                ? "Nível máximo atingido"
                : `faltam ${level.xpToNext - level.xp} XP para o nível ${level.level + 1}`}
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2 text-center">
              {[
                { k: "Sequência", v: `${stats.streak}d` },
                { k: "Horas/semana", v: `${profile.hoursPerWeek}h` },
                { k: "Etapas", v: `${stats.doneCount}/${stats.total}` },
              ].map((m) => (
                <div key={m.k} className="rounded-2xl bg-surface-2/50 py-3">
                  <p className="font-display text-base font-semibold">{m.v}</p>
                  <p className="text-[11px] text-muted-foreground">{m.k}</p>
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>

        <Reveal delay={300}>
          <Panel className="h-full">
            <h3 className="font-display text-lg font-semibold">Atividade</h3>
            {completed.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Suas etapas concluídas aparecem aqui. Comece pela etapa atual na sua rota.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {completed.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 py-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                      <Check className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{s.title}</p>
                      <p className="text-xs text-muted-foreground">{s.milestone}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-xp">+{s.xp}</span>
                  </li>
                ))}
              </ul>
            )}
            {stats.projects.length > 0 && (
              <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Target className="size-3.5 text-accent" /> {stats.projects.length} projeto
                {stats.projects.length === 1 ? "" : "s"} entregue
                {stats.projects.length === 1 ? "" : "s"} até agora
              </p>
            )}
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}
