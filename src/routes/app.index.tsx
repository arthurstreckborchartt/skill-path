import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  Clock,
  Compass,
  Flame,
  Lock,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { Chip, Panel, ProgressBar, Reveal } from "@/components/pathly/ui";
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
    <div className="space-y-8">
      <Reveal>
        <div className="flex items-start justify-between gap-4 border-b border-border pb-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Sua evolução hoje</p>
            <h1 className="mt-2 font-display text-3xl leading-tight font-bold text-balance sm:text-4xl">
              {profile.firstName ? `Bom dia, ${profile.firstName}.` : "Bom dia."}
            </h1>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <Chip tone="primary">Nível {level.level}</Chip>
            <Chip tone="xp"><Zap className="size-3.5" /> {stats.totalXp} XP</Chip>
            {stats.streak > 0 && (
              <Chip tone="xp">
                <Flame className="size-3.5" /> {stats.streak} dia{stats.streak === 1 ? "" : "s"}
              </Chip>
            )}
          </div>
        </div>
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
          <Panel className="overflow-hidden border-primary/25 bg-foreground text-background shadow-[var(--shadow-lift)]">
            <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="min-w-0">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-primary uppercase">
                  <Compass className="size-3" /> Seu próximo passo
                </span>
                <p className="mt-4 text-sm text-background/60">{nextAction.stepTitle}</p>
                <p className="mt-1 font-display text-3xl font-bold text-balance sm:text-4xl">
                  {nextAction.label}
                </p>
                <p className="mt-4 flex items-center gap-4 text-sm text-background/70">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" /> {nextAction.timeLabel}
                  </span>
                  <span className="flex items-center gap-1 text-xp">
                    <Zap className="size-3.5" /> +{nextAction.xp} XP
                  </span>
                </p>
                {insights[0] && <p className="mt-5 max-w-2xl text-sm leading-relaxed text-background/55">{insights[0]}</p>}
              </div>
              {/* Largura total no celular: a ação principal da tela precisa ser fácil de acertar
                  com o polegar, não um botão estreito no canto. */}
              <Link
                to="/app/rota"
                className="tap inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] hover:bg-primary/90 sm:w-auto"
              >
                Começar agora <ArrowRight className="size-4" />
              </Link>
            </div>
          </Panel>
        </Reveal>
      )}

      <Reveal delay={180}>
        <section className="border-y border-border py-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Caminho ativo</p>
              <h2 className="mt-2 font-display text-2xl font-bold">{profile.target}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{stats.doneCount} de {stats.total} etapas · cerca de {stats.monthsLeft} meses restantes</p>
            </div>
            <span className="font-display text-3xl font-bold text-primary">{stats.percent}%</span>
          </div>
          <div className="relative mt-8">
            <div className="absolute top-4 right-0 left-0 h-px bg-border" />
            <div className="absolute top-4 left-0 h-px bg-primary transition-all duration-700" style={{ width: `${stats.percent}%` }} />
            <ol className="relative flex justify-between gap-2">
              {views.map((step) => (
                <li key={step.id} className="flex max-w-24 flex-1 flex-col items-center text-center">
                  <span className={cn("grid size-8 place-items-center rounded-lg border bg-background text-xs font-semibold", step.state === "concluído" && "border-primary bg-primary text-primary-foreground", step.state === "atual" && "border-primary text-primary ring-4 ring-primary/10", (step.state === "futuro" || step.state === "bloqueado") && "border-border text-muted-foreground")}>{step.state === "concluído" ? <Check className="size-4" /> : step.state === "bloqueado" ? <Lock className="size-3.5" /> : step.order}</span>
                  <span className="mt-2 hidden text-[10px] leading-tight text-muted-foreground sm:line-clamp-2">{step.title}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </Reveal>

      <Reveal delay={220}>
        <div className="grid grid-cols-2 border-y border-border sm:grid-cols-4">
          {[{ k: "Etapas", v: `${stats.doneCount}/${stats.total}` }, { k: "Projetos", v: stats.projects.length }, { k: "Habilidades", v: stats.skills.length }, { k: "Ritmo semanal", v: `${profile.hoursPerWeek}h` }].map((m) => (
            <div key={m.k} className="border-border px-4 py-5 odd:border-r sm:border-r sm:last:border-r-0">
              <p className="font-display text-2xl font-bold">{m.v}</p><p className="mt-1 text-xs text-muted-foreground">{m.k}</p>
            </div>
          ))}
        </div>
      </Reveal>

      {weekPlan.length > 0 && (
        <Reveal delay={250}>
          <div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
            <Panel>
              <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Desafio da semana</p><h3 className="mt-1 font-display text-xl font-bold">Complete 3 movimentos da rota</h3></div><Chip tone="xp"><Zap className="size-3" /> +500 XP</Chip></div>
              <div className="mt-6 grid grid-cols-5 gap-2">
                {weekPlan.map((item) => { const Icon = weekStateIcon[item.state]; return <div key={`${item.day}-${item.label}`} className={cn("border-t-2 pt-3", item.state === "hoje" ? "border-primary" : "border-border")}><span className="text-[10px] font-semibold text-muted-foreground">{item.day}</span><Chip tone={weekStateTone[item.state]} className="mt-2 !p-0 size-7 justify-center"><Icon className="size-3.5" /></Chip><p className="mt-2 line-clamp-2 text-[10px] leading-tight text-muted-foreground">{item.label}</p></div>; })}
              </div>
            </Panel>
            <Panel>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Nível {level.level}</p><h3 className="mt-1 font-display text-xl font-bold">{level.name}</h3><ProgressBar value={level.progressPct} tone="xp" className="mt-5" /><p className="mt-2 text-xs text-muted-foreground">{level.maxed ? "Nível máximo" : `${level.xpToNext - level.xp} XP até o próximo nível`}</p>
            </Panel>
          </div>
        </Reveal>
      )}

      <Reveal delay={300}>
          <Panel>
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
  );
}
