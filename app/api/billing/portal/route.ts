import { NextResponse } from "next/server";
import { getStripeProviderReadiness } from "@/lib/billing/providerReadiness";

export async function POST() {
  // Secure billing pattern entrypoint: this endpoint should create a server-side Stripe portal session.
  // It intentionally avoids exposing provider secrets in client code.
  // Required server-side settings include STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and STRIPE_CUSTOMER_PORTAL_URL.
  const readiness = getStripeProviderReadiness();
  if (readiness.mode === "not_configured" || !process.env.STRIPE_CUSTOMER_PORTAL_URL) {
    return NextResponse.json(
      {
        error: "Billing portal is not configured. Set server-side Stripe settings before enabling billing actions.",
        missing: readiness.missingSecrets,
        readiness,
        nextStep: "Configure the Stripe server-side secrets, then retry from Billing and Account.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    url: process.env.STRIPE_CUSTOMER_PORTAL_URL,
  });
}
