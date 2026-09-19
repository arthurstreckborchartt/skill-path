import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FolderKanban, Gem, Plug, Settings, User } from "lucide-react";
import { Btn, Chip, PageHeader, Panel, Reveal } from "@/components/pathly/ui";
import { useProjetos } from "@/lib/blueprint/usar-projetos";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/app/perfil")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Perfil — Pathly" },
      { name: "description", content: "Sua conta, projetos e plano na Pathly." },
      { property: "og:title", content: "Perfil — Pathly" },
      { property: "og:description", content: "Gerencie sua conta e seus projetos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { session } = useSession();
  const projects = useProjetos();
  const fullName = session?.user.user_metadata?.["full_name"];
  const name = typeof fullName === "string" ? fullName : "Sua conta";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const count = projects.estado === "pronta" ? projects.projetos.length : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Perfil"
        subtitle="Sua conta e seus espaços de criação"
        action={
          <Link to="/app/configuracoes">
            <Btn variant="soft" size="sm">
              <Settings className="size-4" /> Ajustes
            </Btn>
          </Link>
        }
      />
      <Reveal>
        <Panel>
          <div className="flex items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-md bg-foreground font-display text-lg font-semibold text-background">
              {initials || <User className="size-6" />}
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-xl font-semibold">{name}</h2>
              <p className="truncate text-sm text-muted-foreground">{session?.user.email}</p>
              <Chip className="mt-3" tone="neutral">
                {count} projeto{count === 1 ? "" : "s"}
              </Chip>
            </div>
          </div>
        </Panel>
      </Reveal>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            to: "/app/blueprints" as const,
            icon: FolderKanban,
            title: "Projetos",
            note: "Conversas, planos e decisões",
          },
          {
            to: "/app/integracoes" as const,
            icon: Plug,
            title: "Integrações",
            note: "Ferramentas conectadas à sua conta",
          },
          {
            to: "/app/planos" as const,
            icon: Gem,
            title: "Plano Pathly",
            note: "Acesso e assinatura",
          },
        ].map((item, index) => (
          <Reveal key={item.title} delay={index * 60}>
            <Link
              to={item.to}
              className="group flex items-center justify-between rounded-lg border border-border bg-surface p-5 shadow-[var(--shadow-soft)]"
            >
              <span className="flex items-center gap-3">
                <item.icon className="size-5" />
                <span>
                  <span className="block font-display font-semibold">{item.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{item.note}</span>
                </span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
