import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, ChevronDown, Lock, Sparkles, Target, Zap } from "lucide-react";
import { Chip, PageHeader, Panel, ProgressBar, Reveal } from "@/components/pathly/ui";
import { steps, user, type Step } from "@/lib/mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/rota")({
  head: () => ({
    meta: [
      { title: "Minha rota — Pathly" },
      {
        name: "description",
        content: "Todas as etapas entre a sua renda atual e a sua meta, com prazo e impacto.",
      },
      { property: "og:title", content: "Minha rota na Pathly" },
      {
        property: "og:description",
        content: "Etapas, projetos e habilidades ordenados pelo impacto na sua renda.",
      },
    ],
  }),
  component: RoutePage,
});

const difficultyTone = {
  fácil: "primary" as const,
  médio: "accent" as const,
  difícil: "xp" as const,
};

function StepCard({ step, open, onToggle }: { step: Step; open: boolean; onToggle: () => void }) {
  const done = step.checklist.filter((c) => c.done).length;
  const progress = Math.round((done / step.checklist.length) * 100);
  const locked = step.status === "bloqueado";

  return (
    <Panel className={cn("p-0 overflow-hidden", locked && "opacity-75")}>
      <button
        onClick={onToggle}
        className="tap grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 p-5 text-left"
      >
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-2xl font-display text-sm font-semibold",
            step.status === "concluído"
              ? "bg-primary text-primary-foreground"
              : step.status === "em andamento"
                ? "bg-primary/15 text-primary"
                : "bg-surface-2 text-muted-foreground",
          )}
        >
          {step.status === "concluído" ? (
            <Check className="size-4" />
          ) : locked ? (
            <Lock className="size-3.5" />
          ) : (
            step.order
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{step.title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {step.eta} · {step.difficulty} · R$ {step.incomeAfter.toLocaleString("pt-BR")}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-5 border-t border-border px-5 py-5">
            <p className="text-sm text-muted-foreground">{step.goal}</p>

            <div className="flex flex-wrap gap-2">
              <Chip tone={difficultyTone[step.difficulty]}>{step.difficulty}</Chip>
              <Chip>{step.eta}</Chip>
              <Chip tone="xp">
                <Zap className="size-3" /> {step.xp} XP
              </Chip>
            </div>

            <div className="rounded-2xl bg-surface-2/50 p-4">
              <p className="text-xs font-medium text-muted-foreground">Impacto esperado</p>
              <p className="mt-1 text-sm">{step.impact}</p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Habilidades adquiridas</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {step.skills.map((s) => (
                    <Chip key={s} tone="primary">
                      {s}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Projetos recomendados</p>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  {step.projects.map((p) => (
                    <li key={p} className="flex gap-2">
                      <Target className="mt-0.5 size-3.5 shrink-0 text-accent" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground">Recursos para estudar</p>
              <div className="mt-2 space-y-2">
                {step.resources.map((r) => (
                  <div
                    key={r.label}
                    className="flex items-center justify-between rounded-xl bg-surface-2/40 px-4 py-3 text-sm transition-colors hover:bg-surface-2"
                  >
                    <span className="min-w-0 truncate">{r.label}</span>
                    <span className="ml-3 shrink-0 text-xs text-muted-foreground">{r.type}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex justify-between text-xs">
                <span className="text-muted-foreground">Checklist</span>
                <span className="font-medium">
                  {done}/{step.checklist.length}
                </span>
              </div>
              <ProgressBar value={progress} delay={100} />
              <ul className="mt-3 space-y-1.5">
                {step.checklist.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 text-sm">
                    <span
                      className={cn(
                        "grid size-4.5 shrink-0 place-items-center rounded-full",
                        c.done ? "bg-primary text-primary-foreground" : "bg-muted",
                      )}
                    >
                      {c.done && <Check className="size-2.5" />}
                    </span>
                    <span className={cn(c.done && "text-muted-foreground line-through")}>
                      {c.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function RoutePage() {
  const [openId, setOpenId] = useState<string | null>("s2");
  const completed = steps.filter((s) => s.status === "concluído").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minha rota"
        subtitle={`De R$ ${user.currentIncome.toLocaleString("pt-BR")} até R$ ${user.goalIncome.toLocaleString("pt-BR")} em ${user.deadlineMonths} meses`}
        action={
          <Chip tone="primary">
            <Sparkles className="size-3.5" /> {completed}/{steps.length} etapas
          </Chip>
        }
      />

      <Reveal>
        <Panel>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Hoje</p>
              <p className="font-display text-xl font-semibold">
                R$ {user.currentIncome.toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Meta</p>
              <p className="font-display text-xl font-semibold text-primary">
                R$ {user.goalIncome.toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
          <ProgressBar value={(completed / steps.length) * 100} className="mt-4" />
        </Panel>
      </Reveal>

      <div className="space-y-3">
        {steps.map((step, i) => (
          <Reveal key={step.id} delay={i * 50}>
            <StepCard
              step={step}
              open={openId === step.id}
              onToggle={() => setOpenId(openId === step.id ? null : step.id)}
            />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
