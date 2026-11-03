import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Stripe subscriptions (owner decision 3 Nov 2026). Server only: the secret key and webhook secret come from the
 * server's settings and never reach a browser. Card details go straight to Stripe's own Checkout page.
 * Plans change only from verified Stripe events (see applySubscription), never from the browser.
 */
export const PREMIUM_PRICES = {
  month: { lookupKey: "lf_premium_monthly", amount: 399, label: "£3.99 a month" },
  year: { lookupKey: "lf_premium_yearly", amount: 3900, label: "£39 a year" },
} as const;
export type BillingInterval = keyof typeof PREMIUM_PRICES;
export const TRIAL_DAYS = 14;

export function stripeSecretKey() { return String(process.env.STRIPE_SECRET_KEY ?? "").trim(); }
export function stripeMode(): "not_configured" | "test" | "live" {
  const key = stripeSecretKey();
  if (!key) return "not_configured";
  return key.startsWith("sk_test_") || key.startsWith("rk_test_") ? "test" : "live";
}

type StripeParams = Record<string, string | number | boolean | undefined | null>;

export async function stripeRequest<T = Record<string, unknown>>(method: "GET" | "POST", path: string, params: StripeParams = {}): Promise<T> {
  const key = stripeSecretKey();
  if (!key) throw new Error("stripe_not_configured");
  const body = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) if (value !== undefined && value !== null) body.append(name, String(value));
  const url = `https://api.stripe.com/v1/${path}${method === "GET" && body.toString() ? `?${body.toString()}` : ""}`;
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded", "Stripe-Version": "2024-06-20" },
    body: method === "POST" ? body.toString() : undefined,
  });
  const json = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(`stripe_error: ${json.error?.message ?? response.status}`);
  return json;
}

/**
 * The two Premium prices, found by lookup key. In the sandbox they're created on first use so testing needs no
 * set-up in Stripe; in live mode they must already exist (created once by the owner), so nothing is invented.
 */
export async function premiumPriceId(interval: BillingInterval): Promise<string> {
  const wanted = PREMIUM_PRICES[interval];
  const found = await stripeRequest<{ data: Array<{ id: string }> }>("GET", "prices", { "lookup_keys[]": wanted.lookupKey, active: true, limit: 1 });
  if (found.data[0]?.id) return found.data[0].id;
  if (stripeMode() !== "test") throw new Error("stripe_price_missing");
  const products = await stripeRequest<{ data: Array<{ id: string }> }>("GET", "products/search", { query: "metadata['lf_product']:'premium'" }).catch(() => ({ data: [] }));
  const productId = products.data[0]?.id ?? (await stripeRequest<{ id: string }>("POST", "products", { name: "Legacy Fortress Premium", "metadata[lf_product]": "premium" })).id;
  const price = await stripeRequest<{ id: string }>("POST", "prices", {
    product: productId, currency: "gbp", unit_amount: wanted.amount, "recurring[interval]": interval, lookup_key: wanted.lookupKey, tax_behavior: "inclusive", nickname: `Premium ${wanted.label}`,
  });
  return price.id;
}

/** Verifies Stripe's signature header (t=…,v1=…) over the raw body, within 5 minutes. */
export function verifyStripeSignature(rawBody: string, header: string | null, secret = String(process.env.STRIPE_WEBHOOK_SECRET ?? ""), now = Date.now()) {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((part) => { const [k, ...v] = part.split("="); return [k.trim(), v.join("=")]; }));
  const timestamp = Number(parts.t);
  const signatures = header.split(",").filter((part) => part.trim().startsWith("v1=")).map((part) => part.trim().slice(3));
  if (!Number.isFinite(timestamp) || !signatures.length || Math.abs(now / 1000 - timestamp) > 300) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex"), "hex");
  return signatures.some((signature) => {
    const given = Buffer.from(signature, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

type StripeSubscription = {
  id: string; status: string; customer: string; cancel_at_period_end?: boolean; current_period_end?: number; trial_end?: number | null;
  metadata?: Record<string, string>; items?: { data?: Array<{ price?: { recurring?: { interval?: string } } }> };
};

/** Keeps a customer's plan in step with their Stripe subscription. Runs as the server (service role). */
export async function applySubscription(admin: SupabaseClient, subscription: StripeSubscription) {
  const premium = ["active", "trialing", "past_due"].includes(subscription.status);
  const interval = subscription.items?.data?.[0]?.price?.recurring?.interval;
  const userIdFromMetadata = subscription.metadata?.user_id;
  const profile = userIdFromMetadata
    ? await admin.from("billing_profiles").select("user_id").eq("user_id", userIdFromMetadata).maybeSingle()
    : await admin.from("billing_profiles").select("user_id").eq("stripe_customer_id", subscription.customer).maybeSingle();
  const userId = profile.data?.user_id as string | undefined;
  if (!userId) return { applied: false, reason: "no_matching_account" };
  const update = await admin.from("billing_profiles").update({
    account_plan: premium ? "premium" : "starter",
    plan_status: subscription.status === "trialing" ? "trialing" : subscription.status === "past_due" ? "past_due" : premium ? "active" : "canceled",
    plan_source: "stripe",
    stripe_customer_id: subscription.customer,
    stripe_subscription_id: premium ? subscription.id : null,
    billing_interval: interval === "year" ? "year" : interval === "month" ? "month" : null,
    current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
    trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    monthly_charge: premium ? (interval === "year" ? 3.25 : 3.99) : 0,
    ...(subscription.trial_end ? { trial_used_at: new Date().toISOString() } : {}),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);
  if (update.error) throw new Error(update.error.message);
  return { applied: true, userId, premium };
}

export function siteUrl() {
  return String(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://test.mylegacyfortress.com").replace(/\/$/, "");
}
