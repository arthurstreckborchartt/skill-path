import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { Chip, PageHeader, Panel, ProgressBar, Reveal } from "@/components/pathly/ui";
import { skills } from "@/lib/mock";
import { useRouteProgressContext } from "@/lib/route-progress-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/habilidades")({
  head: () => ({
    meta: [
      { title: "Habilidades — Pathly" },
      {
        name: "description",
        content: "Seu mapa de habilidades: o que já domina, o que falta e o que o mercado pede.",
      },
      { property: "og:title", content: "Mapa de habilidades — Pathly" },
      {
        property: "og:description",
        content: "Nível atual de cada habilidade e sua demanda no mercado.",
      },
    ],
  }),
  component: SkillsPage,
});

const filters = ["Todas", "Linguagem", "Framework", "Dados", "Infra", "Humana"];

function SkillsPage() {
  const [filter, setFilter] = useState("Todas");
  const list = skills.filter((s) => filter === "Todas" || s.category === filter);
  const avg = Math.round(skills.reduce((a, s) => a + s.level, 0) / skills.length);

  const { views } = useRouteProgressContext();
  const knownSkills = new Set(
    views.filter((s) => s.state === "concluído").flatMap((s) => s.skills),
  );
  const upcoming = views
    .filter((s) => s.state === "atual" || s.state === "futuro")
    .flatMap((s) => s.skills.map((skillName) => ({ skillName, step: s })))
    .filter(({ skillName }) => !knownSkills.has(skillName))
    .filter((item, i, arr) => arr.findIndex((o) => o.skillName === item.skillName) === i)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Habilidades"
        subtitle="O que você já domina e o que a sua rota vai destravar"
        action={
          <Chip tone="primary">
            <Zap className="size-3.5" /> média {avg}%
          </Chip>
        }
      />

      <Reveal>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "tap shrink-0 rounded-full px-4 py-2 text-sm transition-colors",
                filter === f
                  ? "bg-primary/15 text-primary"
                  : "bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </Reveal>

      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((s, i) => (
          <Reveal key={s.name} delay={i * 60}>
            <Panel hover className="p-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.category}</p>
                </div>
                <span className="shrink-0 font-display text-lg font-semibold">{s.level}%</span>
              </div>
              <ProgressBar
                value={s.level}
                tone={s.level > 60 ? "primary" : s.level > 25 ? "accent" : "xp"}
                className="mt-4"
                delay={200 + i * 80}
              />
              <p className="mt-3 text-xs text-muted-foreground">Demanda: {s.demand}</p>
            </Panel>
          </Reveal>
        ))}
      </div>

      <Reveal delay={120}>
        <Panel>
          <h3 className="font-display text-lg font-semibold">Sugeridas pela sua rota</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Habilidades que a sua etapa atual e a próxima vão destravar
          </p>
          {upcoming.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">
              Você já domina todas as habilidades das próximas etapas.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {upcoming.map(({ skillName, step }) => (
                <div
                  key={skillName}
                  className="flex items-center gap-4 rounded-2xl bg-surface-2/40 px-4 py-3"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary">
                    <Zap className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{skillName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Etapa "{step.title}" · {step.demandPct}% de demanda
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </Reveal>
    </div>
  );
}
