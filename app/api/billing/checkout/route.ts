import { NextResponse } from "next/server";
import { requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { premiumPriceId, siteUrl, describeStripeFailure, LIVE_KEY_ON_TEST_MESSAGE, paymentsBlockedOnTest, stripeMode, stripeRequest, TRIAL_DAYS, type BillingInterval } from "@/lib/billing/stripe";

/**
 * POST { interval: "month" | "year", returnTo? } — opens Stripe Checkout for Premium. Card details are entered on
 * Stripe's page. Nothing about the plan changes here: only Stripe's confirmed event (webhook) does that.
 */
export async function POST(request: Request) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  if (stripeMode() === "not_configured") return NextResponse.json({ ok: false, message: "Payments aren't set up on this server yet." }, { status: 503 });
  if (paymentsBlockedOnTest()) return NextResponse.json({ ok: false, reason: "live_key_on_test", message: LIVE_KEY_ON_TEST_MESSAGE }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as { interval?: string; returnTo?: string };
  const interval: BillingInterval = body.interval === "year" ? "year" : "month";
  const returnTo = typeof body.returnTo === "string" && /^\/[A-Za-z0-9/_?=&.-]*$/.test(body.returnTo) && !body.returnTo.startsWith("//") ? body.returnTo : "/account/billing";

  let profile = await access.admin.from("billing_profiles").select("user_id,account_plan,stripe_customer_id,trial_used_at").eq("user_id", access.user.id).maybeSingle();
  if (!profile.data) {
    await access.admin.from("billing_profiles").insert({ user_id: access.user.id }).then(() => undefined, () => undefined);
    profile = await access.admin.from("billing_profiles").select("user_id,account_plan,stripe_customer_id,trial_used_at").eq("user_id", access.user.id).maybeSingle();
  }
  if (!profile.data) return NextResponse.json({ ok: false, message: "Your account isn't ready yet. Try again." }, { status: 409 });
  if (profile.data.account_plan === "premium") return NextResponse.json({ ok: false, message: "You already have Premium.", alreadyPremium: true }, { status: 409 });

  try {
    let customerId = profile.data.stripe_customer_id as string | null;
    // A customer saved under a different Stripe key (e.g. a live key that TEST once held) isn't known to this one:
    // start a fresh customer rather than fail (owner report, 12-13 Nov 2026).
    if (customerId) {
      const known = await stripeRequest<{ deleted?: boolean }>("GET", `customers/${encodeURIComponent(customerId)}`)
        .then((customer) => !customer.deleted, (error: unknown) => !/No such customer/i.test(String(error instanceof Error ? error.message : error)));
      if (!known) customerId = null;
    }
    if (!customerId) {
      const customer = await stripeRequest<{ id: string }>("POST", "customers", { email: access.user.email ?? undefined, "metadata[user_id]": access.user.id });
      customerId = customer.id;
      await access.admin.from("billing_profiles").update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() }).eq("user_id", access.user.id);
    }
    const price = await premiumPriceId(interval);
    const base = siteUrl();
    const session = await stripeRequest<{ url: string }>("POST", "checkout/sessions", {
      mode: "subscription",
      customer: customerId,
      client_reference_id: access.user.id,
      "line_items[0][price]": price,
      "line_items[0][quantity]": 1,
      "subscription_data[metadata][user_id]": access.user.id,
      "subscription_data[trial_period_days]": profile.data.trial_used_at ? undefined : TRIAL_DAYS,
      "metadata[user_id]": access.user.id,
      success_url: `${base}${returnTo}${returnTo.includes("?") ? "&" : "?"}checkout=success`,
      cancel_url: `${base}${returnTo}${returnTo.includes("?") ? "&" : "?"}checkout=cancelled`,
      locale: "en-GB",
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (error) {
    const failure = describeStripeFailure(error, "payment");
    return NextResponse.json({ ok: false, reason: failure.reason, message: failure.message }, { status: 502 });
  }
}
