import {
  buildAuditPersistenceEnvelope,
  createPrototypeAuditEvent,
  type AuditEventCategory,
  type AuditPersistenceAdapter,
  type AuditPersistenceEnvelope,
  type PlatformAuditEvent,
} from "../audit/auditEvents.ts";
import type { ApiRequestContext } from "./domainEntities.ts";

export type AuditPipelineMode = "preview_only" | "queue_ready" | "persistent";

export type AuditPipelineEventInput = {
  category: AuditEventCategory;
  action: string;
  result: PlatformAuditEvent["result"];
  resource: PlatformAuditEvent["resource"];
  context: ApiRequestContext;
  actorOverride?: Partial<PlatformAuditEvent["actor"]>;
};

export type AuditPipeline = {
  mode: AuditPipelineMode;
  record(input: AuditPipelineEventInput): Promise<{ queued: boolean; stored: boolean; event: PlatformAuditEvent; persistence: AuditPersistenceEnvelope }>;
};

export const auditPipelineReadiness = {
  currentMode: "preview_only",
  queueReady: true,
  futureAdapters: ["append_only_database", "durable_queue", "security_event_sink"],
  rule: "Every restricted, export, document, consent, billing, and campaign action should pass through this pipeline before production enablement.",
} as const;

export function createAuditPipeline(adapter?: AuditPersistenceAdapter | null): AuditPipeline {
  return {
    mode: adapter ? "queue_ready" : "preview_only",
    async record(input) {
      const principal = input.context.principal;
      const event = createPrototypeAuditEvent({
        id: `${input.category}-${input.context.requestId}`,
        category: input.category,
        actor: {
          id: principal?.userId ?? null,
          type: principal?.roles.includes("super_admin") || principal?.roles.includes("probate_admin") ? "admin" : "user",
          displayName: principal?.email ?? "System preview",
          role: principal?.roles[0] ?? null,
          ...input.actorOverride,
        },
        action: input.action,
        result: input.result,
        policyDecision: input.context.governance?.policyDecision,
        resource: input.resource,
        context: {
          surface: input.context.route,
          route: input.context.route,
        },
        governance: input.context.governance,
      });

      if (!adapter) {
        return { queued: false, stored: false, event, persistence: buildAuditPersistenceEnvelope(event) };
      }

      const persistence = buildAuditPersistenceEnvelope(event);
      if (persistence.storageMode !== "ready_for_append_only") {
        return { queued: false, stored: false, event, persistence };
      }

      const write = await adapter.recordEvent(event);
      return { queued: true, stored: write.stored, event, persistence };
    },
  };
}

export function buildRestrictedActionAuditPreview(context: ApiRequestContext, action: string) {
  return createAuditPipeline().record({
    category: "restricted_action_blocked",
    action,
    result: "blocked",
    resource: { type: "access_policy", id: null, label: "Role or consent policy" },
    context: {
      ...context,
      governance: {
        ...context.governance,
        consentChecked: true,
        exportEnabled: false,
        restrictedReason: "Production role, consent, or audit requirements are not satisfied.",
      },
    },
  });
}
