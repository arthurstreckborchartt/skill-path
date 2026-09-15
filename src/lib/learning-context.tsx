import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSession } from "@/lib/auth";
import { loadLearningCloud, saveActivityCloud, saveMasteryCloud, saveProjectCloud, saveXpEventCloud } from "@/lib/learning-cloud";
import {
  activitiesFromRoute,
  isReviewDue,
  nextReviewDate,
  routeLearningPercent,
  skillKey,
  xpForResult,
  type ActivityProgress,
  type LearningActivity,
  type ProjectEvidence,
  type SkillMastery,
  type XpEvent,
} from "@/lib/learning-system";
import { useRouteProgressContext } from "@/lib/route-progress-context";

type LearningStatus = "loading" | "synced" | "local" | "error";

type CompleteInput = { activity: LearningActivity; score: number; confidence: number; minutesSpent: number };

type LearningValue = {
  activities: LearningActivity[];
  progress: ActivityProgress[];
  mastery: SkillMastery[];
  projects: ProjectEvidence[];
  xpEvents: XpEvent[];
  xpTotal: number;
  learningPercent: number;
  reviewsDue: ActivityProgress[];
  nextActivity: LearningActivity | null;
  status: LearningStatus;
  error: string | null;
  progressFor: (activityId: string) => ActivityProgress | undefined;
  completeActivity: (input: CompleteInput) => Promise<{ xp: number; review: boolean }>;
  saveProject: (project: ProjectEvidence) => Promise<void>;
};

const LearningContext = createContext<LearningValue | null>(null);

function storageKey(signature: string) {
  return `pathly.learning.v1:${signature}`;
}

function readLocal(signature: string) {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(storageKey(signature)) ?? "null") as {
      progress: ActivityProgress[];
      mastery: SkillMastery[];
      xpEvents: XpEvent[];
      projects: ProjectEvidence[];
    } | null;
  } catch {
    return null;
  }
}

