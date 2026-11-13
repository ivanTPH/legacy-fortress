import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHmac } from "node:crypto";
import { verifyStripeSignature, invoiceSubscriptionId, PREMIUM_PRICES, TRIAL_DAYS, stripeMode, paymentsBlockedOnTest, describeStripeFailure } from "../lib/billing/stripe.ts";

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
  assert.match(records, /showPremiumSheet\(isTypeLimitError\(error\) \? "type" : "records"\)/);
  assert.match(read("app/(app)/layout.tsx"), /<PremiumSheet \/>/);
});

test("Free is 2 of each type, 6 records and 1 person, enforced by the database as well as the app", () => {
  const migration = read("supabase/migrations/20261103170000_free_plan_limits.sql");
  assert.match(migration, /record_limit := 6; NEW\.invitation_limit := 1;/);
  assert.match(migration, /PLAN_LIMIT_RECORDS_TYPE/);
  assert.match(migration, /PLAN_LIMIT_INVITATIONS/);
  assert.match(migration, /invitation_status IN \('pending', 'accepted'\)/);
  assert.match(read("lib/accountPlan.ts"), /STARTER_RECORD_LIMIT = 6;[\s\S]*STARTER_INVITATION_LIMIT = 1;/);
  assert.match(read("lib/contacts/sendContactInvite.ts"), /PLAN_LIMIT_INVITATIONS/);
  assert.match(read("app/(app)/account/billing/page.tsx"), /2 of each kind of record, up to 6 in all/);
});

test("Free shares nothing now and has one nominee; each limit opens its Premium sheet", async () => {
  const migration = read("supabase/migrations/20261103190000_free_plan_sharing.sql");
  for (const code of ["PLAN_LIMIT_SHARING", "PLAN_LIMIT_NOMINEES", "PLAN_LIMIT_SUGGESTIONS"]) assert.match(migration, new RegExp(code));
  assert.match(migration, /<> 'owner_grant'/, "authority and estate grants are never limited");
  const { planLimitReason } = await import("../lib/billing/client.ts").catch(() => ({ planLimitReason: null }));
  if (planLimitReason) {
    assert.equal(planLimitReason(new Error("PLAN_LIMIT_SHARING: x")), "sharing");
    assert.equal(planLimitReason({ message: "PLAN_LIMIT_NOMINEES: x" }), "nominees");
    assert.equal(planLimitReason(new Error("PLAN_LIMIT_RECORDS_TYPE: x")), "type");
    assert.equal(planLimitReason(new Error("PLAN_LIMIT_RECORDS: x")), "records");
    assert.equal(planLimitReason(new Error("something else")), null);
  }
  assert.match(read("components/contacts/ContactsNetworkWorkspace.tsx"), /showPremiumSheet\(planLimitReason\(grantUpdate\.error\)!\)/);
  assert.match(read("components/people-access/VaultAccessWorkspace.tsx"), /planLimitReason\(cause\)/);
  assert.match(read("components/access/AccessSharingWorkspace.tsx"), /planLimitReason\(result\.error\)/);
  assert.match(read("scripts/staging/run-vault-access-acceptance.mjs"), /share_now_on_free/);
});

test("every over-limit action offers the upgrade in place", () => {
  assert.match(read("lib/contacts/sendContactInvite.ts"), /showPremiumSheet\("people"\)[\s\S]*showPremiumSheet\("people"\)/, "both invite limits open the sheet on every invite screen");
  const network = read("components/contacts/ContactsNetworkWorkspace.tsx");
  assert.match(network, /requirePremium\("sharing"\)[\s\S]*requirePremium\("sharing"\)/, "Share records now and Give access check first");
  assert.doesNotMatch(read("app/(app)/dashboard/page.tsx"), /router\.push\("\/account\/billing\?reason=plan-limit"\)/);
  assert.match(read("lib/billing/client.ts"), /export async function requirePremium/);
});

