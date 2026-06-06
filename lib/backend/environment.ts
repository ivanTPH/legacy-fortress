export type RuntimeEnvironment = "development" | "preview" | "staging" | "production" | "test";

export type EnvironmentCapability =
  | "mock_personas"
  | "prototype_admin"
  | "live_api"
  | "live_auth"
  | "live_billing"
  | "queue_workers"
  | "audit_persistence";

export type EnvironmentReadiness = {
  environment: RuntimeEnvironment;
  enabled: EnvironmentCapability[];
  disabled: EnvironmentCapability[];
  requiredSecrets: string[];
  missingSecrets: string[];
};

export const ENVIRONMENT_SEPARATION_RULES = {
  production: [
    "Mock personas must be hidden unless explicitly enabled for a private staging domain.",
    "Admin access must use trusted provider role claims, not query parameters.",
    "Billing actions must stay server-side and must not expose provider data.",
  ],
  nonProduction: [
    "Prototype routes may use static adapters with clear labelling.",
    "Test personas may preview roles without replacing real authentication.",
    "Queue and audit adapters may run in preview-only mode.",
  ],
} as const;

export function getRuntimeEnvironment(input: {
  nodeEnv?: string | null;
  vercelEnv?: string | null;
  appEnv?: string | null;
} = {}): RuntimeEnvironment {
  const explicit = String(input.appEnv ?? process.env.LEGACY_FORTRESS_ENV ?? "").toLowerCase();
  if (explicit === "staging" || explicit === "production" || explicit === "preview" || explicit === "test") return explicit;
  if (input.nodeEnv === "test" || process.env.NODE_ENV === "test") return "test";
  const vercel = String(input.vercelEnv ?? process.env.VERCEL_ENV ?? "").toLowerCase();
  if (vercel === "production") return "production";
  if (vercel === "preview") return "preview";
  if ((input.nodeEnv ?? process.env.NODE_ENV) === "production") return "production";
  return "development";
}

export function isProductionLikeEnvironment(environment = getRuntimeEnvironment()) {
  return environment === "production" || environment === "staging";
}

export function getEnvironmentReadiness(environment = getRuntimeEnvironment()): EnvironmentReadiness {
  const productionLike = isProductionLikeEnvironment(environment);
  const requiredSecrets = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
    "AUTH_PROVIDER_ISSUER",
    "AUTH_PROVIDER_JWKS_URL",
  ];
  const enabled: EnvironmentCapability[] = productionLike
    ? ["live_api", "live_auth", "live_billing", "queue_workers", "audit_persistence"]
    : ["mock_personas", "prototype_admin"];
  const disabled = ([
    "mock_personas",
    "prototype_admin",
    "live_api",
    "live_auth",
    "live_billing",
    "queue_workers",
    "audit_persistence",
  ] as EnvironmentCapability[]).filter((capability) => !enabled.includes(capability));

  return {
    environment,
    enabled,
    disabled,
    requiredSecrets,
    missingSecrets: requiredSecrets.filter((key) => !process.env[key]),
  };
}

export function shouldExposeTestPersonaRoutes(environment = getRuntimeEnvironment()) {
  return !isProductionLikeEnvironment(environment) || process.env.ENABLE_INTERNAL_TEST_LOGIN === "true";
}
