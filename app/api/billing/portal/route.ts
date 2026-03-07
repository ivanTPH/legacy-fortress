import { NextResponse } from "next/server";

export async function POST() {
  // Secure billing pattern entrypoint: this endpoint should create a server-side Stripe portal session.
  // It intentionally avoids exposing provider secrets in client code.
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_CUSTOMER_PORTAL_URL) {
    return NextResponse.json(
      { error: "Billing portal is not configured. Set STRIPE_SECRET_KEY and STRIPE_CUSTOMER_PORTAL_URL." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    url: process.env.STRIPE_CUSTOMER_PORTAL_URL,
  });
}
