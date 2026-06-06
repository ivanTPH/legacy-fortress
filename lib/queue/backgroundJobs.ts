import type { BackgroundJobEntity, ApiRequestContext } from "../backend/domainEntities.ts";
import { createAuditPipeline } from "../backend/auditPipeline.ts";

export type BackgroundJobType =
  | "audit_event_persist"
  | "document_preview_generate"
  | "report_export_blocked"
  | "campaign_send_blocked"
  | "billing_sync_placeholder"
  | "organisation_provision_placeholder";

export type BackgroundJobAdapter = {
  enqueue(job: Omit<BackgroundJobEntity, "id" | "createdAt" | "status">): Promise<BackgroundJobEntity>;
};

export const QUEUE_READINESS_CONTRACT = {
  currentAdapter: "disabled_in_process_preview",
  futureAdapters: ["durable_queue", "scheduled_worker", "dead_letter_queue"],
  allowedPrototypeJobs: ["report_export_blocked", "campaign_send_blocked", "billing_sync_placeholder"],
  rule: "Queue structure is ready, but exports, campaigns, billing sync, and provisioning stay disabled until governance, audit persistence, and provider adapters are live.",
} as const;

export function createDisabledBackgroundJobAdapter(context: ApiRequestContext): BackgroundJobAdapter {
  return {
    async enqueue(job) {
      await createAuditPipeline().record({
        category: job.type === "campaign_send_blocked" ? "campaign_outreach_blocked" : "restricted_action_blocked",
        action: `Blocked background job requested: ${job.type}`,
        result: "blocked",
        resource: { type: "access_policy", id: null, label: String(job.type) },
        context,
      });

      return {
        ...job,
        id: `blocked-${context.requestId}-${job.type}`,
        status: "blocked",
        createdAt: new Date().toISOString(),
      };
    },
  };
}

export function isQueueJobType(value: string): value is BackgroundJobType {
  return [
    "audit_event_persist",
    "document_preview_generate",
    "report_export_blocked",
    "campaign_send_blocked",
    "billing_sync_placeholder",
    "organisation_provision_placeholder",
  ].includes(value);
}
