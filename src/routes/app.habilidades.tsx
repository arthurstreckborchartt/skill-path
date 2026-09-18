import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Brain, Check, Clock, Lock, Zap } from "lucide-react";
import { Chip, PageHeader, Panel, ProgressBar, Reveal } from "@/components/pathly/ui";
import { useRouteProgressContext } from "@/lib/route-progress-context";
import { useLearningSystem } from "@/lib/learning-context";
import { masteryLabel, skillKey } from "@/lib/learning-system";

export const Route = createFileRoute("/app/habilidades")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Aprender — Pathly" },
      {
        name: "description",
        content: "Seu mapa de habilidades: o que já domina, o que falta e o que o mercado pede.",
      },
      { property: "og:title", content: "Aprender — Pathly" },
      {
        property: "og:description",
        content: "Aprenda as habilidades da sua rota na ordem certa para avançar.",
      },
    ],
  }),
  component: LearnPage,
});

function LearnPage() {
  const { views, profile } = useRouteProgressContext();
  const learning = useLearningSystem();
  const mastered = learning.mastery.filter((skill) => skill.mastery >= 85);
  const known = new Set([
    ...profile.declaredSkills.map((skill) => skill.name),
    ...mastered.map((skill) => skill.skillName),
  ]);
  const modules = views.filter((step) => step.state !== "concluído");
  const totalSkills = new Set(views.flatMap((step) => step.skills)).size;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aprender"
        subtitle="Conteúdo na ordem certa para avançar no seu caminho"
        action={
          <Chip tone="primary">
            <Zap className="size-3.5" /> {known.size}/{totalSkills} habilidades
          </Chip>
        }
      />

      <Reveal>
        <div className="grid grid-cols-3 border-y border-border">
          {[
            { label: "Dominadas", value: mastered.length },
            {
              label: "Em prática",
              value: learning.mastery.filter((s) => s.mastery > 0 && s.mastery < 85).length,
            },
            { label: "Revisões", value: learning.reviewsDue.length },
          ].map((item) => (
            <div
              key={item.label}
              className="border-r border-border px-3 py-5 last:border-r-0 sm:px-6"
            >
              <p className="font-display text-2xl font-bold">{item.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={120}>
        <Panel>
          <h3 className="font-display text-xl font-bold">Sua sequência de aprendizado</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada módulo prepara o próximo. Aprenda, teste e aplique antes de avançar.
          </p>
          {modules.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">
              Todo o caminho foi concluído. Seus aprendizados agora aparecem no perfil profissional.
            </p>
          ) : (
            <div className="mt-5 divide-y divide-border">
              {modules.map((step, index) => (
                <div key={step.id} className="flex items-center gap-4 py-5">
                  <span
                    className={
                      step.state === "atual"
                        ? "grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"
                        : "grid size-10 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground"
                    }
                  >
                    {step.state === "atual" ? (
                      <BookOpen className="size-4" />
                    ) : step.state === "bloqueado" ? (
                      <Lock className="size-4" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display font-semibold">{step.title}</p>
                      {step.state === "atual" && <Chip tone="primary">Agora</Chip>}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" /> {step.eta}
                      </span>
                      <span>{step.skills.join(" · ")}</span>
                    </p>
                    {step.state === "atual" && (
                      <ProgressBar
                        value={Math.round(
                          step.skills.reduce(
                            (total, skill) =>
                              total +
                              (learning.mastery.find((item) => item.skillKey === skillKey(skill))
                                ?.mastery ?? 0),
                            0,
                          ) / Math.max(1, step.skills.length),
                        )}
                        className="mt-3 max-w-xl"
                      />
                    )}
                  </div>
                  {learning.activities.find(
                    (activity) =>
                      activity.stepId === step.id &&
                      learning.progressFor(activity.id)?.status !== "completed",
                  ) ? (
                    <Link
                      to="/app/aprender/$activityId"
                      params={{
                        activityId:
                          learning.activities.find(
                            (activity) =>
                              activity.stepId === step.id &&
                              learning.progressFor(activity.id)?.status !== "completed",
                          )?.id ?? `${step.id}:${step.checklist[0]?.id ?? "c1"}`,
                      }}
                      className="tap grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"
                      aria-label={`Continuar ${step.title}`}
                    >
                      <ArrowRight className="size-4" />
                    </Link>
                  ) : (
                    <Check className="size-4 shrink-0 text-primary" />
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </Reveal>

      {learning.mastery.length > 0 && (
        <Reveal delay={180}>
          <Panel>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold">Domínio por habilidade</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Baseado em tentativas, prática e retenção — não em cliques.
                </p>
              </div>
              {learning.reviewsDue.length > 0 && (
                <Chip tone="accent">
                  <Brain className="size-3" /> {learning.reviewsDue.length}
                </Chip>
              )}
            </div>
            <div className="mt-5 space-y-5">
              {learning.mastery
                .sort((a, b) => b.mastery - a.mastery)
                .map((skill) => (
                  <div key={skill.skillKey}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span>{skill.skillName}</span>
                      <span className="text-xs text-muted-foreground">
                        {masteryLabel(skill.mastery)} · {skill.mastery}%
                      </span>
                    </div>
                    <ProgressBar value={skill.mastery} delay={0} />
                  </div>
                ))}
            </div>
          </Panel>
        </Reveal>
      )}
    </div>
  );
}
