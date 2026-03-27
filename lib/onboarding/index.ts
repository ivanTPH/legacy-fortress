import { ONBOARDING_STEPS, type OnboardingStepId } from "../../config/onboarding.config";
import { hasColumn, hasTable } from "../schemaSafe";
import { isMissingRelationError } from "../supabaseErrors";
import type { supabase } from "../supabaseClient";
import type { OnboardingStateRow } from "./types";

type SupabaseClientLike = typeof supabase;

const DEFAULT_STEP: OnboardingStepId = "identity";
const FALLBACK_COMPLETE_STEP: OnboardingStepId = "complete";
const ONBOARDING_TABLE = "user_onboarding_state";
const TERMS_TABLE = "terms_acceptances";
export const CURRENT_TERMS_VERSION = "legacy-fortress-2026-03";

type OnboardingSchema = {
  exists: boolean;
  columns: {
    user_id: boolean;
    current_step: boolean;
    completed_steps: boolean;
    is_completed: boolean;
    terms_accepted: boolean;
    marketing_opt_in: boolean;
    tour_opt_in: boolean;
    updated_at: boolean;
  };
};

export function nextStep(step: OnboardingStepId): OnboardingStepId {
  const idx = ONBOARDING_STEPS.findIndex((s) => s.id === step);
  if (idx < 0 || idx === ONBOARDING_STEPS.length - 1) return "complete";
  return ONBOARDING_STEPS[idx + 1].id;
}

export async function getOrCreateOnboardingState(client: SupabaseClientLike, userId: string) {
  const schema = await getOnboardingSchema(client);
  if (!schema.exists || !schema.columns.user_id || !schema.columns.is_completed) {
    return fallbackOnboardingState(userId);
  }

  const selectColumns = buildOnboardingSelectColumns(schema);
  const existing = await client
    .from(ONBOARDING_TABLE)
    .select(selectColumns)
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing.error && existing.data) {
    return normalizeOnboardingState(existing.data as unknown as Record<string, unknown>, userId);
  }

  if (existing.error && isMissingRelationError(existing.error, ONBOARDING_TABLE)) {
    return fallbackOnboardingState(userId);
  }

  const insertPayload = buildOnboardingInsertPayload(schema, userId, {});
  const { data, error } = await client
    .from(ONBOARDING_TABLE)
    .insert(insertPayload)
    .select(selectColumns)
    .single();

  if (error || !data) {
    if (isMissingRelationError(error, ONBOARDING_TABLE)) {
      return fallbackOnboardingState(userId);
    }
    throw new Error(error?.message || "Could not initialize onboarding state");
  }

  return normalizeOnboardingState(data as unknown as Record<string, unknown>, userId);
}

export async function saveOnboardingState(
  client: SupabaseClientLike,
  userId: string,
  patch: Partial<OnboardingStateRow>,
) {
  const schema = await getOnboardingSchema(client);
  if (!schema.exists || !schema.columns.user_id || !schema.columns.is_completed) {
    return fallbackOnboardingState(userId);
  }

  const selectColumns = buildOnboardingSelectColumns(schema);
  const upsertPayload = buildOnboardingInsertPayload(schema, userId, patch);
  const { data, error } = await client
    .from(ONBOARDING_TABLE)
    .upsert(upsertPayload, { onConflict: "user_id" })
    .select(selectColumns)
    .single();

  if (error || !data) {
    if (isMissingRelationError(error, ONBOARDING_TABLE)) {
      return normalizeOnboardingState(patch, userId);
    }
    throw new Error(error?.message || "Could not save onboarding state");
  }
  return normalizeOnboardingState(data as unknown as Record<string, unknown>, userId);
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

export async function getTermsAcceptanceState(client: SupabaseClientLike, userId: string) {
  const tableExists = await hasTable(client, TERMS_TABLE);
  if (!tableExists) {
    return fallbackTermsAcceptanceState(userId);
  }

  const [hasUserId, hasTermsVersion, hasAccepted, hasAcceptedAt, hasSource, hasUpdatedAt] = await Promise.all([
    hasColumn(client, TERMS_TABLE, "user_id"),
    hasColumn(client, TERMS_TABLE, "terms_version"),
    hasColumn(client, TERMS_TABLE, "accepted"),
    hasColumn(client, TERMS_TABLE, "accepted_at"),
    hasColumn(client, TERMS_TABLE, "source"),
    hasColumn(client, TERMS_TABLE, "updated_at"),
  ]);

  if (!hasUserId || !hasAccepted) {
    return fallbackTermsAcceptanceState(userId);
  }

  const selectedColumns = [
    "user_id",
    hasTermsVersion ? "terms_version" : null,
    "accepted",
    hasAcceptedAt ? "accepted_at" : null,
    hasSource ? "source" : null,
    hasUpdatedAt ? "updated_at" : null,
  ]
    .filter(Boolean)
    .join(",");

  const { data, error } = await client
    .from(TERMS_TABLE)
    .select(selectedColumns)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error, TERMS_TABLE)) {
      return fallbackTermsAcceptanceState(userId);
    }
    throw new Error(error.message || "Could not load terms acceptance state");
  }

  return normalizeTermsAcceptanceState(data as Record<string, unknown> | null, userId);
}

