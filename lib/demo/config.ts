export const DEMO_ENVIRONMENT_KEY = "bill-smith-review-demo-v1";
export const DEMO_ACCOUNT_HOLDER_NAME = "Bill Smith";
export const DEMO_OWNER_EMAIL = "bill.smith.demo.owner@legacyfortress.test";
export const DEMO_REVIEWER_EMAIL = "bill.smith.demo.reviewer@legacyfortress.test";
export const DEMO_REVIEWER_NAME = "Legacy Fortress Demo Reviewer";
export const DEMO_REVIEWER_ROLE = "executor";
export const DEMO_EXPERIENCE_LABEL = "Demo account";
export const DEMO_EXPERIENCE_SUBLABEL = "Review environment";

export function normalizeDemoEmail(email: string | null | undefined) {
  return String(email ?? "").trim().toLowerCase();
}

export function isDemoEmail(email: string | null | undefined) {
  const normalized = normalizeDemoEmail(email);
  return normalized === DEMO_OWNER_EMAIL || normalized === DEMO_REVIEWER_EMAIL;
}

export function hasDemoUserFlag(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return false;
  const record = metadata as Record<string, unknown>;
  return record.lf_demo_account === true || record.lf_demo_environment === DEMO_ENVIRONMENT_KEY;
}

export function isDemoSessionUser({
  email,
  userMetadata,
  appMetadata,
}: {
  email?: string | null;
  userMetadata?: unknown;
  appMetadata?: unknown;
}) {
  return isDemoEmail(email) || hasDemoUserFlag(userMetadata) || hasDemoUserFlag(appMetadata);
}

/**
 * Security review (23 Nov 2026): the public demo signs any visitor into a shared demo account and, on each request,
 * creates or refreshes demo users with full database rights. It stays off unless both flags are set on purpose,
 * and never runs on the live site.
 */
export function isPublicDemoEnabled(host?: string | null) {
  const on = String(process.env.LF_PUBLIC_DEMO_ENABLED ?? process.env.NEXT_PUBLIC_LF_PUBLIC_DEMO_ENABLED ?? "").trim() === "true";
  const name = String(host ?? "").toLowerCase();
  const live = (name.endsWith("mylegacyfortress.com") && !name.startsWith("test.")) || name === "legacy-fortress.vercel.app";
  return on && !live;
}

/** Browser: show the Demo link only when the public demo is switched on for this build. */
export const PUBLIC_DEMO_LINK_VISIBLE = String(process.env.NEXT_PUBLIC_LF_PUBLIC_DEMO_ENABLED ?? "").trim() === "true";
