/**
 * The Home readiness card (owner, 27 Nov 2026): one slim line by default; the owner can hide it; it returns by
 * itself only when a next step appears that wasn't there when it was hidden; it goes away at 100%.
 *
 * Stored in the owner's existing Vault preferences ("guidance" map), so it follows them across devices and needs
 * no database change. Keys are namespaced so they never clash with real next-step decisions.
 */
import type { VaultPreferences } from "../vaultPreferences.ts";

export const READINESS_CARD_KEY = "readinessCard.hidden";
const SEEN_PREFIX = "readinessCard.seen:";

export type ReadinessCardMode = "shown" | "hidden" | "complete";

export function readinessCardMode(percent: number, nextStepKeys: string[], preferences: Pick<VaultPreferences, "guidance">): ReadinessCardMode {
  if (percent >= 100) return "complete";
  const hidden = preferences.guidance?.[READINESS_CARD_KEY]?.state === "not_relevant";
  if (!hidden) return "shown";
  const somethingNew = nextStepKeys.some((key) => !preferences.guidance?.[`${SEEN_PREFIX}${key}`]);
  return somethingNew ? "shown" : "hidden";
}

/** Hide the card, remembering which steps were showing so a genuinely new one can bring it back. */
export function hideReadinessCard(preferences: VaultPreferences, nextStepKeys: string[], now = new Date()): VaultPreferences {
  const updatedAt = now.toISOString();
  const guidance = { ...preferences.guidance };
  for (const key of Object.keys(guidance)) if (key.startsWith(SEEN_PREFIX)) delete guidance[key];
  guidance[READINESS_CARD_KEY] = { state: "not_relevant", snoozedUntil: null, updatedAt };
  for (const key of nextStepKeys) guidance[`${SEEN_PREFIX}${key}`] = { state: "recorded", snoozedUntil: null, updatedAt };
  return { ...preferences, guidance };
}

export function showReadinessCard(preferences: VaultPreferences): VaultPreferences {
  const guidance = { ...preferences.guidance };
  for (const key of Object.keys(guidance)) if (key === READINESS_CARD_KEY || key.startsWith(SEEN_PREFIX)) delete guidance[key];
  return { ...preferences, guidance };
}
