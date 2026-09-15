import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { OnboardingProfile } from "@/lib/onboarding";
import type { RouteProgress } from "@/lib/route-map";

function profileFromJson(value: Json | null | undefined): OnboardingProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as unknown as OnboardingProfile;
}

function progressFromJson(value: Json | null | undefined): RouteProgress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as {
    done?: unknown;
    checks?: unknown;
    lastActiveDate?: unknown;
    streak?: unknown;
  };
  if (!Array.isArray(candidate.done) || !Array.isArray(candidate.checks)) return null;
  return {
    done: candidate.done.filter((id): id is string => typeof id === "string"),
    checks: candidate.checks.filter((id): id is string => typeof id === "string"),
    lastActiveDate: typeof candidate.lastActiveDate === "string" ? candidate.lastActiveDate : null,
    streak: typeof candidate.streak === "number" ? candidate.streak : 0,
  };
}

export async function loadCloudProfile(userId: string): Promise<OnboardingProfile | null> {
  try {
    const { data, error } = await supabase
      .from("pathly_profiles")
      .select("onboarding")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return profileFromJson(data?.onboarding);
  } catch (error) {
    console.warn("[Pathly] Cloud profile unavailable; using local fallback.", error);
    return null;
  }
}

export async function saveCloudProfile(
  userId: string,
  profile: OnboardingProfile,
): Promise<boolean> {
  try {
    const { error } = await supabase.from("pathly_profiles").upsert(
      {
        user_id: userId,
        onboarding: profile as unknown as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn("[Pathly] Cloud profile save failed; local copy is safe.", error);
    return false;
  }
}

export async function loadCloudRouteProgress(
  userId: string,
  routeSignature: string,
): Promise<RouteProgress | null> {
  try {
    const { data, error } = await supabase
      .from("pathly_route_progress")
      .select("progress")
      .eq("user_id", userId)
      .eq("route_signature", routeSignature)
      .maybeSingle();
    if (error) throw error;
    return progressFromJson(data?.progress);
  } catch (error) {
    console.warn("[Pathly] Cloud route progress unavailable; using local fallback.", error);
    return null;
  }
}

export async function saveCloudRouteProgress(
  userId: string,
  routeSignature: string,
  progress: RouteProgress,
): Promise<boolean> {
  try {
    const { error } = await supabase.from("pathly_route_progress").upsert(
      {
        user_id: userId,
        route_signature: routeSignature,
        progress: progress as unknown as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn("[Pathly] Cloud route progress save failed; local copy is safe.", error);
    return false;
  }
}
