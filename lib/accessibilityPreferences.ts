import type { SupabaseClient } from "@supabase/supabase-js";
import { hasColumn, hasTable } from "./schemaSafe";

type AnySupabaseClient = SupabaseClient;

export type AccessibilityTextSize = "default" | "large" | "xlarge";
export type AccessibilityContrast = "default" | "high";
export type AccessibilitySpacing = "default" | "comfortable";

export type AccessibilityPreferences = {
  textSize: AccessibilityTextSize;
  contrastMode: AccessibilityContrast;
  spacingMode: AccessibilitySpacing;
  helpWizardEnabled: boolean;
  readAloudEnabled: boolean;
};

const USER_PROFILES_TABLE = "user_profiles";
const ACCESSIBILITY_COLUMN = "accessibility_preferences";

export function getDefaultAccessibilityPreferences(): AccessibilityPreferences {
  return {
    textSize: "default",
    contrastMode: "default",
    spacingMode: "default",
    helpWizardEnabled: false,
    readAloudEnabled: false,
  };
}

export function normalizeAccessibilityPreferences(input: unknown): AccessibilityPreferences {
  const defaults = getDefaultAccessibilityPreferences();
  if (!input || typeof input !== "object") return defaults;

  const record = input as Record<string, unknown>;
  return {
    textSize: record.textSize === "large" || record.textSize === "xlarge" ? record.textSize : defaults.textSize,
    contrastMode: record.contrastMode === "high" ? "high" : defaults.contrastMode,
    spacingMode: record.spacingMode === "comfortable" ? "comfortable" : defaults.spacingMode,
    helpWizardEnabled: record.helpWizardEnabled === true,
    readAloudEnabled: record.readAloudEnabled === true,
  };
}

export async function loadAccessibilityPreferences(client: AnySupabaseClient, userId: string) {
  if (!(await hasTable(client, USER_PROFILES_TABLE)) || !(await hasColumn(client, USER_PROFILES_TABLE, ACCESSIBILITY_COLUMN))) {
    return getDefaultAccessibilityPreferences();
  }

  const res = await client
    .from(USER_PROFILES_TABLE)
    .select(ACCESSIBILITY_COLUMN)
    .eq("user_id", userId)
    .maybeSingle();

  if (res.error) {
    throw new Error(res.error.message);
  }

  return normalizeAccessibilityPreferences((res.data as Record<string, unknown> | null)?.[ACCESSIBILITY_COLUMN]);
}

export async function saveAccessibilityPreferences(
  client: AnySupabaseClient,
  userId: string,
  preferences: AccessibilityPreferences,
) {
  if (!(await hasTable(client, USER_PROFILES_TABLE)) || !(await hasColumn(client, USER_PROFILES_TABLE, ACCESSIBILITY_COLUMN))) {
    return preferences;
  }

  const normalized = normalizeAccessibilityPreferences(preferences);
  const res = await client
    .from(USER_PROFILES_TABLE)
    .upsert(
      {
        user_id: userId,
        [ACCESSIBILITY_COLUMN]: normalized,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (res.error) {
    throw new Error(res.error.message);
  }

  return normalized;
}
