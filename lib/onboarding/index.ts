import { ONBOARDING_STEPS, type OnboardingStepId } from "../../config/onboarding.config";
import type { supabase } from "../supabaseClient";
import type { OnboardingStateRow } from "./types";

type SupabaseClientLike = typeof supabase;

const DEFAULT_STEP: OnboardingStepId = "identity";

export function nextStep(step: OnboardingStepId): OnboardingStepId {
  const idx = ONBOARDING_STEPS.findIndex((s) => s.id === step);
  if (idx < 0 || idx === ONBOARDING_STEPS.length - 1) return "complete";
  return ONBOARDING_STEPS[idx + 1].id;
}

export async function getOrCreateOnboardingState(client: SupabaseClientLike, userId: string) {
  const existing = await client
    .from("user_onboarding_state")
    .select("user_id,current_step,completed_steps,is_completed,terms_accepted,marketing_opt_in,tour_opt_in")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing.error && existing.data) {
    return existing.data as OnboardingStateRow;
  }

  if (existing.error) {
    const message = existing.error.message.toLowerCase();
    if (message.includes("relation") || message.includes("does not exist")) {
      return {
        user_id: userId,
        current_step: DEFAULT_STEP,
        completed_steps: [],
        is_completed: false,
        terms_accepted: false,
        marketing_opt_in: false,
        tour_opt_in: false,
      };
    }
  }

  const { data, error } = await client
    .from("user_onboarding_state")
    .insert({
      user_id: userId,
      current_step: DEFAULT_STEP,
      completed_steps: [],
      is_completed: false,
      terms_accepted: false,
      marketing_opt_in: false,
      tour_opt_in: false,
      updated_at: new Date().toISOString(),
    })
    .select("user_id,current_step,completed_steps,is_completed,terms_accepted,marketing_opt_in,tour_opt_in")
    .single();

  if (error || !data) {
    if (error?.message?.toLowerCase().includes("does not exist")) {
      return {
        user_id: userId,
        current_step: DEFAULT_STEP,
        completed_steps: [],
        is_completed: false,
        terms_accepted: false,
        marketing_opt_in: false,
        tour_opt_in: false,
      };
    }
    throw new Error(error?.message || "Could not initialize onboarding state");
  }

  return data as OnboardingStateRow;
}

export async function saveOnboardingState(
  client: SupabaseClientLike,
  userId: string,
  patch: Partial<OnboardingStateRow>,
) {
  const { data, error } = await client
    .from("user_onboarding_state")
    .upsert(
      {
        user_id: userId,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("user_id,current_step,completed_steps,is_completed,terms_accepted,marketing_opt_in,tour_opt_in")
    .single();

  if (error || !data) throw new Error(error?.message || "Could not save onboarding state");
  return data as OnboardingStateRow;
}

export function markStepComplete(state: OnboardingStateRow, step: OnboardingStepId): OnboardingStepId[] {
  const set = new Set<OnboardingStepId>(state.completed_steps || []);
  set.add(step);
  return Array.from(set);
}

export function shouldGateToOnboarding(state: OnboardingStateRow | null) {
  if (!state) return true;
  return !state.is_completed;
}
