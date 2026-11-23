import { NextResponse } from "next/server";
import { adminHasCapability, requireAdminAccess } from "@/lib/admin/access";
import { countWaiting, STAFF_ALERT_KINDS, type StaffAlertKind } from "@/lib/admin/staffAlerts";

export const dynamic = "force-dynamic";

/**
 * GET — how many things are waiting for this admin (owner decision 23 Nov 2026): the red count on Admin's Inbox.
 * Only kinds this admin's role can deal with; counts only.
 */
export async function GET(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) return NextResponse.json({ ok: false, message: admin.message }, { status: admin.status });
  // Platform staff only: a partner's own admins never see these (23 Nov 2026).
  if (admin.access.enterpriseScope?.organisationScoped) return NextResponse.json({ ok: false, message: "Not available." }, { status: 403 });
  const kinds = (Object.keys(STAFF_ALERT_KINDS) as StaffAlertKind[]).filter((kind) => adminHasCapability(admin.access, STAFF_ALERT_KINDS[kind].capability));
  const counts = await Promise.all(kinds.map(async (kind) => [kind, await countWaiting(admin.adminClient, kind)] as const));
  const byKind = Object.fromEntries(counts);
  const total = counts.reduce((sum, [, n]) => sum + n, 0);
  return NextResponse.json({ ok: true, total, byKind }, { headers: { "Cache-Control": "no-store" } });
}
