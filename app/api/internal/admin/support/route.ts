import { NextResponse } from "next/server";
import { includeTestsFrom, loadAccounts, withoutTests } from "@/lib/admin/testAccounts";
import { loadSupportSnapshot } from "@/lib/admin/operations";
import { withoutInviteeIdentity } from "@/lib/admin/inviteePrivacy";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";

export async function GET(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "support:read");
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }

  const raw = await loadSupportSnapshot(admin.adminClient, { includeTests: includeTestsFrom(request), testIds: (await loadAccounts(admin.adminClient)).testIds });
  // Invited people stay unnamed until they create an account (owner decision 16 Nov 2026).
  return NextResponse.json({ ok: true, support: { ...raw, issues: raw.issues.map(withoutInviteeIdentity) } });
}
