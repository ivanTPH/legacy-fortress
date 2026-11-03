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

export type PremiumReason = "records" | "people" | "storage" | "suggestions" | "weekly";

export const PREMIUM_SHEET_COPY: Record<PremiumReason, { title: string; body: string }> = {
  records: { title: "Add unlimited records with Premium", body: "You've used your 25 free records. Premium removes the limit, adds 20 GB for documents and lets advisers suggest documents for you to approve." },
  people: { title: "Share with more people with Premium", body: "The free plan lets you share records with a few people at a time. Premium lets you share with as many as you like." },
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

export function isPlanLimitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /PLAN_LIMIT_RECORDS|Starter plan limit reached|Free plan limit reached/i.test(message) || (error instanceof Error && error.name === "PlanLimitError");
}
