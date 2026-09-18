import type { StepView } from "@/lib/route-map";

export type LearningActivityType = "lesson" | "quiz" | "challenge" | "review" | "project";
export type LearningActivityStatus = "available" | "in_progress" | "completed";

export type LearningActivity = {
  id: string;
  stepId: string;
  stepOrder: number;
  title: string;
  objective: string;
  why: string;
  example: string;
  estimatedMinutes: number;
  difficulty: StepView["difficulty"];
  type: LearningActivityType;
  skills: string[];
  project: string | null;
  options: string[];
  correctOption: string;
};

export type ActivityProgress = {
  activityId: string;
  stepId: string;
  skillNames: string[];
  activityType: LearningActivityType;
  status: LearningActivityStatus;
  score: number | null;
  attempts: number;
  minutesSpent: number;
  confidence: number | null;
  completedAt: string | null;
  reviewDueAt: string | null;
  lastAnswerCorrect: boolean | null;
  updatedAt: string;
};

export type SkillMastery = {
  skillKey: string;
  skillName: string;
  mastery: number;
  evidenceCount: number;
  lastPracticedAt: string | null;
};

export type XpEvent = {
  eventKey: string;
  source: Exclude<LearningActivityType, "project"> | "project" | "mastery" | "consistency";
  amount: number;
  createdAt: string;
};

export type ProjectEvidence = {
  projectId: string;
  stepId: string;
  title: string;
  status: "not_started" | "in_progress" | "submitted" | "completed";
  progress: number;
  evidenceUrl: string | null;
  reflection: string | null;
  completedAt: string | null;
};

export function skillKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function minutesFor(step: StepView): number {
  const perUnit = Math.round((step.hours * 60) / Math.max(1, step.checklist.length));
  return Math.min(35, Math.max(12, perUnit));
}

/**
 * A rota existente continua sendo a fonte editorial. Cada item do checklist vira uma sessão
 * pequena e avaliável; ids e títulos da etapa não mudam, portanto a assinatura antiga permanece.
 */
export function activitiesFromRoute(steps: StepView[]): LearningActivity[] {
  return steps.flatMap((step) =>
    step.checklist.map((item, index) => {
      const otherGoals = steps
        .filter((candidate) => candidate.id !== step.id)
        .map((candidate) => candidate.goal)
        .slice(0, 3);
      const options = [step.goal, ...otherGoals].slice(0, 4);
      const isLast = index === step.checklist.length - 1;
      return {
        id: `${step.id}:${item.id}`,
        stepId: step.id,
        stepOrder: step.order,
        title: item.label,
        objective: `Ao final, você vai conseguir explicar e aplicar ${item.label.toLowerCase()} no contexto de ${step.title.toLowerCase()}.`,
        why: step.why,
        example: step.projects[0]
          ? `Você usará esse conhecimento em “${step.projects[0]}”, produzindo uma evidência concreta para o seu portfólio.`
          : `Esse conhecimento contribui diretamente para o marco “${step.milestone}”.`,
        estimatedMinutes: minutesFor(step),
        difficulty: step.difficulty,
        type: isLast ? "challenge" : index === 0 ? "lesson" : "quiz",
        skills: step.skills,
        project: step.projects[0] ?? null,
        options,
        correctOption: step.goal,
      };
    }),
  );
}

export function isReviewDue(progress: ActivityProgress, now = new Date()): boolean {
  return Boolean(
    progress.status === "completed" &&
    progress.reviewDueAt &&
    new Date(progress.reviewDueAt).getTime() <= now.getTime(),
  );
}

export function masteryLabel(
  value: number,
): "Por aprender" | "Em progresso" | "Praticando" | "Dominada" {
  if (value >= 85) return "Dominada";
  if (value >= 55) return "Praticando";
  if (value > 0) return "Em progresso";
  return "Por aprender";
}

export function xpForResult(type: LearningActivityType, score: number, isReview: boolean): number {
  if (isReview) return score >= 80 ? 55 : 20;
  const base = type === "challenge" ? 110 : type === "quiz" ? 70 : 45;
  return score >= 100 ? base + 20 : score >= 70 ? base : Math.max(15, Math.round(base * 0.35));
}

export function nextReviewDate(score: number, previousAttempts: number, from = new Date()): string {
  const days = score >= 90 ? (previousAttempts > 0 ? 14 : 7) : score >= 70 ? 3 : 1;
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

export function routeLearningPercent(
  activities: LearningActivity[],
  progress: ActivityProgress[],
): number {
  if (activities.length === 0) return 0;
  const done = activities.filter((activity) =>
    progress.some((item) => item.activityId === activity.id && item.status === "completed"),
  ).length;
  return Math.round((done / activities.length) * 100);
}
