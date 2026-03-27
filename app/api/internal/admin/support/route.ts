import { NextResponse } from "next/server";
import { loadSupportSnapshot } from "@/lib/admin/operations";
import { requireAdminAccess } from "@/lib/admin/access";

export async function GET(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }

  const support = await loadSupportSnapshot(admin.adminClient);
  return NextResponse.json({ ok: true, support });
}

