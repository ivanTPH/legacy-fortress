import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { applySubscription, stripeRequest, verifyStripeSignature } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

/**
 * POST — Stripe's event delivery. The only way a plan changes. The signature is checked against the raw body,
 * each event is applied once, and the subscription is re-read from Stripe rather than trusted from the payload.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"))) return NextResponse.json({ ok: false }, { status: 400 });
  const event = JSON.parse(raw) as { id: string; type: string; data: { object: Record<string, unknown> } };
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 503 });
  const seen = await admin.from("stripe_webhook_events").insert({ id: event.id, type: event.type });
  if (seen.error) return NextResponse.json({ ok: true, duplicate: true });

  try {
    let subscriptionId: string | null = null;
    if (event.type.startsWith("customer.subscription.")) subscriptionId = String(event.data.object.id ?? "");
    if (event.type === "checkout.session.completed") subscriptionId = String(event.data.object.subscription ?? "") || null;
    if (event.type === "invoice.payment_failed" || event.type === "invoice.paid") subscriptionId = String(event.data.object.subscription ?? "") || null;
    if (subscriptionId) {
      const subscription = await stripeRequest<Parameters<typeof applySubscription>[1]>("GET", `subscriptions/${encodeURIComponent(subscriptionId)}`);
      await applySubscription(admin, subscription);
    }
    return NextResponse.json({ ok: true });
  } catch {
    // Let Stripe retry: forget the event so the retry is applied.
    await admin.from("stripe_webhook_events").delete().eq("id", event.id);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
