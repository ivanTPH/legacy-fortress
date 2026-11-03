import { NextResponse } from "next/server";
import { requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { applySubscription, documentPackPriceId, stripeMode, stripeRequest, type BillingInterval } from "@/lib/billing/stripe";

type Subscription = Parameters<typeof applySubscription>[1];

/**
 * POST — adds 100 documents to a Premium subscription (owner decision 3 Nov 2026): £1 a month, or £12 a year
 * on yearly plans. Charged through the existing subscription (Stripe prorates); the allowance follows Stripe.
 */
export async function POST(request: Request) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  if (stripeMode() === "not_configured") return NextResponse.json({ ok: false, message: "Payments aren't set up on this server yet." }, { status: 503 });
  const profile = await access.admin.from("billing_profiles").select("account_plan,stripe_subscription_id").eq("user_id", access.user.id).maybeSingle();
  const subscriptionId = profile.data?.stripe_subscription_id as string | undefined;
  if (profile.data?.account_plan !== "premium" || !subscriptionId) return NextResponse.json({ ok: false, message: "Extra documents are added to a Premium subscription." }, { status: 409 });
  try {
    const subscription = await stripeRequest<Subscription>("GET", `subscriptions/${subscriptionId}`);
    const items = subscription.items?.data ?? [];
    const pack = items.find((item) => String(item.price?.lookup_key ?? "").startsWith("lf_document_pack"));
    const interval: BillingInterval = (items.find((item) => item !== pack)?.price?.recurring?.interval === "year") ? "year" : "month";
    if (pack?.id) {
      await stripeRequest("POST", `subscription_items/${pack.id}`, { quantity: Number(pack.quantity ?? 1) + 1, proration_behavior: "create_prorations" });
    } else {
      await stripeRequest("POST", "subscription_items", { subscription: subscriptionId, price: await documentPackPriceId(interval), quantity: 1, proration_behavior: "create_prorations" });
    }
    // Apply straight away (the webhook confirms the same state moments later).
    await applySubscription(access.admin, await stripeRequest<Subscription>("GET", `subscriptions/${subscriptionId}`));
    return NextResponse.json({ ok: true, message: interval === "year" ? "100 more documents added for £12 a year." : "100 more documents added for £1 a month." });
  } catch {
    return NextResponse.json({ ok: false, message: "Extra documents couldn't be added. Nothing was charged. Try again." }, { status: 502 });
  }
}
