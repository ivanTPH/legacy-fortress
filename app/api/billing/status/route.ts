import { NextResponse } from "next/server";
import { requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { stripeMode } from "@/lib/billing/stripe";

/** GET — the signed-in person's plan, as the server holds it. */
export async function GET(request: Request) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  let row = await access.admin.from("billing_profiles")
    .select("account_plan,plan_status,billing_interval,current_period_end,trial_ends_at,cancel_at_period_end,stripe_customer_id,trial_used_at")
    .eq("user_id", access.user.id).maybeSingle();
  // Until the billing columns exist on a server, fall back to the plan alone.
  if (row.error) row = await access.admin.from("billing_profiles").select("account_plan,plan_status,trial_ends_at").eq("user_id", access.user.id).maybeSingle() as typeof row;
  const data = (row.data ?? null) as Record<string, unknown> | null;
  return NextResponse.json({
    ok: true,
    mode: stripeMode(),
    plan: data?.account_plan === "premium" ? "premium" : "free",
    status: data?.plan_status ?? "active",
    interval: data?.billing_interval ?? null,
    renewsAt: data?.current_period_end ?? null,
    trialEndsAt: data?.trial_ends_at ?? null,
    cancelAtPeriodEnd: Boolean(data?.cancel_at_period_end),
    canManage: Boolean(data?.stripe_customer_id),
    trialAvailable: !data?.trial_used_at,
  }, { headers: { "Cache-Control": "no-store" } });
}