export function LearningSystemProvider({ children }: { children: ReactNode }) {
  const route = useRouteProgressContext();
  const { session, loading: sessionLoading } = useSession();
  const activities = useMemo(() => activitiesFromRoute(route.views), [route.views]);
  const [progress, setProgress] = useState<ActivityProgress[]>([]);
  const [mastery, setMastery] = useState<SkillMastery[]>([]);
  const [xpEvents, setXpEvents] = useState<XpEvent[]>([]);
  const [projects, setProjects] = useState<ProjectEvidence[]>([]);
  const [status, setStatus] = useState<LearningStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!route.hydrated || sessionLoading) return;
    let active = true;
    const local = readLocal(route.signature);
    if (local) {
      setProgress(local.progress ?? []);
      setMastery(local.mastery ?? []);
      setXpEvents(local.xpEvents ?? []);
      setProjects(local.projects ?? []);
      setStatus("local");
    }
    if (!session?.user.id) {
      setStatus("local");
      return;
    }
    void loadLearningCloud(session.user.id, route.signature)
      .then((snapshot) => {
        if (!active) return;
        const localProgress = local?.progress ?? [];
        const progressById = new Map(snapshot.activities.map((item) => [item.activityId, item]));
        for (const item of localProgress) {
          const cloudItem = progressById.get(item.activityId);
          if (!cloudItem || new Date(item.updatedAt).getTime() > new Date(cloudItem.updatedAt).getTime()) {
            progressById.set(item.activityId, item);
            void saveActivityCloud(session.user.id, route.signature, item).catch(() => undefined);
          }
        }
        const mergedMastery = new Map(snapshot.mastery.map((item) => [item.skillKey, item]));
        for (const item of local?.mastery ?? []) {
          const cloudItem = mergedMastery.get(item.skillKey);
          if (!cloudItem || item.evidenceCount > cloudItem.evidenceCount) mergedMastery.set(item.skillKey, item);
        }
        const mergedXp = new Map(snapshot.xpEvents.map((item) => [item.eventKey, item]));
        for (const item of local?.xpEvents ?? []) {
          if (!mergedXp.has(item.eventKey)) {
            mergedXp.set(item.eventKey, item);
            void saveXpEventCloud(session.user.id, route.signature, item).catch(() => undefined);
          }
        }
        const mergedProjects = new Map(snapshot.projects.map((item) => [item.projectId, item]));
        for (const item of local?.projects ?? []) {
          if (!mergedProjects.has(item.projectId)) {
            mergedProjects.set(item.projectId, item);
            void saveProjectCloud(session.user.id, route.signature, item).catch(() => undefined);
          }
        }
        const masteryItems = [...mergedMastery.values()];
        if (masteryItems.length > snapshot.mastery.length) {
          void saveMasteryCloud(session.user.id, route.signature, masteryItems).catch(() => undefined);
        }
        setProgress([...progressById.values()]);
        setMastery(masteryItems);
        setXpEvents([...mergedXp.values()]);
        setProjects([...mergedProjects.values()]);
        setStatus("synced");
        setError(null);
      })
      .catch(() => {
        if (!active) return;
        setStatus(local ? "local" : "error");
        setError("Não foi possível sincronizar agora. Seu avanço continua salvo neste aparelho.");
      });
    return () => { active = false; };
  }, [route.hydrated, route.signature, session?.user.id, sessionLoading]);

  useEffect(() => {
    if (!route.hydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey(route.signature), JSON.stringify({ progress, mastery, xpEvents, projects }));
    } catch {
      setStatus("error");
      setError("O navegador não permitiu salvar o avanço localmente.");
    }
  }, [mastery, progress, projects, route.hydrated, route.signature, xpEvents]);

  const completeActivity = useCallback(async ({ activity, score, confidence, minutesSpent }: CompleteInput) => {
    const existing = progress.find((item) => item.activityId === activity.id);
    const review = existing ? isReviewDue(existing) : false;
    // Reabrir uma sessão concluída antes da revisão é permitido para consulta, mas não cria
    // evidência nova, domínio ou XP. Isso torna a recompensa totalmente idempotente.
    if (existing?.status === "completed" && !review) return { xp: 0, review: false };
    const now = new Date();
    const attempts = (existing?.attempts ?? 0) + 1;
    const passed = score >= 70;
    const next: ActivityProgress = {
      activityId: activity.id,
      stepId: activity.stepId,
      skillNames: activity.skills,
      activityType: activity.type,
      status: passed ? "completed" : "in_progress",
      score,
      attempts,
      minutesSpent: (existing?.minutesSpent ?? 0) + Math.max(1, minutesSpent),
      confidence,
      completedAt: passed ? now.toISOString() : (existing?.completedAt ?? null),
      reviewDueAt: passed ? nextReviewDate(score, review ? attempts : 0, now) : now.toISOString(),
      lastAnswerCorrect: passed,
      updatedAt: now.toISOString(),
    };
    setProgress((items) => [...items.filter((item) => item.activityId !== activity.id), next]);

    const masteryNext = activity.skills.map((name) => {
      const key = skillKey(name);
      const before = mastery.find((item) => item.skillKey === key);
      const gain = passed ? (review ? 22 : activity.type === "challenge" ? 24 : 14) : 4;
      return {
        skillKey: key,
        skillName: name,
        mastery: Math.min(review ? 100 : 80, (before?.mastery ?? 0) + gain),
        evidenceCount: (before?.evidenceCount ?? 0) + 1,
        lastPracticedAt: now.toISOString(),
      } satisfies SkillMastery;
    });
    setMastery((items) => {
      const keys = new Set(masteryNext.map((item) => item.skillKey));
      return [...items.filter((item) => !keys.has(item.skillKey)), ...masteryNext];
    });

    const xp = xpForResult(activity.type, score, review);
    const eventKey = review && existing?.reviewDueAt
      ? `review:${activity.id}:${existing.reviewDueAt.slice(0, 10)}`
      : `activity:${activity.id}:completed`;
    const event: XpEvent = { eventKey, source: review ? "review" : activity.type, amount: xp, createdAt: now.toISOString() };
    const duplicate = xpEvents.some((item) => item.eventKey === eventKey);
    if (!duplicate && passed) setXpEvents((items) => [event, ...items]);

    if (session?.user.id) {
      try {
        await Promise.all([
          saveActivityCloud(session.user.id, route.signature, next),
          saveMasteryCloud(session.user.id, route.signature, masteryNext),
          ...(!duplicate && passed ? [saveXpEventCloud(session.user.id, route.signature, event)] : []),
        ]);
        setStatus("synced");
        setError(null);
      } catch {
        setStatus("local");
        setError("Avanço salvo neste aparelho. A sincronização será tentada novamente depois.");
      }
    }
    return { xp: !duplicate && passed ? xp : 0, review };
  }, [mastery, progress, route.signature, session?.user.id, xpEvents]);

  const saveProject = useCallback(async (project: ProjectEvidence) => {
    setProjects((items) => [...items.filter((item) => item.projectId !== project.projectId), project]);
    if (!session?.user.id) return;
    try {
      await saveProjectCloud(session.user.id, route.signature, project);
      setStatus("synced");
      setError(null);
    } catch {
      setStatus("local");
      setError("Projeto salvo neste aparelho. A sincronização será tentada novamente depois.");
    }
  }, [route.signature, session?.user.id]);

  const reviewsDue = useMemo(() => progress.filter((item) => isReviewDue(item)), [progress]);
  const nextActivity = useMemo(() => {
    const due = reviewsDue[0];
    if (due) return activities.find((item) => item.id === due.activityId) ?? null;
    return activities.find((activity) => {
      const step = route.views.find((item) => item.id === activity.stepId);
      return step?.state === "atual" && !progress.some((item) => item.activityId === activity.id && item.status === "completed");
    }) ?? null;
  }, [activities, progress, reviewsDue, route.views]);

  const value = useMemo<LearningValue>(() => ({
    activities,
    progress,
    mastery,
    projects,
    xpEvents,
    xpTotal: xpEvents.reduce((total, item) => total + item.amount, 0),
    learningPercent: routeLearningPercent(activities, progress),
    reviewsDue,
    nextActivity,
    status,
    error,
    progressFor: (activityId) => progress.find((item) => item.activityId === activityId),
    completeActivity,
    saveProject,
  }), [activities, completeActivity, error, mastery, progress, projects, reviewsDue, saveProject, status, xpEvents]);

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>;
}

export function useLearningSystem(): LearningValue {
  const value = useContext(LearningContext);
  if (!value) throw new Error("useLearningSystem precisa de <LearningSystemProvider>.");
  return value;
}