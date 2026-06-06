import { PLATFORM_API_CONTRACTS } from "./apiContracts.ts";
import { auditPipelineReadiness } from "./auditPipeline.ts";
import { DOMAIN_ENTITY_CONTRACTS } from "./domainEntities.ts";
import { getEnvironmentReadiness } from "./environment.ts";
import { PERSISTENCE_ADAPTERS } from "./persistence.ts";
import { roleMiddlewareReadiness } from "./rbacMiddleware.ts";
import { sessionLifecycleReadiness } from "./sessionLifecycle.ts";
import { CANONICAL_STORAGE_BOUNDARY } from "../storage/canonicalStorage.ts";
import { QUEUE_READINESS_CONTRACT } from "../queue/backgroundJobs.ts";
import { STRIPE_INTEGRATION_READINESS } from "../billing/providerReadiness.ts";

export const PLATFORM_FOUNDATION_ARCHITECTURE = {
  layers: [
    "UI surfaces",
    "typed API contracts",
    "repository/service boundaries",
    "persistence adapters",
    "governance/audit pipeline",
    "auth/session role context",
    "canonical storage",
    "queue-ready background processing",
    "provider adapters",
  ],
  flow: "UI -> API contract -> service/repository -> persistence/storage/provider adapter -> audit pipeline -> governance checks",
  rule: "Live providers remain disabled until trusted auth, audit persistence, migrations, and environment secrets are production-ready.",
} as const;

export function getPlatformFoundationReport() {
  return {
    architecture: PLATFORM_FOUNDATION_ARCHITECTURE,
    entities: DOMAIN_ENTITY_CONTRACTS,
    apiContracts: PLATFORM_API_CONTRACTS,
    persistenceAdapters: PERSISTENCE_ADAPTERS,
    audit: auditPipelineReadiness,
    environment: getEnvironmentReadiness(),
    session: sessionLifecycleReadiness,
    rbac: roleMiddlewareReadiness,
    storage: CANONICAL_STORAGE_BOUNDARY,
    queue: QUEUE_READINESS_CONTRACT,
    billing: STRIPE_INTEGRATION_READINESS,
    migrationBlockers: [
      "Backfill legacy section_entries and record_contacts into canonical repositories.",
      "Replace prototype role context with trusted provider claims.",
      "Provision append-only audit persistence before enabling exports/campaigns.",
      "Connect Stripe only through server-side adapter and webhook verification.",
      "Promote document signed URL and metadata writes behind API/RPC boundaries.",
    ],
  };
}
