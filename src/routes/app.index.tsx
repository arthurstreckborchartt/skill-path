import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Flame, Sparkles, TrendingUp, Zap } from "lucide-react";
import {
  AnimatedNumber,
  Btn,
  Chip,
  Panel,
  ProgressBar,
  Reveal,
  Ring,
  XpBurst,
} from "@/components/pathly/ui";
import { activity, incomeCurve, steps, user } from "@/lib/mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Início — Pathly" },
      {
        name: "description",
        content: "Seu progresso, próxima etapa e renda projetada em um só lugar.",
      },
      { property: "og:title", content: "Seu painel na Pathly" },
      { property: "og:description", content: "Veja onde você está na rota e o próximo passo." },
    ],
  }),
  component: Dashboard,
});

function IncomeCurve() {
  const max = Math.max(...incomeCurve);
  const min = Math.min(...incomeCurve);
  const points = incomeCurve
    .map((v, i) => {
      const x = (i / (incomeCurve.length - 1)) * 100;
      const y = 100 - ((v - min) / (max - min)) * 88 - 6;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-32 w-full">
      <defs>
        <linearGradient id="curveStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="oklch(0.72 0.13 245)" />
          <stop offset="100%" stopColor="oklch(0.86 0.16 172)" />
        </linearGradient>
        <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.86 0.16 172 / 0.28)" />
          <stop offset="100%" stopColor="oklch(0.86 0.16 172 / 0)" />
        </linearGradient>
      </defs>
      <polygon points={`0,100 ${points} 100,100`} fill="url(#curveFill)" />
      <polyline
        points={points}
        fill="none"
        stroke="url(#curveStroke)"
        strokeWidth="1.6"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className="[stroke-dasharray:400] [stroke-dashoffset:0] animate-[fade-in_1.2s_ease-out_both]"
      />
    </svg>
  );
}

function Dashboard() {
  const currentStep = steps.find((s) => s.status === "em andamento") ?? steps[0]!;
  const [checks, setChecks] = useState(currentStep.checklist);
  const [burst, setBurst] = useState(false);

  const done = checks.filter((c) => c.done).length;
  const stepProgress = Math.round((done / checks.length) * 100);
  const routeProgress = Math.round(
    (steps.filter((s) => s.status === "concluído").length / steps.length) * 100,
  );

  function toggle(id: string) {
    setChecks((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (!c.done) {
          setBurst(true);
          setTimeout(() => setBurst(false), 1100);
        }
        return { ...c, done: !c.done };
      }),
    );
  }

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Olá, {user.firstName}</p>
            <h1 className="mt-1 font-display text-2xl leading-tight font-semibold text-balance sm:text-3xl">
              Você está a {steps.length - steps.filter((s) => s.status === "concluído").length}{" "}
              etapas da meta
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Chip tone="xp">
              <Flame className="size-3.5" /> {user.streak} dias
            </Chip>
            <Chip tone="primary" className="hidden sm:inline-flex">
              <Sparkles className="size-3.5" /> Nível {user.level}
            </Chip>
          </div>
        </div>
      </Reveal>

      {/* Hero stats */}
      <Reveal delay={80}>
        <Panel className="overflow-hidden">
          <div className="grid gap-8 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <div className="flex items-center gap-6">
              <Ring value={routeProgress} label={`${routeProgress}%`} sub="da rota" />
              <div>
                <p className="text-xs text-muted-foreground">Renda projetada ao concluir</p>
                <p className="font-display text-3xl font-semibold text-primary">
                  <AnimatedNumber value={user.goalIncome} prefix="R$ " />
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="size-3.5 text-primary" />
                  hoje: R$ {user.currentIncome.toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
            <div className="min-w-0">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Curva de renda da rota</span>
                <span>{user.deadlineMonths} meses</span>
              </div>
              <IncomeCurve />
            </div>
          </div>
        </Panel>
      </Reveal>

      {/* Etapa atual */}
      <Reveal delay={140}>
        <Panel className="relative">
          <XpBurst amount={60} show={burst} />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
            <div className="min-w-0">
              <Chip tone="primary">Etapa {currentStep.order} · em andamento</Chip>
              <h2 className="mt-3 font-display text-xl font-semibold">{currentStep.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{currentStep.goal}</p>
            </div>
            <span className="shrink-0 font-display text-2xl font-semibold">{stepProgress}%</span>
          </div>

          <ProgressBar value={stepProgress} className="mt-5" />

          <ul className="mt-5 space-y-2">
            {checks.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => toggle(c.id)}
                  className="tap group flex w-full items-center gap-3 rounded-xl bg-surface-2/40 px-4 py-3 text-left text-sm transition-colors hover:bg-surface-2"
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full transition-all",
                      c.done
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-transparent group-hover:bg-muted/70",
                    )}
                  >
                    <Check className="size-3" />
                  </span>
                  <span className={cn("min-w-0 truncate", c.done && "text-muted-foreground line-through")}>
                    {c.label}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">+20 XP</span>
                </button>
              </li>
            ))}
          </ul>

          <Link to="/app/rota" className="mt-5 inline-block">
            <Btn variant="soft" size="sm">
              Ver rota completa <ArrowRight className="size-4" />
            </Btn>
          </Link>
        </Panel>
      </Reveal>

      {/* XP + atividade */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Reveal delay={180}>
          <Panel className="h-full">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Nível {user.level}</p>
                <p className="font-display text-lg font-semibold">{user.levelName}</p>
              </div>
              <Chip tone="xp">
                <Zap className="size-3.5" /> {user.xp} XP
              </Chip>
            </div>
            <ProgressBar
              value={(user.xp / user.xpToNext) * 100}
              tone="xp"
              className="mt-5"
              delay={320}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              faltam {user.xpToNext - user.xp} XP para o nível {user.level + 1}
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2 text-center">
              {[
                { k: "Sequência", v: `${user.streak}d` },
                { k: "Horas/semana", v: `${user.hoursPerWeek}h` },
                { k: "Etapas", v: `${steps.filter((s) => s.status === "concluído").length}/${steps.length}` },
              ].map((m) => (
                <div key={m.k} className="rounded-2xl bg-surface-2/50 py-3">
                  <p className="font-display text-base font-semibold">{m.v}</p>
                  <p className="text-[11px] text-muted-foreground">{m.k}</p>
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>

        <Reveal delay={230}>
          <Panel className="h-full">
            <h3 className="font-display text-lg font-semibold">Atividade recente</h3>
            <ul className="mt-4 divide-y divide-border">
              {activity.map((a) => (
                <li key={a.label} className="flex items-center gap-3 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                    <Check className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{a.label}</p>
                    <p className="text-xs text-muted-foreground">{a.when}</p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-xp">+{a.xp}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}
