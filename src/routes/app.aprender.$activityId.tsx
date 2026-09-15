import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Lock } from "lucide-react";
import { LearningSession } from "@/components/pathly/learning-session";
import { useLearningSystem } from "@/lib/learning-context";
import { useRouteProgressContext } from "@/lib/route-progress-context";
import { etapaBloqueadaPorPlano, usePlan } from "@/lib/plan";
import { Btn, Panel } from "@/components/pathly/ui";

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
  const { views } = useRouteProgressContext();
  const { isPro, conferindo } = usePlan();
  const activity = activities.find((item) => item.id === activityId);
  if (!activity) return <div className="py-16 text-center"><h1 className="font-display text-2xl font-bold">Sessão indisponível</h1><p className="mt-2 text-sm text-muted-foreground">A rota pode ter sido atualizada.</p><Link to="/app/habilidades" className="mt-5 inline-flex items-center gap-2 text-sm text-primary"><ArrowLeft className="size-4" /> Voltar para Aprender</Link></div>;
  const step = views.find((item) => item.id === activity.stepId);
  if (conferindo) return <div className="py-16 text-center text-sm text-muted-foreground">Verificando acesso…</div>;
  if (step && etapaBloqueadaPorPlano(step.order, isPro)) return <Panel className="mx-auto mt-10 max-w-xl text-center"><span className="mx-auto grid size-12 place-items-center rounded-xl bg-primary/10 text-primary"><Lock className="size-5" /></span><h1 className="mt-5 font-display text-2xl font-bold">Sessão disponível no Pro</h1><p className="mt-2 text-sm text-muted-foreground">As duas primeiras etapas ficam liberadas no Gratuito. O Pro libera todas as sessões e projetos da rota.</p><Link to="/app/planos"><Btn className="mt-6">Conhecer o Pathly Pro</Btn></Link></Panel>;
  return <LearningSession activity={activity} />;
}