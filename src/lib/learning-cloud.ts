import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type {
  ActivityProgress,
  ProjectEvidence,
  SkillMastery,
  XpEvent,
} from "@/lib/learning-system";

type ActivityRow = Tables<"pathly_learning_activity_progress">;
type MasteryRow = Tables<"pathly_skill_mastery">;
type XpRow = Tables<"pathly_xp_events">;
type ProjectRow = Tables<"pathly_project_progress">;

export type LearningCloudSnapshot = {
  activities: ActivityProgress[];
  mastery: SkillMastery[];
  xpEvents: XpEvent[];
  projects: ProjectEvidence[];
};

function activityFromRow(row: ActivityRow): ActivityProgress {
  return {
    activityId: row.activity_id,
    stepId: row.step_id,
    skillNames: row.skill_names,
    activityType: row.activity_type as ActivityProgress["activityType"],
    status: row.status as ActivityProgress["status"],
    score: row.score,
    attempts: row.attempts,
    minutesSpent: row.minutes_spent,
    confidence: row.confidence,
    completedAt: row.completed_at,
    reviewDueAt: row.review_due_at,
    lastAnswerCorrect: row.last_answer_correct,
    updatedAt: row.updated_at,
  };
}

export async function loadLearningCloud(
  userId: string,
  routeSignature: string,
): Promise<LearningCloudSnapshot> {
  const [activities, mastery, xpEvents, projects] = await Promise.all([
    supabase
      .from("pathly_learning_activity_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("route_signature", routeSignature),
    supabase
      .from("pathly_skill_mastery")
      .select("*")
      .eq("user_id", userId)
      .eq("route_signature", routeSignature),
    supabase
      .from("pathly_xp_events")
      .select("*")
      .eq("user_id", userId)
      .eq("route_signature", routeSignature)
      .order("created_at", { ascending: false }),
    supabase
      .from("pathly_project_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("route_signature", routeSignature),
  ]);
  const error = activities.error ?? mastery.error ?? xpEvents.error ?? projects.error;
  if (error) throw error;
  return {
    activities: ((activities.data ?? []) as ActivityRow[]).map(activityFromRow),
    mastery: ((mastery.data ?? []) as MasteryRow[]).map((row) => ({
      skillKey: row.skill_key,
      skillName: row.skill_name,
      mastery: row.mastery,
      evidenceCount: row.evidence_count,
      lastPracticedAt: row.last_practiced_at,
    })),
    xpEvents: ((xpEvents.data ?? []) as XpRow[]).map((row) => ({
      eventKey: row.event_key,
      source: row.source as XpEvent["source"],
      amount: row.amount,
      createdAt: row.created_at,
    })),
    projects: ((projects.data ?? []) as ProjectRow[]).map((row) => ({
      projectId: row.project_id,
      stepId: row.step_id,
      title: row.title,
      status: row.status as ProjectEvidence["status"],
      progress: row.progress,
      evidenceUrl: row.evidence_url,
      reflection: row.reflection,
      completedAt: row.completed_at,
    })),
  };
}

export async function saveActivityCloud(
  userId: string,
  routeSignature: string,
  progress: ActivityProgress,
) {
  const { error } = await supabase.from("pathly_learning_activity_progress").upsert(
    {
      user_id: userId,
      route_signature: routeSignature,
      activity_id: progress.activityId,
      step_id: progress.stepId,
      skill_names: progress.skillNames,
      activity_type: progress.activityType,
      status: progress.status,
      score: progress.score,
      attempts: progress.attempts,
      minutes_spent: progress.minutesSpent,
      confidence: progress.confidence,
      completed_at: progress.completedAt,
      review_due_at: progress.reviewDueAt,
      last_answer_correct: progress.lastAnswerCorrect,
      updated_at: progress.updatedAt,
    },
    { onConflict: "user_id,route_signature,activity_id" },
  );
  if (error) throw error;
}

export async function saveMasteryCloud(
  userId: string,
  routeSignature: string,
  mastery: SkillMastery[],
) {
  if (mastery.length === 0) return;
  const { error } = await supabase.from("pathly_skill_mastery").upsert(
    mastery.map((item) => ({
      user_id: userId,
      route_signature: routeSignature,
      skill_key: item.skillKey,
      skill_name: item.skillName,
      mastery: item.mastery,
      evidence_count: item.evidenceCount,
      last_practiced_at: item.lastPracticedAt,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "user_id,route_signature,skill_key" },
  );
  if (error) throw error;
}

export async function saveXpEventCloud(
  userId: string,
  routeSignature: string,
  event: XpEvent,
): Promise<boolean> {
  const { error } = await supabase.from("pathly_xp_events").insert({
    user_id: userId,
    route_signature: routeSignature,
    event_key: event.eventKey,
    source: event.source,
    amount: event.amount,
    created_at: event.createdAt,
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

export async function saveProjectCloud(
  userId: string,
  routeSignature: string,
  project: ProjectEvidence,
) {
  const { error } = await supabase.from("pathly_project_progress").upsert(
    {
      user_id: userId,
      route_signature: routeSignature,
      project_id: project.projectId,
      step_id: project.stepId,
      title: project.title,
      status: project.status,
      progress: project.progress,
      evidence_url: project.evidenceUrl,
      reflection: project.reflection,
      completed_at: project.completedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,route_signature,project_id" },
  );
  if (error) throw error;
}
