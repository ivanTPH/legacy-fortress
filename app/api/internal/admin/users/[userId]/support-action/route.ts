import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { cleanReason, isSupportAction, REASON_MIN, runSupportAction, SUPPORT_ACTION_COPY } from "@/lib/admin/supportActions";

export const dynamic = "force-dynamic";

/**
 * POST { action, reason } — a support action on one customer's account (owner decision 20 Nov 2026).
 * Needs support:manage and audit:write; the reason is required and kept in the audit log; at most 3 of one
 * action on one account per hour.
 */
export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) return json({ ok: false, message: admin.message }, admin.status);
  for (const capability of ["support:manage", "audit:write"] as const) {
    const denied = requireAdminCapability(admin.access, capability);
    if (denied) return json({ ok: false, message: denied.message, capability: denied.capability }, denied.status);
  }
  const { userId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ ok: false, message: "That account couldn’t be found." }, 400);
  const body = (await request.json().catch(() => ({}))) as { action?: unknown; reason?: unknown };
  if (!isSupportAction(body.action)) return json({ ok: false, message: "That action isn’t available." }, 400);
  const reason = cleanReason(body.reason);
  if (reason.length < REASON_MIN) return json({ ok: false, message: "Write a short reason first (it goes in the audit log)." }, 400);
  if (userId === admin.access.user.id) return json({ ok: false, message: "Use your own Settings for your account." }, 409);

  const copy = SUPPORT_ACTION_COPY[body.action];
  const since = new Date(Date.now() - 3600_000).toISOString();
  const recent = await admin.adminClient.from("audit_events").select("id", { count: "exact", head: true })
    .eq("action", copy.audit).eq("resource_id", userId).eq("result", "success").gte("created_at", since);
  const result = await runSupportAction(admin.adminClient, { userId, action: body.action, recentCount: recent.count ?? 0 });

  await recordAdminAuditEvent(admin.adminClient, admin.access, {
    category: "admin_review",
    action: copy.audit,
    result: result.ok ? "success" : "rejected",
    resourceType: "access_policy",
    resourceId: userId,
    resourceLabel: "Customer account",
    route: `/api/internal/admin/users/${userId}/support-action`,
    metadata: {
      reason,
      ...(result.ok ? { emailed: result.emailed, sessions_ended: result.sessionsEnded ?? null } : { refused: result.message }),
      private_vault_contents_exposed: false,
    },
  }).catch(() => null);

  if (!result.ok) return json({ ok: false, message: result.message }, result.status);
  return json({ ok: true, message: result.message, emailed: result.emailed });
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
