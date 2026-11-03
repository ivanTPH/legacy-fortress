import { supabase } from "../supabaseClient";

/** Browser helpers for billing. Nothing here can change a plan: Stripe's confirmed events do that on the server. */
export type BillingStatus = {
  ok: boolean;
  mode: "not_configured" | "test" | "live";
  plan: "free" | "premium";
  status: string;
  interval: "month" | "year" | null;
  renewsAt: string | null;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  canManage: boolean;
  trialAvailable: boolean;
};

export type PremiumReason = "records" | "type" | "sharing" | "nominees" | "people" | "storage" | "suggestions" | "weekly";

export const PREMIUM_SHEET_COPY: Record<PremiumReason, { title: string; body: string }> = {
  records: { title: "Add unlimited records with Premium", body: "You've used your 6 free records. Premium removes the limit, adds 20 GB for documents and lets advisers suggest documents for you to approve." },
  type: { title: "Add all your accounts with Premium", body: "The free plan holds 2 of each kind of record. Premium lets you add every account, pension, policy and property, so nothing is missed." },
  people: { title: "Invite more people with Premium", body: "The free plan lets you invite one person, usually the person you nominate for after your death. Premium lets you add everyone who'll need to help: family, executors and advisers." },
  sharing: { title: "Share records now with Premium", body: "On the free plan, your nominee receives your Vault after your death. Premium lets you share chosen records with people now, while you're here to help, and see when they look." },
  nominees: { title: "Nominate more people with Premium", body: "The free plan has one nominee for after your death. Premium lets you nominate as many people as you need, each with the records that matter to them." },
  storage: { title: "More room for documents with Premium", body: "You've used your free document space. Premium gives you 20 GB for statements, deeds, policies and photos." },
  suggestions: { title: "Let advisers suggest documents with Premium", body: "With Premium, the people you choose can send you documents for your records. You approve each one first." },
  weekly: { title: "Weekly summaries with Premium", body: "Free members get a monthly summary. Premium adds a weekly summary of what's waiting for you." },
};

/** Ask the app to show the Premium sheet (it's mounted once in the app layout). */
export function showPremiumSheet(reason: PremiumReason) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("lf:premium-required", { detail: { reason } }));
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function loadBillingStatus(): Promise<BillingStatus | null> {
  const response = await fetch("/api/billing/status", { headers: await authHeaders() }).catch(() => null);
  if (!response?.ok) return null;
  return (await response.json().catch(() => null)) as BillingStatus | null;
}

/**
 * Before starting something Free doesn't include: true on Premium (or when the plan can't be read, so the
 * server decides); otherwise opens the Premium sheet and returns false. The server enforces it either way.
 */
export async function requirePremium(reason: PremiumReason) {
  const status = await loadBillingStatus();
  if (!status || status.plan === "premium") return true;
  showPremiumSheet(reason);
  return false;
}

export async function startCheckout(interval: "month" | "year", returnTo?: string) {
  const response = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ interval, returnTo: returnTo ?? `${window.location.pathname}${window.location.search}` }),
  }).catch(() => null);
  const json = (await response?.json().catch(() => ({}))) as { ok?: boolean; url?: string; message?: string } | undefined;
  if (json?.url) { window.location.assign(json.url); return null; }
  return json?.message ?? "Secure payment couldn't be opened. Try again.";
}

export async function openBillingPortal() {
  const response = await fetch("/api/billing/portal", { method: "POST", headers: await authHeaders() }).catch(() => null);
  const json = (await response?.json().catch(() => ({}))) as { ok?: boolean; url?: string; message?: string } | undefined;
  if (json?.url) { window.location.assign(json.url); return null; }
  return json?.message ?? "Subscription settings couldn't be opened. Try again.";
}

/** True when the free plan's 2-of-each-type limit (not the total) was reached. */
export function isTypeLimitError(error: unknown) {
  return /PLAN_LIMIT_RECORDS_TYPE/.test(error instanceof Error ? error.message : String(error ?? ""));
}

/** Which Premium sheet a server plan-limit message calls for, or null when it isn't one. */
export function planLimitReason(error: unknown): PremiumReason | null {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : String(error ?? "");
  if (/PLAN_LIMIT_SHARING/.test(message)) return "sharing";
  if (/PLAN_LIMIT_NOMINEES/.test(message)) return "nominees";
  if (/PLAN_LIMIT_SUGGESTIONS/.test(message)) return "suggestions";
  if (/PLAN_LIMIT_INVITATIONS/.test(message)) return "people";
  if (/PLAN_LIMIT_RECORDS_TYPE/.test(message)) return "type";
  if (/PLAN_LIMIT_RECORDS/.test(message)) return "records";
  return null;
}

export function isPlanLimitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /PLAN_LIMIT_RECORDS|PLAN_LIMIT_INVITATIONS|PLAN_LIMIT_SHARING|PLAN_LIMIT_NOMINEES|PLAN_LIMIT_SUGGESTIONS|Starter plan limit reached|Free plan limit reached/i.test(message) || (error instanceof Error && error.name === "PlanLimitError");
}
