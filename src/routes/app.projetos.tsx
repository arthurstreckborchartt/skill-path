import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Clock, FolderKanban } from "lucide-react";
import { Chip, PageHeader, Panel, ProgressBar, Reveal } from "@/components/pathly/ui";
import { useRouteProgressContext } from "@/lib/route-progress-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/projetos")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Projetos — Pathly" },
      {
        name: "description",
        content: "Projetos em andamento e sugeridos para construir um portfólio que prova.",
      },
      { property: "og:title", content: "Projetos — Pathly" },
      {
        property: "og:description",
        content: "Cada projeto da sua rota existe para provar uma habilidade.",
      },
    ],
  }),
  component: ProjectsPage,
});

const tabs = ["Todos", "Em andamento", "Concluído", "Sugerido"];

/**
 * Os projetos saem das etapas da rota que a pessoa gerou — antes esta tela lia uma lista fixa de
 * `lib/mock`, então quem escolheu Dados ou Marketing via projetos de back-end como se fossem seus.
 */
function ProjectsPage() {
  const [tab, setTab] = useState("Todos");
  const { views } = useRouteProgressContext();

  const projects = useMemo(
    () =>
      views.flatMap((step) =>
        step.projects.map((title) => ({
          id: `${step.id}-${title}`,
          title,
          stepTitle: step.title,
          summary: step.goal,
          stack: step.skills,
          eta: step.eta,
          impact: step.impactLevel,
          status:
            step.state === "concluído"
              ? "Concluído"
              : step.state === "atual"
                ? "Em andamento"
                : "Sugerido",
          progress: step.state === "concluído" ? 100 : step.state === "atual" ? step.checkPct : 0,
        })),
      ),
    [views],
  );

  const list = projects.filter((p) => tab === "Todos" || p.status === tab);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projetos"
        subtitle="Portfólio construído junto com a rota"
        action={
          <Chip tone="primary">
            <FolderKanban className="size-3.5" /> {projects.length} projetos
          </Chip>
        }
      />

      <Reveal>
        <div className="-mx-4 no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "tap shrink-0 rounded-full px-4 py-2 text-sm transition-colors",
                tab === t
                  ? "bg-primary/15 text-primary"
                  : "bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-2">
        {list.map((p, i) => (
          <Reveal key={p.id} delay={i * 70}>
            <Panel tilt className="flex h-full flex-col">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <h3 className="min-w-0 font-display text-lg font-semibold">{p.title}</h3>
                <Chip
                  tone={
                    p.status === "Concluído"
                      ? "primary"
                      : p.status === "Em andamento"
                        ? "accent"
                        : "muted"
                  }
                >
                  {p.status}
                </Chip>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{p.summary}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {p.stack.map((s) => (
                  <Chip key={s}>{s}</Chip>
                ))}
              </div>

              <div className="mt-5">
                <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5" /> {p.eta} · impacto {p.impact}
                  </span>
                  <span>{p.progress}%</span>
                </div>
                <ProgressBar value={p.progress} delay={220 + i * 90} />
              </div>

              <div className="mt-auto pt-5">
                <Link
                  to="/app/rota"
                  className="tap inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  Etapa: {p.stepTitle} <ArrowUpRight className="size-4" />
                </Link>
              </div>
            </Panel>
          </Reveal>
        ))}
      </div>

      {list.length === 0 && (
        <Panel className="text-center">
          <p className="text-sm text-muted-foreground">
            {tab === "Todos"
              ? "Sua rota ainda não tem projetos."
              : `Nenhum projeto ${tab.toLowerCase()} por enquanto.`}
          </p>
        </Panel>
      )}
    </div>
  );
}
