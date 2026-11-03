import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHmac } from "node:crypto";
import { verifyStripeSignature, PREMIUM_PRICES, TRIAL_DAYS, stripeMode } from "../lib/billing/stripe.ts";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("webhook signatures are checked against the raw body, the secret and the time", () => {
  const secret = "whsec_synthetic";
  const body = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated" });
  const now = Date.UTC(2026, 10, 3, 16, 0);
  const t = Math.floor(now / 1000);
  const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  assert.equal(verifyStripeSignature(body, `t=${t},v1=${sig}`, secret, now), true);
  assert.equal(verifyStripeSignature(body + " ", `t=${t},v1=${sig}`, secret, now), false);
  assert.equal(verifyStripeSignature(body, `t=${t},v1=${sig}`, "whsec_other", now), false);
  assert.equal(verifyStripeSignature(body, `t=${t},v1=${sig}`, secret, now + 10 * 60 * 1000), false);
  assert.equal(verifyStripeSignature(body, null, secret, now), false);
  assert.equal(verifyStripeSignature(body, `t=${t},v1=${sig}`, "", now), false);
});

test("prices, trial and sandbox detection match the plans report", () => {
  assert.equal(PREMIUM_PRICES.month.amount, 399);
  assert.equal(PREMIUM_PRICES.year.amount, 3900);
  assert.equal(TRIAL_DAYS, 14);
  const saved = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "";
  assert.equal(stripeMode(), "not_configured");
  process.env.STRIPE_SECRET_KEY = "sk_test_synthetic";
  assert.equal(stripeMode(), "test");
  process.env.STRIPE_SECRET_KEY = saved ?? "";
});

test("only verified Stripe events change a plan; the browser can't", () => {
  const migration = read("supabase/migrations/20261103160000_billing_stripe.sql");
  const webhook = read("app/api/billing/webhook/route.ts");
  const checkout = read("app/api/billing/checkout/route.ts");
  const page = read("app/(app)/account/billing/page.tsx");
  assert.match(migration, /Plans change only through billing/);
  assert.match(migration, /PLAN_LIMIT_RECORDS/);
  assert.match(webhook, /verifyStripeSignature\(raw, request\.headers\.get\("stripe-signature"\)\)/);
  assert.match(webhook, /stripe_webhook_events/);
  assert.match(webhook, /stripeRequest<.*>\("GET", `subscriptions\//);
  assert.doesNotMatch(checkout, /account_plan: "premium"/);
  assert.doesNotMatch(page, /from\("billing_profiles"\)/);
  assert.doesNotMatch(page, /Test subscription state|simulate/i);
});

test("a plan limit opens the Premium sheet in place, with Not now", () => {
  const sheet = read("components/billing/PremiumSheet.tsx");
  const records = read("components/records/UniversalRecordWorkspace.tsx");
  assert.match(sheet, /Not now/);
  assert.match(sheet, /Your records are safe on any plan/);
  assert.match(records, /showPremiumSheet\("records"\)/);
  assert.match(read("app/(app)/layout.tsx"), /<PremiumSheet \/>/);
});
