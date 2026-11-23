import { NextResponse } from "next/server";
import { adminHasCapability, requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { ENQUIRY_STATUSES } from "@/lib/partners/enquiries";

/** POST { id, status } — move a partner enquiry along (23 Nov 2026). Needs enterprise licence management; audited. */
export async function POST(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) return NextResponse.json({ ok: false, message: admin.message }, { status: admin.status });
  // Platform staff only: a partner's own admins never see these (23 Nov 2026).
  if (admin.access.enterpriseScope?.organisationScoped) return NextResponse.json({ ok: false, message: "Not available." }, { status: 403 });
  const denied = requireAdminCapability(admin.access, "enterprise.licence.manage");
  if (denied) return NextResponse.json({ ok: false, message: denied.message }, { status: denied.status });
  const body = (await request.json().catch(() => ({}))) as { id?: unknown; status?: unknown };
  const id = String(body.id ?? "");
  const status = String(body.status ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(ENQUIRY_STATUSES as readonly string[]).includes(status)) return NextResponse.json({ ok: false, message: "That change isn’t valid." }, { status: 400 });
  const update = await admin.adminClient.from("partner_enquiries").update({ status, handled_by: admin.access.user.id, updated_at: new Date().toISOString() }).eq("id", id).select("id").maybeSingle();
  if (update.error || !update.data) return NextResponse.json({ ok: false, message: "That enquiry couldn’t be updated." }, { status: 404 });
  if (adminHasCapability(admin.access, "audit:write")) {
    await recordAdminAuditEvent(admin.adminClient, admin.access, { category: "admin_review", action: "Partner enquiry status changed", result: "success", resourceType: "organisation", resourceId: id, resourceLabel: "Partner enquiry", route: "/api/internal/admin/partner-enquiries", metadata: { status } }).catch(() => null);
  }
  return NextResponse.json({ ok: true });
}
