import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  Clock,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { Btn, Chip, Panel, ProgressBar, XpBurst } from "@/components/pathly/ui";
import { useLearningSystem } from "@/lib/learning-context";
import type { LearningActivity } from "@/lib/learning-system";
import { useRouteProgressContext } from "@/lib/route-progress-context";
import { useLicao } from "@/lib/ia/usar-licao";
import { LicaoCarregando, LicaoConteudo, LicaoIndisponivel } from "@/components/pathly/licao";
import { cn } from "@/lib/utils";

const stages = ["Objetivo", "Aula", "Prática", "Checkpoint"];

export function LearningSession({ activity }: { activity: LearningActivity }) {
  const learning = useLearningSystem();
  const route = useRouteProgressContext();
  const existing = learning.progressFor(activity.id);
  const [stage, setStage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [confidence, setConfidence] = useState(existing?.confidence ?? 3);
  const [busy, setBusy] = useState(false);
  const [earned, setEarned] = useState(0);
  const startedAt = useRef(Date.now());
  const review = Boolean(
    existing?.reviewDueAt && new Date(existing.reviewDueAt).getTime() <= Date.now(),
  );
  const currentIndex = learning.activities.findIndex((item) => item.id === activity.id);
  const next = learning.activities[currentIndex + 1] ?? null;

  const stageProgress = ((stage + 1) / stages.length) * 100;

  /**
   * A aula desta tarefa, escrita por IA e guardada para todo mundo com a mesma tarefa.
   *
   * Substituiu três telas de template — "Conceito", "Exemplo" e "Teste" — que não ensinavam o
   * assunto: o texto era preenchimento de lacuna e as alternativas do teste eram os objetivos
   * das outras etapas, com a resposta certa visível no topo da própria tela.
   */
  const passo = route.views.find((item) => item.id === activity.stepId);
  const licao = useLicao({
    tarefa: activity.title,
    etapa: passo?.title ?? activity.title,
    objetivoEtapa: passo?.goal ?? activity.objective,
    habilidades: activity.skills,
    // A área vem do papel que a rota persegue, não de um valor fixo: ela entra na chave do cache
    // e é o que separa "Primeira planilha" de quem vai para dados e de quem vai para finanças.
    area: route.profile.target,
  });

  const canAdvance = stage !== 1 || licao.estado !== "carregando";

  const title = useMemo(
    () => (review ? `Revisão: ${activity.title}` : activity.title),
    [activity.title, review],
  );

  async function finish() {
    setBusy(true);
    const minutesSpent = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    const score = Math.max(70, 100 - mistakes * 15);
    const result = await learning.completeActivity({ activity, score, confidence, minutesSpent });
    setEarned(result.xp);
    const checkId = activity.id.slice(activity.stepId.length + 1);
    if (!existing || existing.status !== "completed") route.toggleCheck(activity.stepId, checkId);
    const stepActivities = learning.activities.filter((item) => item.stepId === activity.stepId);
    const completedIds = new Set([
      ...learning.progress
        .filter((item) => item.status === "completed")
        .map((item) => item.activityId),
      activity.id,
    ]);
    if (stepActivities.every((item) => completedIds.has(item.id)))
      route.completeStep(activity.stepId);
    setBusy(false);
    setStage(5);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/app/habilidades"
          className="tap inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Aprender
        </Link>
        <div className="flex items-center gap-2">
          {review && (
            <Chip tone="accent">
              <Brain className="size-3" /> Revisão
            </Chip>
          )}
          <Chip>
            <Clock className="size-3" /> {activity.estimatedMinutes} min
          </Chip>
        </div>
      </div>

      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          {activity.type === "challenge" ? "Desafio da etapa" : "Sessão guiada"}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-balance sm:text-4xl">{title}</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          {activity.skills.map((skill) => (
            <Chip key={skill} tone="primary">
              {skill}
            </Chip>
          ))}
        </div>
      </header>

      <div>
        <div className="mb-2 flex justify-between text-xs text-muted-foreground">
          <span>{stages[stage]}</span>
          <span>
            {stage + 1}/{stages.length}
          </span>
        </div>
        <ProgressBar value={stageProgress} delay={0} />
      </div>

      <Panel className="relative min-h-[360px] overflow-hidden">
        <XpBurst amount={earned} show={earned > 0} />
        {stage === 0 && (
          <section>
            <Target className="size-6 text-primary" />
            <h2 className="mt-5 font-display text-2xl font-bold">O que você vai conseguir fazer</h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {activity.objective}
            </p>
            <div className="mt-6 border-l-2 border-primary pl-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                Por que isso importa
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{activity.why}</p>
            </div>
          </section>
        )}
        {stage === 1 && (
          <section>
            {licao.estado === "carregando" && <LicaoCarregando />}
            {licao.estado === "indisponivel" && <LicaoIndisponivel motivo={licao.motivo} />}
            {licao.estado === "pronta" && (
              <LicaoConteudo licao={licao.licao} tarefa={activity.title} chave={licao.chave} />
            )}
          </section>
        )}
        {stage === 2 && (
          <section>
            <Zap className="size-6 text-xp" />
            <h2 className="mt-5 font-display text-2xl font-bold">Aplique agora</h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Sem consultar a resposta, descreva mentalmente três passos para aplicar{" "}
              {activity.title.toLowerCase()}. Depois, escolha o quanto você conseguiria repetir isso
              sozinho.
            </p>
            <div className="mt-7 grid grid-cols-5 gap-2" role="radiogroup" aria-label="Confiança">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  role="radio"
                  aria-checked={confidence === value}
                  onClick={() => setConfidence(value)}
                  className={cn(
                    "tap min-h-12 rounded-lg border text-sm font-semibold",
                    confidence === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>Preciso de ajuda</span>
              <span>Faço sozinho</span>
            </div>
          </section>
        )}
        {stage === 3 && (
          <section className="text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Check className="size-7" />
            </span>
            <h2 className="mt-5 font-display text-2xl font-bold">
              {earned > 0 ? "Evidência registrada" : "Sessão revisitada"}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {earned > 0
                ? `Você concluiu com ${Math.max(70, 100 - mistakes * 15)}% e registrou prática real. O domínio só chega a 100% após revisão e aplicação.`
                : "Seu progresso anterior foi preservado. Uma nova evidência será registrada quando a revisão estiver disponível."}
            </p>
            {earned > 0 && (
              <Chip tone="xp" className="mt-5">
                <Zap className="size-3" /> +{earned} XP por evidência
              </Chip>
            )}
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              {next ? (
                <Link
                  to="/app/aprender/$activityId"
                  params={{ activityId: next.id }}
                  className="tap inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground"
                >
                  Próxima sessão <ArrowRight className="size-4" />
                </Link>
              ) : (
                <Link
                  to="/app/rota"
                  className="tap inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground"
                >
                  Ver meu caminho <ArrowRight className="size-4" />
                </Link>
              )}
            </div>
          </section>
        )}
      </Panel>

      {stage < 3 && (
        <div className="flex justify-between gap-3">
          <Btn
            variant="ghost"
            disabled={stage === 0 || busy}
            onClick={() => setStage((value) => Math.max(0, value - 1))}
          >
            Voltar
          </Btn>
          {stage === 2 ? (
            <Btn disabled={busy} onClick={finish}>
              {busy ? "Salvando…" : "Concluir checkpoint"}
              <Check className="size-4" />
            </Btn>
          ) : (
            <Btn disabled={!canAdvance} onClick={() => setStage((value) => Math.min(3, value + 1))}>
              Continuar <ArrowRight className="size-4" />
            </Btn>
          )}
        </div>
      )}
    </div>
  );
}
