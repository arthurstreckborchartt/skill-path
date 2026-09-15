import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Check, Clock, FolderKanban, LinkIcon } from "lucide-react";
import { Btn, Chip, PageHeader, Panel, ProgressBar, Reveal } from "@/components/pathly/ui";
import { useRouteProgressContext } from "@/lib/route-progress-context";
import { useLearningSystem } from "@/lib/learning-context";
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
  const learning = useLearningSystem();
  const [editing, setEditing] = useState<string | null>(null);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [reflection, setReflection] = useState("");

  const projects = useMemo(
    () =>
      views.flatMap((step) =>
        step.projects.map((title) => {
          const id = `${step.id}-${title}`;
          const saved = learning.projects.find((item) => item.projectId === id);
          return ({
          id,
          title,
          stepTitle: step.title,
          summary: step.goal,
          stack: step.skills,
          eta: step.eta,
          impact: step.impactLevel,
          status: saved?.status === "completed" ? "Concluído" : saved?.status === "in_progress" || saved?.status === "submitted" ? "Em andamento" :
            step.state === "concluído"
              ? "Concluído"
              : step.state === "atual"
                ? "Em andamento"
                : "Sugerido",
          progress: saved?.progress ?? (step.state === "concluído" ? 100 : step.state === "atual" ? step.checkPct : 0),
          evidenceUrl: saved?.evidenceUrl ?? null,
        });}),
      ),
    [learning.projects, views],
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

      <div className="divide-y divide-border border-y border-border">
        {list.map((p, i) => (
          <Reveal key={p.id} delay={i * 70}>
            <article className="grid gap-5 py-7 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
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

              </div>
              <div className="sm:w-48">
                <Link
                  to="/app/rota"
                  className="tap inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  Etapa: {p.stepTitle} <ArrowUpRight className="size-4" />
                </Link>
                {p.status !== "Sugerido" && <Btn variant="outline" size="sm" className="mt-3 w-full" onClick={() => { setEditing(p.id); setEvidenceUrl(p.evidenceUrl ?? ""); setReflection(""); }}><LinkIcon className="size-4" /> {p.status === "Concluído" ? "Ver evidência" : "Registrar entrega"}</Btn>}
              </div>
            </article>
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

      {editing && (() => {
        const project = projects.find((item) => item.id === editing);
        if (!project) return null;
        return <div className="fixed inset-0 z-50 grid place-items-end bg-background/70 p-0 backdrop-blur-sm sm:place-items-center sm:p-6"><Panel className="w-full max-w-xl rounded-b-none sm:rounded-lg"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Evidência prática</p><h2 className="mt-2 font-display text-xl font-bold">{project.title}</h2></div><Btn variant="ghost" size="sm" onClick={() => setEditing(null)}>Fechar</Btn></div><label className="mt-6 block text-sm font-medium">Link da entrega<input type="url" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="https://github.com/..." className="mt-2 h-12 w-full rounded-lg border border-input bg-background px-4 outline-none focus:ring-2 focus:ring-ring" /></label><label className="mt-4 block text-sm font-medium">O que você conseguiu fazer?<textarea value={reflection} onChange={(event) => setReflection(event.target.value)} rows={4} placeholder="Explique brevemente o que construiu e o que aprendeu." className="mt-2 w-full rounded-lg border border-input bg-background p-4 outline-none focus:ring-2 focus:ring-ring" /></label><Btn className="mt-5 w-full" disabled={!evidenceUrl.trim() || reflection.trim().length < 10} onClick={() => { void learning.saveProject({ projectId: project.id, stepId: views.find((step) => step.title === project.stepTitle)?.id ?? "", title: project.title, status: "completed", progress: 100, evidenceUrl: evidenceUrl.trim(), reflection: reflection.trim(), completedAt: new Date().toISOString() }); setEditing(null); }}><Check className="size-4" /> Registrar projeto concluído</Btn><p className="mt-3 text-xs text-muted-foreground">A entrega vira evidência do seu progresso. A Pathly não publica este link.</p></Panel></div>;
      })()}
    </div>
  );
}
