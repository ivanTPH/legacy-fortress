import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminAccessState } from "./access.ts";
import { recordAdminAuditEvent } from "./audit.ts";
import { toAdminLifecycleSafeError } from "./lifecycleSecurity.ts";

type AnySupabaseClient = SupabaseClient;

export async function recordAdminLifecycleDenied(
  client: AnySupabaseClient,
  access: AdminAccessState,
  input: {
    attemptedAction: string;
    targetAdminUserId?: string | null;
    targetInvitationId?: string | null;
    targetEmail?: string | null;
    requestedRole?: string | null;
    reasonCode?: string | null;
    error?: unknown;
    route?: string;
  },
) {
  const safe = input.error ? toAdminLifecycleSafeError(input.error) : null;
  await recordAdminAuditEvent(client, access, {
    category: "restricted_action_blocked",
    action: "Admin user lifecycle denied",
    result: "blocked",
    resourceType: "access_policy",
    resourceId: input.targetAdminUserId ?? input.targetInvitationId ?? null,
    resourceLabel: input.targetEmail ?? null,
    route: input.route ?? "/api/internal/admin/admin-users",
    policyDecision: "blocked",
    metadata: {
      attempted_action: input.attemptedAction,
      target_admin_user_id_present: Boolean(input.targetAdminUserId),
      target_invitation_id_present: Boolean(input.targetInvitationId),
      requested_role: input.requestedRole ?? null,
      reason_code: input.reasonCode ?? safe?.code ?? "admin_lifecycle_denied",
      status: safe?.status ?? null,
    },
  }).catch(() => null);
}