export async function saveTermsAcceptance(
  client: SupabaseClientLike,
  userId: string,
  {
    accepted,
    source = "onboarding",
    termsVersion = CURRENT_TERMS_VERSION,
  }: {
    accepted: boolean;
    source?: string;
    termsVersion?: string;
  },
) {
  const tableExists = await hasTable(client, TERMS_TABLE);
  if (!tableExists) {
    return fallbackTermsAcceptanceState(userId);
  }

  const [hasUserId, hasTermsVersion, hasAccepted, hasAcceptedAt, hasSource, hasUpdatedAt] = await Promise.all([
    hasColumn(client, TERMS_TABLE, "user_id"),
    hasColumn(client, TERMS_TABLE, "terms_version"),
    hasColumn(client, TERMS_TABLE, "accepted"),
    hasColumn(client, TERMS_TABLE, "accepted_at"),
    hasColumn(client, TERMS_TABLE, "source"),
    hasColumn(client, TERMS_TABLE, "updated_at"),
  ]);

  if (!hasUserId || !hasAccepted) {
    return fallbackTermsAcceptanceState(userId);
  }

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = { user_id: userId, accepted };
  if (hasTermsVersion) payload.terms_version = termsVersion;
  if (hasAcceptedAt) payload.accepted_at = accepted ? now : null;
  if (hasSource) payload.source = source;
  if (hasUpdatedAt) payload.updated_at = now;

  const selectedColumns = [
    "user_id",
    hasTermsVersion ? "terms_version" : null,
    "accepted",
    hasAcceptedAt ? "accepted_at" : null,
    hasSource ? "source" : null,
    hasUpdatedAt ? "updated_at" : null,
  ]
    .filter(Boolean)
    .join(",");

  const { data, error } = await client
    .from(TERMS_TABLE)
    .upsert(payload, { onConflict: "user_id" })
    .select(selectedColumns)
    .single();

  if (error || !data) {
    if (isMissingRelationError(error, TERMS_TABLE)) {
      return normalizeTermsAcceptanceState(payload, userId);
    }
    throw new Error(error?.message || "Could not save terms acceptance");
  }

  const normalized = normalizeTermsAcceptanceState(data as unknown as Record<string, unknown>, userId);
  if (!normalized.accepted) {
    return normalized;
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const confirmed = await getTermsAcceptanceState(client, userId);
    if (confirmed.accepted) {
      return confirmed;
    }
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }

  return normalized;
}

async function getOnboardingSchema(client: SupabaseClientLike): Promise<OnboardingSchema> {
  const exists = await hasTable(client, ONBOARDING_TABLE);
  if (!exists) {
    return {
      exists: false,
      columns: {
        user_id: false,
        current_step: false,
        completed_steps: false,
        is_completed: false,
        terms_accepted: false,
        marketing_opt_in: false,
        tour_opt_in: false,
        updated_at: false,
      },
    };
  }

  const [
    userId,
    currentStep,
    completedSteps,
    isCompleted,
    termsAccepted,
    marketingOptIn,
    tourOptIn,
    updatedAt,
  ] = await Promise.all([
    hasColumn(client, ONBOARDING_TABLE, "user_id"),
    hasColumn(client, ONBOARDING_TABLE, "current_step"),
    hasColumn(client, ONBOARDING_TABLE, "completed_steps"),
    hasColumn(client, ONBOARDING_TABLE, "is_completed"),
    hasColumn(client, ONBOARDING_TABLE, "terms_accepted"),
    hasColumn(client, ONBOARDING_TABLE, "marketing_opt_in"),
    hasColumn(client, ONBOARDING_TABLE, "tour_opt_in"),
    hasColumn(client, ONBOARDING_TABLE, "updated_at"),
  ]);

  return {
    exists: true,
    columns: {
      user_id: userId,
      current_step: currentStep,
      completed_steps: completedSteps,
      is_completed: isCompleted,
      terms_accepted: termsAccepted,
      marketing_opt_in: marketingOptIn,
      tour_opt_in: tourOptIn,
      updated_at: updatedAt,
    },
  };
}

