import { NextResponse } from "next/server";
import { loadAuditHistory, normalizeAuditHistoryLimit } from "@/lib/admin/operations";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";

export async function GET(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }

  const denied = requireAdminCapability(admin.access, "audit:read");
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }

  const url = new URL(request.url);
  const limit = normalizeAuditHistoryLimit(url.searchParams.get("limit"));
  const events = await loadAuditHistory(admin.adminClient, limit);
  return NextResponse.json({ ok: true, events, limit });
}
