import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { loadLegalAuthorities } from "@/lib/admin/legalAuthorities";
import { findCaseCheck } from "@/lib/identity-verification/service";

export async function GET(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }
  const denied = requireAdminCapability(admin.access, "verification:read");
  if (denied) {
    return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }
  const loaded = await loadLegalAuthorities(admin.adminClient);
  // Attach the attorney's fresh ID check where activation is still to be decided.
  const authorities = await Promise.all(loaded.map(async (item) => item.status === "confirmed" && !item.activatedAt || item.status === "pending_check" || item.status === "needs_attention"
    ? { ...item, freshCheck: await findCaseCheck(admin.adminClient, "legal_authority", item.id) }
    : item));
  return NextResponse.json({ ok: true, authorities });
}
