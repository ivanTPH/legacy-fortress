import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { createEstateCase } from "@/lib/estate-administration/service";

export async function POST(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  const denied = requireAdminCapability(admin.access, "estate_case_review");
  if (denied) return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  const body = (await request.json().catch(() => ({}))) as { ownerUserId?: string; deathReportId?: string; probateCaseId?: string; reason?: string; status?: "open" | "administration_active" };
  const reason = String(body.reason ?? "").trim();
  if (!body.ownerUserId || !reason) return NextResponse.json({ ok: false, message: "ownerUserId and reason are required." }, { status: 400 });
  const estateCase = await createEstateCase(admin.adminClient, {
    ownerUserId: body.ownerUserId,
    deathReportId: body.deathReportId ?? null,
    probateCaseId: body.probateCaseId ?? null,
    openedByUserId: admin.access.user.id,
    status: body.status,
    reason,
  });
  await recordAdminAuditEvent(admin.adminClient, admin.access, {
    category: "admin_approval",
    action: "Estate case opened",
    result: "success",
    resourceType: "verification",
    resourceId: estateCase.id,
    resourceLabel: estateCase.case_reference,
    route: "/api/internal/admin/estate-cases/create",
    metadata: { estate_case_id: estateCase.id, owner_user_id: estateCase.owner_user_id, reason_present: true },
  });
  return NextResponse.json({ ok: true, estateCase }, { status: 201 });
}
