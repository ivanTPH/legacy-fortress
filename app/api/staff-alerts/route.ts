import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { alertStaff } from "@/lib/admin/staffAlerts";

/**
 * POST { kind } after a signed-in person sends something that needs staff (owner decision 23 Nov 2026):
 * a Help message (Vault or Partner Portal) or a Power of Attorney for checking. The server checks the person
 * really sent one in the last 15 minutes, then alerts staff (at most once an hour per kind; names nothing).
 */
const RECENT_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const body = (await request.json().catch(() => ({}))) as { kind?: unknown };
    const since = new Date(Date.now() - RECENT_MS).toISOString();
    if (body.kind === "help_message") {
      const recent = await access.admin.from("section_entries").select("id", { count: "exact", head: true })
        .eq("user_id", access.user.id).eq("section_key", "support").eq("category_key", "help_requests").gte("created_at", since);
      if (!recent.count) return NextResponse.json({ ok: true, alerted: false });
      const result = await alertStaff(access.admin, "help_message", { source: "/api/staff-alerts" });
      return NextResponse.json({ ok: true, alerted: result.sent > 0 });
    }
    if (body.kind === "poa_check") {
      const recent = await access.admin.from("legal_authorities").select("id", { count: "exact", head: true })
        .eq("owner_user_id", access.user.id).in("status", ["pending_check", "needs_attention"]).gte("created_at", since);
      if (!recent.count) return NextResponse.json({ ok: true, alerted: false });
      const result = await alertStaff(access.admin, "poa_check", { source: "/api/staff-alerts" });
      return NextResponse.json({ ok: true, alerted: result.sent > 0 });
    }
    return NextResponse.json({ ok: false, error: "unknown_kind" }, { status: 400 });
  } catch (error) {
    return identityErrorResponse(error);
  }
}