function buildOnboardingSelectColumns(schema: OnboardingSchema) {
  const columns = ["user_id"];
  if (schema.columns.current_step) columns.push("current_step");
  if (schema.columns.completed_steps) columns.push("completed_steps");
  if (schema.columns.is_completed) columns.push("is_completed");
  if (schema.columns.terms_accepted) columns.push("terms_accepted");
  if (schema.columns.marketing_opt_in) columns.push("marketing_opt_in");
  if (schema.columns.tour_opt_in) columns.push("tour_opt_in");
  return columns.join(",");
}

function buildOnboardingInsertPayload(
  schema: OnboardingSchema,
  userId: string,
  patch: Partial<OnboardingStateRow>,
) {
  const payload: Record<string, unknown> = { user_id: userId };
  if (schema.columns.current_step) payload.current_step = patch.current_step ?? DEFAULT_STEP;
  if (schema.columns.completed_steps) payload.completed_steps = patch.completed_steps ?? [];
  if (schema.columns.is_completed) payload.is_completed = patch.is_completed ?? false;
  if (schema.columns.terms_accepted) payload.terms_accepted = patch.terms_accepted ?? false;
  if (schema.columns.marketing_opt_in) payload.marketing_opt_in = patch.marketing_opt_in ?? false;
  if (schema.columns.tour_opt_in) payload.tour_opt_in = patch.tour_opt_in ?? false;
  if (schema.columns.updated_at) payload.updated_at = new Date().toISOString();
  return payload;
}

function normalizeOnboardingState(
  row: Partial<OnboardingStateRow> | Record<string, unknown> | null | undefined,
  userId: string,
): OnboardingStateRow {
  return {
    user_id: String(row?.["user_id"] ?? userId),
    current_step: asStep(row?.["current_step"]),
    completed_steps: asStepList(row?.["completed_steps"]),
    is_completed: Boolean(row?.["is_completed"] ?? false),
    terms_accepted: Boolean(row?.["terms_accepted"] ?? false),
    marketing_opt_in: Boolean(row?.["marketing_opt_in"] ?? false),
    tour_opt_in: Boolean(row?.["tour_opt_in"] ?? false),
  };
}

function asStep(value: unknown): OnboardingStepId {
  const step = typeof value === "string" ? value : "";
  if (ONBOARDING_STEPS.some((item) => item.id === step)) {
    return step as OnboardingStepId;
  }
  return DEFAULT_STEP;
}

function asStepList(value: unknown): OnboardingStepId[] {
  if (!Array.isArray(value)) return [];
  const valid = value
    .filter((item): item is string => typeof item === "string")
    .filter((item) => ONBOARDING_STEPS.some((step) => step.id === item)) as OnboardingStepId[];
  return Array.from(new Set(valid));
}

function fallbackOnboardingState(userId: string): OnboardingStateRow {
  return {
    user_id: userId,
    current_step: FALLBACK_COMPLETE_STEP,
    completed_steps: [FALLBACK_COMPLETE_STEP],
    is_completed: true,
    terms_accepted: true,
    marketing_opt_in: false,
    tour_opt_in: false,
  };
}

function normalizeTermsAcceptanceState(row: Record<string, unknown> | null | undefined, userId: string) {
  return {
    user_id: String(row?.["user_id"] ?? userId),
    terms_version: typeof row?.["terms_version"] === "string" ? String(row["terms_version"]) : CURRENT_TERMS_VERSION,
    accepted: Boolean(row?.["accepted"] ?? false),
    accepted_at: typeof row?.["accepted_at"] === "string" ? String(row["accepted_at"]) : null,
    source: typeof row?.["source"] === "string" ? String(row["source"]) : "onboarding",
    updated_at: typeof row?.["updated_at"] === "string" ? String(row["updated_at"]) : null,
  };
}

function fallbackTermsAcceptanceState(userId: string) {
  return {
    user_id: userId,
    terms_version: CURRENT_TERMS_VERSION,
    accepted: true,
    accepted_at: null,
    source: "fallback",
    updated_at: null,
  };
}
