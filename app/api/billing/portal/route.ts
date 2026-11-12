import { NextResponse } from "next/server";
import { requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { siteUrl, describeStripeFailure, LIVE_KEY_ON_TEST_MESSAGE, paymentsBlockedOnTest, stripeMode, stripeRequest } from "@/lib/billing/stripe";

/** POST — opens Stripe's customer portal: change card, switch monthly/yearly, invoices, cancel. */
export async function POST(request: Request) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  if (stripeMode() === "not_configured") return NextResponse.json({ ok: false, message: "Payments aren't set up on this server yet." }, { status: 503 });
  if (paymentsBlockedOnTest()) return NextResponse.json({ ok: false, reason: "live_key_on_test", message: LIVE_KEY_ON_TEST_MESSAGE }, { status: 503 });
  const profile = await access.admin.from("billing_profiles").select("stripe_customer_id").eq("user_id", access.user.id).maybeSingle();
  const customer = profile.data?.stripe_customer_id as string | undefined;
  if (!customer) return NextResponse.json({ ok: false, message: "There's no subscription to manage yet." }, { status: 404 });
  try {
    const session = await stripeRequest<{ url: string }>("POST", "billing_portal/sessions", { customer, return_url: `${siteUrl()}/account/billing` });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (error) {
    const failure = describeStripeFailure(error, "settings");
    return NextResponse.json({ ok: false, reason: failure.reason, message: failure.message }, { status: 502 });
  }
}
