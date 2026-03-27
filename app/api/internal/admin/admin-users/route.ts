import { NextResponse } from "next/server";
import { addAdminUser, listAdminUsers } from "@/lib/admin/operations";
import { requireAdminAccess } from "@/lib/admin/access";

export async function GET(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }

  const admins = await listAdminUsers(admin.adminClient);
  return NextResponse.json({ ok: true, admins });
}

export async function POST(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return NextResponse.json({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = String(body.email ?? "").trim();
  if (!email) {
    return NextResponse.json({ ok: false, message: "Admin email is required." }, { status: 400 });
  }

  const saved = await addAdminUser(admin.adminClient, {
    email,
    grantedByUserId: admin.access.user.id,
  });
  const admins = await listAdminUsers(admin.adminClient);
  return NextResponse.json({ ok: true, admin: saved, admins });
}

