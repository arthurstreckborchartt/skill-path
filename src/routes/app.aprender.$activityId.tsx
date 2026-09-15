import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { LearningSession } from "@/components/pathly/learning-session";
import { useLearningSystem } from "@/lib/learning-context";

export const Route = createFileRoute("/app/aprender/$activityId")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Sessão de aprendizado — Pathly" },
      { name: "description", content: "Aprenda, pratique e comprove uma habilidade da sua rota." },
      { property: "og:title", content: "Sessão de aprendizado — Pathly" },
      { property: "og:description", content: "Uma sessão curta com objetivo, teste, prática e feedback." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const { activityId } = Route.useParams();
  const { activities } = useLearningSystem();
  const activity = activities.find((item) => item.id === activityId);
  if (!activity) return <div className="py-16 text-center"><h1 className="font-display text-2xl font-bold">Sessão indisponível</h1><p className="mt-2 text-sm text-muted-foreground">A rota pode ter sido atualizada.</p><Link to="/app/habilidades" className="mt-5 inline-flex items-center gap-2 text-sm text-primary"><ArrowLeft className="size-4" /> Voltar para Aprender</Link></div>;
  return <LearningSession activity={activity} />;
}