import type { ApiRequestContext, LicenceEntity } from "../backend/domainEntities.ts";

export type BillingProvider = "stripe";

export type BillingProviderMode = "not_configured" | "test_ready" | "production_ready";

export type BillingProviderReadiness = {
  provider: BillingProvider;
  mode: BillingProviderMode;
  requiredSecrets: string[];
  missingSecrets: string[];
  supportedOperations: string[];
  disabledOperations: string[];
};

export type BillingServiceContract = {
  createPortalSession(context: ApiRequestContext): Promise<{ url: string }>;
  syncLicence(context: ApiRequestContext, licence: LicenceEntity): Promise<{ synced: boolean }>;
};

export const STRIPE_INTEGRATION_READINESS = {
  provider: "stripe",
  boundary: "server-side billing service only",
  forbiddenClientData: ["secret keys", "customer payment methods", "invoice exports", "webhook signing secrets"],
  futureEvents: ["customer.subscription.updated", "invoice.payment_failed", "checkout.session.completed"],
  rule: "Prototype billing actions stay disabled unless a server-side Stripe adapter and webhook processing are configured.",
} as const;

export function getStripeProviderReadiness(env: NodeJS.ProcessEnv = process.env): BillingProviderReadiness {
  const requiredSecrets = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_CUSTOMER_PORTAL_URL"];
  const missingSecrets = requiredSecrets.filter((key) => !env[key]);
  const mode: BillingProviderMode = missingSecrets.length === 0
    ? env.NODE_ENV === "production"
      ? "production_ready"
      : "test_ready"
    : "not_configured";

  return {
    provider: "stripe",
    mode,
    requiredSecrets,
    missingSecrets,
    supportedOperations: mode === "not_configured" ? [] : ["create_portal_session", "receive_webhook", "sync_licence_state"],
    disabledOperations: ["client_side_checkout_secret_access", "prototype_invoice_export", "unrestricted_billing_admin"],
  };
}
