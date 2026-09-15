import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Check, Clock, Lock, Zap } from "lucide-react";
import { Chip, PageHeader, Panel, ProgressBar, Reveal } from "@/components/pathly/ui";
import { useRouteProgressContext } from "@/lib/route-progress-context";

export const Route = createFileRoute("/app/habilidades")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Aprender — Pathly" },
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
  component: LearnPage,
});

function LearnPage() {
  const { views, profile } = useRouteProgressContext();
  const learned = views.filter((step) => step.state === "concluído").flatMap((step) => step.skills);
  const known = new Set([...profile.declaredSkills.map((skill) => skill.name), ...learned]);
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
          {[{ label: "Dominadas", value: known.size }, { label: "Em curso", value: modules.filter((s) => s.state === "atual").length }, { label: "Por aprender", value: Math.max(0, totalSkills - known.size) }].map((item) => (
            <div key={item.label} className="border-r border-border px-3 py-5 last:border-r-0 sm:px-6">
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
            Cada módulo prepara o próximo. Abra a etapa para acessar materiais e checklist.
          </p>
          {modules.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">
              Todo o caminho foi concluído. Seus aprendizados agora aparecem no perfil profissional.
            </p>
          ) : (
            <div className="mt-5 divide-y divide-border">
              {modules.map((step, index) => (
                <Link key={step.id} to="/app/rota" className="group flex items-center gap-4 py-5">
                  <span className={step.state === "atual" ? "grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground" : "grid size-10 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground"}>
                    {step.state === "atual" ? <BookOpen className="size-4" /> : step.state === "bloqueado" ? <Lock className="size-4" /> : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-display font-semibold">{step.title}</p>{step.state === "atual" && <Chip tone="primary">Agora</Chip>}</div>
                    <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Clock className="size-3" /> {step.eta}</span><span>{step.skills.join(" · ")}</span></p>
                    {step.state === "atual" && <ProgressBar value={step.checkPct} className="mt-3 max-w-xl" />}
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </Reveal>

      {known.size > 0 && <Reveal delay={180}><section><h2 className="font-display text-lg font-bold">Habilidades conquistadas</h2><div className="mt-4 flex flex-wrap gap-2">{Array.from(known).map((name) => <Chip key={name} tone="primary"><Check className="size-3" /> {name}</Chip>)}</div></section></Reveal>}
    </div>
  );
}
