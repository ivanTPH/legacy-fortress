import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { listDeathReportsForAdmin, listEstateClaimsForAdmin } from "@/lib/estate-lifecycle/service";

export async function GET(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "verification:read");
  if (denied) return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });

  const [deathReports, estateClaims] = await Promise.all([
    listDeathReportsForAdmin(admin.adminClient),
    listEstateClaimsForAdmin(admin.adminClient),
  ]);
  return NextResponse.json({
    ok: true,
    deathReports: deathReports.map((report) => ({
      id: report.id,
      ownerUserId: report.owner_user_id,
      claimantUserId: report.claimant_user_id,
      claimantRole: report.claimant_role,
      status: report.status,
      dateOfDeath: report.date_of_death,
      submittedAt: report.submitted_at,
      reviewedAt: report.reviewed_at,
      vaultStateAtReport: report.vault_state_at_report,
    })),
    estateClaims: estateClaims.map((claim) => ({
      id: claim.id,
      deathReportId: claim.death_report_id,
      ownerUserId: claim.owner_user_id,
      claimantUserId: claim.claimant_user_id,
      roleClaimed: claim.role_claimed,
      status: claim.status,
      authorityEvidenceStatus: claim.authority_evidence_status,
      approvedAt: claim.approved_at,
      suspendedAt: claim.suspended_at,
      revokedAt: claim.revoked_at,
    })),
  });
}
