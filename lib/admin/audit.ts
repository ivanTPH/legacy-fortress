import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminAccessState } from "./access.ts";
import type { AuditEventCategory, AuditEventResult, AuditResourceType } from "../audit/auditEvents.ts";

type AnySupabaseClient = SupabaseClient;

export type AdminAuditInput = {
  category: AuditEventCategory;
  action: string;
  result: AuditEventResult;
  resourceType: AuditResourceType;
  resourceId?: string | null;
  resourceLabel?: string | null;
  route: string;
  policyDecision?: "allowed" | "blocked";
  metadata?: Record<string, unknown>;
};

export async function recordAdminAuditEvent(
  client: AnySupabaseClient,
  access: AdminAccessState,
  input: AdminAuditInput,
) {
  const now = new Date().toISOString();
  const insert = await client
    .from("audit_events")
    .insert({
      category: input.category,
      action: input.action,
      result: input.result,
      actor_user_id: access.user.id,
      actor_email_normalized: access.emailNormalized,
      actor_role: access.adminRole,
      resource_type: input.resourceType,
      resource_id: input.resourceId ?? null,
      resource_label: input.resourceLabel ?? null,
      route: input.route,
      policy_decision: input.policyDecision ?? (input.result === "blocked" ? "blocked" : "allowed"),
      metadata: input.metadata ?? {},
      created_at: now,
    })
    .select("id")
    .single();

  if (insert.error) {
    throw new Error(insert.error.message);
  }

  return String(insert.data?.id ?? "");
}
