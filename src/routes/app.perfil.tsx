import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Flame, Gem, Settings, Sparkles, Trophy, User, Zap } from "lucide-react";
import {
  AnimatedNumber,
  Btn,
  Chip,
  PageHeader,
  Panel,
  ProgressBar,
  Reveal,
} from "@/components/pathly/ui";
import { levelFromXp, type StepView } from "@/lib/route-map";
import { useRouteProgressContext } from "@/lib/route-progress-context";
import { useLearningSystem } from "@/lib/learning-context";
import type { SkillLevel } from "@/lib/onboarding";

export const Route = createFileRoute("/app/perfil")({
  staticData: { sitemap: false },
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
function buildBadges(
  views: StepView[],
  stats: { doneCount: number; streak: number; projects: unknown[] },
  incomeNow: number,
  goalIncome: number,
) {
  // Etapas de "primeiro freela" e "portfólio" ficam em posições diferentes conforme a área
  // (rota gerada tem outros ids) — aqui a condição vira "existe alguma etapa concluída com
  // esse tipo de projeto/marco", não mais um id fixo do template de tecnologia.
  const hasMilestone = (keyword: string) =>
    views.some((s) => s.state === "concluído" && s.milestone.toLowerCase().includes(keyword));
  return [
    { label: "Primeira etapa", icon: Trophy, earned: stats.doneCount >= 1 },
    { label: "10 dias seguidos", icon: Flame, earned: stats.streak >= 10 },
    { label: "Primeiro projeto", icon: Sparkles, earned: stats.projects.length >= 1 },
    { label: "Primeira renda extra", icon: Zap, earned: hasMilestone("renda extra") },
    { label: "Portfólio pronto", icon: Trophy, earned: hasMilestone("portfólio") },
    // Conquista por chegar ao fim da rota. Não afirma que a renda subiu: concluir etapa não paga
    // ninguém — `incomeNow` é o marco da última etapa concluída.
    {
      label: "Última etapa",
      icon: Sparkles,
      earned: goalIncome > 0 && incomeNow >= goalIncome,
    },
  ];
}

const SKILL_LEVEL_PCT: Record<SkillLevel, number> = {
  iniciante: 35,
  intermediário: 65,
  avançado: 90,
};

function ProfilePage() {
  const { views, stats, profile } = useRouteProgressContext();
  const learning = useLearningSystem();
  const totalXp = stats.totalXp + learning.xpTotal;
  const level = levelFromXp(totalXp);
  const badges = buildBadges(views, stats, stats.incomeNow, profile.goalIncome);

  // Rota personalizada: mistura o que a pessoa já sabia (onboarding) com o que já dominou
  // completando etapas. Rota demo: mantém os níveis fixos do mock, que existem só pra ilustrar
  // a tela antes de qualquer onboarding real.
  const topSkills = [
        ...learning.mastery.map((skill) => ({ name: skill.skillName, level: skill.mastery })),
        ...profile.declaredSkills
          .filter((s) => !learning.mastery.some((skill) => skill.skillName === s.name))
          .map((s) => ({ name: s.name, level: SKILL_LEVEL_PCT[s.level] })),
      ].slice(0, 4);
  const initials = profile.firstName ? profile.firstName.slice(0, 2).toUpperCase() : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Perfil"
        subtitle="O cenário que gerou a sua rota"
        action={
          <Link to="/app/configuracoes"><Btn variant="soft" size="sm"><Settings className="size-4" /> Ajustes</Btn></Link>
        }
      />

      <Reveal>
        <Panel>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="grid size-16 shrink-0 place-items-center rounded-3xl bg-signal font-display text-xl font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
              {initials ?? <User className="size-6" />}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-xl font-semibold">
                {profile.firstName || profile.role}
              </h2>
              <p className="truncate text-sm text-muted-foreground">
                 {profile.role} → {profile.target}
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
          // A renda informada no onboarding, não `stats.incomeNow` (que é o marco da última
          // etapa concluída e não representa o que a pessoa ganha hoje).
          { k: "Renda informada", v: profile.currentIncome, prefix: "R$ " },
          { k: "Meta de renda", v: profile.goalIncome, prefix: "R$ " },
          { k: "XP acumulado", v: totalXp, prefix: "" },
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
                ...(profile.situationLabel ? [["Situação", profile.situationLabel]] : []),
                ["Experiência", profile.experienceLabel ?? "Iniciante"],
                ["Horas por semana", `${profile.hoursPerWeek}h`],
                ["Objetivo", profile.goalType],
                ["Prazo", `${profile.deadlineMonths} meses`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="min-w-0 truncate text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>

            {/* O texto livre não cabe na lista de pares: fica embaixo, com as aspas, para a
                pessoa reconhecer o que ela mesma escreveu. */}
            {profile.goalText && (
              <div className="mt-4 rounded-2xl bg-surface-2/40 p-4">
                <p className="text-xs text-muted-foreground">Nas suas palavras</p>
                <p className="mt-1.5 text-sm text-balance">“{profile.goalText}”</p>
              </div>
            )}
          </Panel>
        </Reveal>

        <Reveal delay={160}>
          <Panel className="h-full">
            <h3 className="font-display text-lg font-semibold">Principais habilidades</h3>
            {topSkills.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Suas habilidades aparecem aqui conforme você avança na rota.
              </p>
            ) : (
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
            )}
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

      <Reveal delay={240}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/app/planos" className="group flex items-center justify-between rounded-lg border border-border bg-surface p-5 shadow-[var(--shadow-soft)]"><span className="flex items-center gap-3"><Gem className="size-5 text-primary" /><span><span className="block font-display font-semibold">Plano Pathly</span><span className="mt-1 block text-xs text-muted-foreground">Veja seu plano e acesso à rota</span></span></span><ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" /></Link>
          <Link to="/app/configuracoes" className="group flex items-center justify-between rounded-lg border border-border bg-surface p-5 shadow-[var(--shadow-soft)]"><span className="flex items-center gap-3"><Settings className="size-5 text-primary" /><span><span className="block font-display font-semibold">Configurações</span><span className="mt-1 block text-xs text-muted-foreground">Conta, aparência e nova rota</span></span></span><ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" /></Link>
        </div>
      </Reveal>
    </div>
  );
}
