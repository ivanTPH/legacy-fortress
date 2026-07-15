import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { getProbateCase } from "@/lib/admin/probateCases";

export async function GET(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "verification:read");
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }

  const { caseId } = await params;
  const probateCase = await getProbateCase(admin.adminClient, caseId);
  return NextResponse.json({ ok: true, case: probateCase });
}
