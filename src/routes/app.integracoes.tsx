import { createFileRoute } from "@tanstack/react-router";
import { Braces, Github, Plug, ShieldCheck, Video } from "lucide-react";
import { Chip, PageHeader, Panel, Reveal } from "@/components/pathly/ui";

export const Route = createFileRoute("/app/integracoes")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Integrações — Pathly" },
      { name: "description", content: "Conecte as ferramentas usadas para construir e operar seus projetos." },
      { property: "og:title", content: "Integrações — Pathly" },
      { property: "og:description", content: "Ferramentas de código, conteúdo e operação conectadas ao seu projeto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IntegrationsPage,
});

const groups = [
  { icon: Github, title: "Código e repositórios", body: "GitHub e GitLab podem receber tarefas, ler contexto e acompanhar mudanças com autorização da sua conta.", status: "Disponível primeiro" },
  { icon: Braces, title: "Assistentes de desenvolvimento", body: "Codex, Lovable, Gemini e outros entram quando oferecem uma conexão MCP ou API oficial compatível.", status: "Por compatibilidade" },
  { icon: Video, title: "Imagem, vídeo e conteúdo", body: "Runway, Higgsfield e serviços similares exigem integração oficial e permissões próprias antes de executar.", status: "Em expansão" },
];

function IntegrationsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Integrações" subtitle="Conecte as ferramentas que o Pathly poderá coordenar para você" action={<Chip tone="muted"><ShieldCheck className="size-3" /> Sempre com aprovação</Chip>} />
      <Reveal>
        <Panel className="border-foreground/20 bg-foreground text-background">
          <Plug className="size-5" />
          <h2 className="mt-4 max-w-2xl font-display text-2xl font-semibold">Uma conexão só aparece como pronta depois de ser validada.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-background/70">O Pathly nunca simula uma integração e nunca executa uma ação externa sem mostrar o que será enviado e pedir sua confirmação.</p>
        </Panel>
      </Reveal>
      <div className="grid gap-4 lg:grid-cols-3">
        {groups.map((group, index) => (
          <Reveal key={group.title} delay={index * 70}>
            <Panel className="h-full">
              <span className="grid size-10 place-items-center rounded-md border border-border bg-surface-2"><group.icon className="size-5" /></span>
              <h2 className="mt-5 text-base font-semibold">{group.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{group.body}</p>
              <Chip className="mt-5" tone="neutral">{group.status}</Chip>
            </Panel>
          </Reveal>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">As conexões por usuário serão liberadas gradualmente após validação dos endpoints oficiais e das permissões de cada fornecedor.</p>
    </div>
  );
}