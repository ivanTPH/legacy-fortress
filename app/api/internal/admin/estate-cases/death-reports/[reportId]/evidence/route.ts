import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { findCaseCheck } from "@/lib/identity-verification/service";

/**
 * Death report evidence for the release reviewer: the death certificate and other files as
 * 60-second links, plus the reporter's fresh ID check. Decide role only; every view is recorded.
 */
export async function GET(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) return NextResponse.json({ ok: false, message: admin.message }, { status: admin.status });
  const denied = requireAdminCapability(admin.access, "verification:decide");
  if (denied) return NextResponse.json({ ok: false, message: denied.message }, { status: denied.status });
  const { reportId } = await params;
  const report = await admin.adminClient.from("death_reports").select("id,owner_user_id,claimant_user_id,claimant_role,relationship,status,date_of_death,submitted_at").eq("id", reportId).maybeSingle();
  if (report.error || !report.data) return NextResponse.json({ ok: false, message: "Death report not found." }, { status: 404 });
  const evidence = await admin.adminClient.from("death_report_evidence").select("id,evidence_type,file_name,mime_type,storage_bucket,storage_path,created_at").eq("death_report_id", reportId).is("deleted_at", null).order("created_at", { ascending: false });
  const files = await Promise.all((evidence.data ?? []).map(async (row) => {
    const signed = await admin.adminClient.storage.from(row.storage_bucket).createSignedUrl(row.storage_path, 60);
    return { id: row.id, type: row.evidence_type, fileName: row.file_name, mimeType: row.mime_type, addedAt: row.created_at, url: signed.error ? null : signed.data?.signedUrl ?? null };
  }));
  const reporter = await admin.adminClient.from("user_profiles").select("display_name").eq("user_id", report.data.claimant_user_id).maybeSingle();
  const check = await findCaseCheck(admin.adminClient, "death_report", reportId);
  await recordAdminAuditEvent(admin.adminClient, admin.access, {
    category: "admin_review",
    action: "Death report evidence viewed",
    result: "success",
    resourceType: "verification",
    resourceId: reportId,
    route: "/api/internal/admin/estate-cases/death-reports/[reportId]/evidence",
    metadata: { file_count: files.length, fresh_check_present: Boolean(check), expires_in_seconds: 60 },
  });
  return NextResponse.json({
    ok: true,
    report: { id: report.data.id, status: report.data.status, reporterName: reporter.data?.display_name ?? "Reporter", role: report.data.claimant_role, relationship: report.data.relationship, dateOfDeath: report.data.date_of_death, submittedAt: report.data.submitted_at },
    files,
    check,
  }, { headers: { "cache-control": "no-store" } });
}