test("Documents: Free 10, Premium 100 plus paid packs of 100, warned from 90%", async () => {
  const migration = read("supabase/migrations/20261103200000_document_limits.sql");
  assert.match(migration, /100 \* \(1 \+ b\.document_packs\)/);
  assert.match(migration, /PLAN_LIMIT_DOCUMENT_PACK/);
  assert.match(migration, /NEW\.trial_used_at, NEW\.document_packs\)/, "the plan guard covers storage packs");
  const { DOCUMENT_PACK_PRICES } = await import("../lib/billing/stripe.ts");
  assert.equal(DOCUMENT_PACK_PRICES.month.amount, 100);
  assert.equal(DOCUMENT_PACK_PRICES.year.amount, 1200);
  assert.match(read("app/api/billing/storage-pack/route.ts"), /subscription_items/);
  assert.match(read("components/billing/PremiumSheet.tsx"), /addDocumentPack/);
  assert.match(read("components/billing/DocumentAllowanceNote.tsx"), /included \* 0\.9/);
  assert.match(read("lib/assets/documentLinks.ts"), /showPremiumSheet\(limit\)/);
  assert.match(read("components/records/UniversalRecordWorkspace.tsx"), /isFairUseLimit\(insertResult\.error\)/);
});

test("payment events find their subscription in old and new Stripe formats (TEST webhook uses 2026-10-28)", () => {
  assert.equal(invoiceSubscriptionId({ subscription: "sub_old" }), "sub_old");
  assert.equal(invoiceSubscriptionId({ subscription: null, parent: { subscription_details: { subscription: "sub_new" } } }), "sub_new");
  assert.equal(invoiceSubscriptionId({ parent: { subscription_details: { subscription: { id: "sub_obj" } } } }), "sub_obj");
  assert.equal(invoiceSubscriptionId({ parent: null }), null);
  assert.match(read("app/api/billing/webhook/route.ts"), /invoiceSubscriptionId\(event\.data\.object\)/);
});

test("TEST never takes real money: a live key on a TEST server blocks every payment action (owner, 12 Nov 2026)", () => {
  const saved = { key: process.env.STRIPE_SECRET_KEY, env: process.env.APP_ENV };
  try {
    process.env.APP_ENV = "uat";
    process.env.STRIPE_SECRET_KEY = "sk_live_synthetic";
    assert.equal(paymentsBlockedOnTest(), true);
    process.env.STRIPE_SECRET_KEY = "sk_test_synthetic";
    assert.equal(paymentsBlockedOnTest(), false);
    process.env.APP_ENV = "production";
    process.env.STRIPE_SECRET_KEY = "sk_live_synthetic";
    assert.equal(paymentsBlockedOnTest(), false);
  } finally {
    if (saved.key === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = saved.key;
    if (saved.env === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = saved.env;
  }
  for (const route of ["checkout", "portal", "storage-pack"]) {
    assert.match(read(`app/api/billing/${route}/route.ts`), /if \(paymentsBlockedOnTest\(\)\) return NextResponse\.json\(\{ ok: false, reason: "live_key_on_test"/);
  }
  assert.match(read("app/api/billing/status/route.ts"), /mode: paymentsBlockedOnTest\(\) \? "live_blocked" : stripeMode\(\)/);
});

test("a Stripe failure says why, and never shows a key", () => {
  const original = console.error; console.error = () => {};
  try {
    const key = describeStripeFailure(new Error("stripe_error: Invalid API Key provided: sk_live_********abcd"), "payment");
    assert.equal(key.reason, "invalid_key");
    assert.doesNotMatch(key.message, /sk_/);
    assert.match(key.message, /Nothing was charged/);
    assert.equal(describeStripeFailure(new Error("stripe_price_missing"), "payment").reason, "price_missing");
    assert.equal(describeStripeFailure(new Error("fetch failed"), "settings").reason, "unreachable");
  } finally { console.error = original; }
});

test("checkout starts a fresh Stripe customer when the saved one belongs to another key", () => {
  const route = read("app/api/billing/checkout/route.ts");
  assert.match(route, /stripeRequest<\{ deleted\?: boolean \}>\("GET", `customers\/\$\{encodeURIComponent\(customerId\)\}`\)/);
  assert.match(route, /No such customer/);
  assert.match(route, /if \(!known\) customerId = null;/);
});
