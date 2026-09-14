import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, MapPin, Target } from "lucide-react";
import { Btn, Chip, PageHeader, Panel, ProgressBar, Reveal } from "@/components/pathly/ui";
import { opportunities } from "@/lib/mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/oportunidades")({
  head: () => ({
    meta: [
      { title: "Oportunidades (prévia) — Pathly" },
      {
        name: "description",
        content: "Prévia de interface com dados de exemplo. Ainda não há vagas reais na Pathly.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Oportunidades (prévia) — Pathly" },
      {
        property: "og:description",
        content: "Prévia de interface com dados de exemplo.",
      },
    ],
  }),
  component: OpportunitiesPage,
});

const tabs = ["Todas", "CLT", "Estágio", "Freelancer"];

function OpportunitiesPage() {
  const [tab, setTab] = useState("Todas");
  const list = opportunities
    .filter((o) => tab === "Todas" || o.type === tab)
    .sort((a, b) => b.match - a.match);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Oportunidades (prévia)"
        subtitle="Tela de exemplo — ainda não existe busca de vagas na Pathly"
        action={
          <Chip tone="muted">
            <Target className="size-3.5" /> exemplo
          </Chip>
        }
      />

      {/* Sem link nos menus, mas a URL continua acessível: quem chegar aqui precisa saber
          na primeira linha que nada nesta tela é real. */}
      <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4">
        <p className="text-sm font-medium">Nada aqui é uma vaga real.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          As empresas, as descrições e os percentuais desta tela são inventados, para desenhar a
          interface. Não se candidate e não use isso para decidir nada. Quando houver vagas de
          verdade, elas virão de curadoria manual e esta tela volta para o menu.
        </p>
      </div>

      <Reveal>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
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

      <div className="space-y-3">
        {list.map((o, i) => (
          <Reveal key={o.id} delay={i * 60}>
            <Panel hover>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-lg font-semibold">{o.title}</h3>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{o.company}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Chip>
                      <MapPin className="size-3" /> {o.mode}
                    </Chip>
                    <Chip tone="accent">{o.type}</Chip>
                    <Chip tone="primary">{o.salary}</Chip>
                  </div>
                </div>
                <div className="w-20 shrink-0 text-right">
                  <p
                    className={cn(
                      "font-display text-2xl font-semibold",
                      o.match >= 75
                        ? "text-primary"
                        : o.match >= 50
                          ? "text-accent"
                          : "text-muted-foreground",
                    )}
                  >
                    {o.match}%
                  </p>
                  <p className="text-[11px] text-muted-foreground">compatível</p>
                </div>
              </div>

              <ProgressBar
                value={o.match}
                tone={o.match >= 75 ? "primary" : "accent"}
                className="mt-4"
                delay={200 + i * 80}
              />

              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <p className="min-w-0 truncate text-xs text-muted-foreground">
                  {o.missing.length === 0
                    ? "Você já atende aos requisitos principais"
                    : `Falta: ${o.missing.join(", ")}`}
                </p>
                <Btn variant={o.match >= 75 ? "primary" : "soft"} size="sm">
                  {o.match >= 75 ? "Candidatar-se" : "Ver requisitos"}
                  <ArrowUpRight className="size-4" />
                </Btn>
              </div>
            </Panel>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
