import { NextResponse } from "next/server";
import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { listAssignableAdmins } from "@/lib/admin/assignees";

/** GET ?for=verification — registered admins an ID check can be assigned to (only those allowed to review). */
export async function GET(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) return NextResponse.json({ ok: false, message: admin.message }, { status: admin.status });
  const kind = new URL(request.url).searchParams.get("for");
  if (kind !== "verification") return NextResponse.json({ ok: false, message: "Unknown case type." }, { status: 400 });
  const denied = requireAdminCapability(admin.access, "verification:review");
  if (denied) return NextResponse.json({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  try {
    return NextResponse.json({ ok: true, assignees: await listAssignableAdmins(admin.adminClient, "verification:review") });
  } catch {
    return NextResponse.json({ ok: false, message: "The list of admins couldn’t be loaded." }, { status: 503 });
  }
}
