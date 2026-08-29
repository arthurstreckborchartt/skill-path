import { createFileRoute } from "@tanstack/react-router";
import { Flame, Pencil, Sparkles, Trophy, Zap } from "lucide-react";
import {
  AnimatedNumber,
  Btn,
  Chip,
  PageHeader,
  Panel,
  ProgressBar,
  Reveal,
} from "@/components/pathly/ui";
import { skills, user } from "@/lib/mock";
import { levelFromXp, type StepView } from "@/lib/route-map";
import { useRouteProgressContext } from "@/lib/route-progress-context";

export const Route = createFileRoute("/app/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — Pathly" },
      {
        name: "description",
        content: "Seu perfil, nível, conquistas e o cenário que gerou a sua rota.",
      },
      { property: "og:title", content: "Perfil — Pathly" },
      { property: "og:description", content: "Nível, XP, conquistas e objetivo de renda." },
    ],
  }),
  component: ProfilePage,
});

/**
 * Cada conquista é uma condição real, nunca um `earned: true` fixo. "Primeiro freela" e
 * "Portfólio pronto" apontam para a etapa que representa esse marco na rota (s5 e s3) — mesma
 * lógica que já usávamos para "milestone" em route-map.ts, só reaproveitada aqui.
 */
function buildBadges(views: StepView[], stats: { doneCount: number; streak: number; projects: unknown[]; }, incomeNow: number) {
  const stepDone = (id: string) => views.find((s) => s.id === id)?.state === "concluído";
  return [
    { label: "Primeira etapa", icon: Trophy, earned: stats.doneCount >= 1 },
    { label: "10 dias seguidos", icon: Flame, earned: stats.streak >= 10 },
    { label: "Primeiro projeto", icon: Sparkles, earned: stats.projects.length >= 1 },
    { label: "Primeiro freela", icon: Zap, earned: stepDone("s5") },
    { label: "Portfólio pronto", icon: Trophy, earned: stepDone("s3") },
    { label: "Meta de renda", icon: Sparkles, earned: incomeNow >= user.goalIncome },
  ];
}

function ProfilePage() {
  const { views, stats } = useRouteProgressContext();
  const level = levelFromXp(stats.totalXp);
  const badges = buildBadges(views, stats, stats.incomeNow);
  const topSkills = [...skills].sort((a, b) => b.level - a.level).slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Perfil"
        subtitle="O cenário que gerou a sua rota"
        action={
          <Btn variant="soft" size="sm">
            <Pencil className="size-4" /> Editar
          </Btn>
        }
      />

      <Reveal>
        <Panel>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="grid size-16 shrink-0 place-items-center rounded-3xl bg-signal font-display text-xl font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
              {user.initials}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-xl font-semibold">{user.name}</h2>
              <p className="truncate text-sm text-muted-foreground">
                {user.role} → {user.target}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Chip tone="primary">
                  <Sparkles className="size-3" /> Nível {level.level} · {level.name}
                </Chip>
                <Chip tone="xp">
                  <Flame className="size-3" /> {stats.streak} dia{stats.streak === 1 ? "" : "s"}
                </Chip>
              </div>
            </div>
          </div>
          <ProgressBar value={level.progressPct} tone="xp" className="mt-6" />
          <p className="mt-2 text-xs text-muted-foreground">
            {level.maxed ? `${level.xp} XP · nível máximo` : `${level.xp} / ${level.xpToNext} XP`}
          </p>
        </Panel>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { k: "Renda atual", v: stats.incomeNow, prefix: "R$ " },
          { k: "Meta de renda", v: user.goalIncome, prefix: "R$ " },
          { k: "XP acumulado", v: stats.totalXp, prefix: "" },
        ].map((m, i) => (
          <Reveal key={m.k} delay={i * 70}>
            <Panel className="p-5">
              <p className="text-xs text-muted-foreground">{m.k}</p>
              <p className="mt-1 font-display text-2xl font-semibold">
                <AnimatedNumber value={m.v} prefix={m.prefix} />
              </p>
            </Panel>
          </Reveal>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal delay={100}>
          <Panel className="h-full">
            <h3 className="font-display text-lg font-semibold">Seu cenário</h3>
            <dl className="mt-4 divide-y divide-border text-sm">
              {[
                ["Escolaridade", "Cursando superior"],
                ["Experiência", "Iniciante"],
                ["Horas por semana", `${user.hoursPerWeek}h`],
                ["Objetivo", user.goalType],
                ["Prazo", `${user.deadlineMonths} meses`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="min-w-0 truncate text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </Reveal>

        <Reveal delay={160}>
          <Panel className="h-full">
            <h3 className="font-display text-lg font-semibold">Principais habilidades</h3>
            <div className="mt-4 space-y-4">
              {topSkills.map((s, i) => (
                <div key={s.name}>
                  <div className="mb-2 flex justify-between text-xs">
                    <span className="text-muted-foreground">{s.name}</span>
                    <span className="font-medium">{s.level}%</span>
                  </div>
                  <ProgressBar value={s.level} delay={250 + i * 90} />
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>
      </div>

      <Reveal delay={200}>
        <Panel>
          <h3 className="font-display text-lg font-semibold">Conquistas</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {badges.filter((b) => b.earned).length} de {badges.length} desbloqueadas ·{" "}
            {stats.doneCount} etapas concluídas
          </p>
          <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {badges.map((b) => (
              <div
                key={b.label}
                className="tap flex flex-col items-center gap-2 rounded-2xl bg-surface-2/40 p-3 text-center transition-colors hover:bg-surface-2"
              >
                <span
                  className={
                    b.earned
                      ? "grid size-10 place-items-center rounded-2xl bg-primary/15 text-primary"
                      : "grid size-10 place-items-center rounded-2xl bg-muted text-muted-foreground/60"
                  }
                >
                  <b.icon className="size-4.5" />
                </span>
                <span className="text-[11px] leading-tight text-muted-foreground">{b.label}</span>
              </div>
            ))}
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}
