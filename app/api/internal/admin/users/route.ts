import { NextResponse } from "next/server";
import { lookupUsers } from "@/lib/admin/operations";
import { requireAdminAccess } from "@/lib/admin/access";

export async function GET(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const users = await lookupUsers(admin.adminClient, query);
  return NextResponse.json({ ok: true, users });
}

