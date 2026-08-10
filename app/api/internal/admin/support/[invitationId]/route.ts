import { adminHasCapability, requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import {
  loadSupportInvitationDetail,
  resendSupportInvitation,
  revokeSupportInvitation,
} from "@/lib/admin/operations";
import {
  adminLifecycleError,
  checkAdminLifecycleRateLimit,
  getRequestSourceIp,
  noStoreJson,
  safeAdminErrorResponse,
} from "@/lib/admin/lifecycleSecurity";

export async function GET(request: Request, { params }: { params: Promise<{ invitationId: string }> }) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return noStoreJson({ ok: false, code: admin.status === 401 ? "ADMIN_AUTH_REQUIRED" : "ADMIN_PERMISSION_DENIED", message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "support:read");
  if (denied) {
    return noStoreJson({ ok: false, code: "ADMIN_PERMISSION_DENIED", message: denied.message, capability: denied.capability }, { status: denied.status });
  }

  try {
    const { invitationId } = await params;
    const detail = await loadSupportInvitationDetail(admin.adminClient, invitationId);
    return noStoreJson({ ok: true, detail });
  } catch (error) {
    return safeAdminErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ invitationId: string }> }) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return noStoreJson({ ok: false, code: admin.status === 401 ? "ADMIN_AUTH_REQUIRED" : "ADMIN_PERMISSION_DENIED", message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "support:manage");
  const { invitationId } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: string; reason?: string | null };
  const action = String(body.action ?? "").trim();

  if (denied) {
    if (adminHasCapability(admin.access, "audit:write")) {
      await recordAdminAuditEvent(admin.adminClient, admin.access, {
        category: "restricted_action_blocked",
        action: "Contact invitation lifecycle denied",
        result: "blocked",
        resourceType: "access_policy",
        resourceId: invitationId,
        resourceLabel: "Contact invitation",
        route: "/api/internal/admin/support/[invitationId]",
        metadata: {
          requested_action: action || "unknown",
          reason_code: "missing_support_manage_capability",
        },
      }).catch(() => undefined);
    }
    return noStoreJson({ ok: false, code: "ADMIN_PERMISSION_DENIED", message: denied.message, capability: denied.capability }, { status: denied.status });
  }

  if (action !== "resend" && action !== "revoke") {
    return safeAdminErrorResponse(adminLifecycleError("ADMIN_INVALID_STATUS", "invalid_support_invitation_action"));
  }

  const rate = checkAdminLifecycleRateLimit({
    actorId: admin.access.user.id,
    sourceIp: getRequestSourceIp(request),
    route: "/api/internal/admin/support/[invitationId]",
    action,
  });
  if (!rate.ok) {
    return safeAdminErrorResponse(adminLifecycleError("ADMIN_RATE_LIMITED", "support_invitation_lifecycle_rate_limit"));
  }

  try {
    const origin = new URL(request.url).origin;
    const detail = action === "resend"
      ? await resendSupportInvitation(admin.adminClient, invitationId, origin)
      : await revokeSupportInvitation(admin.adminClient, invitationId, body.reason ?? null);

    await recordAdminAuditEvent(admin.adminClient, admin.access, {
      category: "admin_approval",
      action: action === "resend" ? "Contact invitation resent" : "Contact invitation revoked",
      result: "success",
      resourceType: "access_policy",
      resourceId: invitationId,
      resourceLabel: detail.invitation.contactEmail || detail.invitation.contactName,
      route: "/api/internal/admin/support/[invitationId]",
      metadata: {
        action,
        invitation_status: detail.invitation.invitationStatus,
        activation_status: detail.invitation.activationStatus,
        reason_present: Boolean(String(body.reason ?? "").trim()),
      },
    });

    return noStoreJson({ ok: true, detail });
  } catch (error) {
    await recordAdminAuditEvent(admin.adminClient, admin.access, {
      category: "restricted_action_blocked",
      action: "Contact invitation lifecycle blocked",
      result: "blocked",
      resourceType: "access_policy",
      resourceId: invitationId,
      resourceLabel: "Contact invitation",
      route: "/api/internal/admin/support/[invitationId]",
      metadata: {
        requested_action: action,
        reason_code: error instanceof Error ? error.message : "support_invitation_lifecycle_failed",
      },
    }).catch(() => undefined);
    return safeAdminErrorResponse(error);
  }
}
