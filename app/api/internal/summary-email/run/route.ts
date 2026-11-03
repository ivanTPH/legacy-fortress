import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { runSummaryEmails, verifySchedulerRequest } from "@/lib/summaryEmail/service";

export const dynamic = "force-dynamic";

/** POST — daily scheduler run (signed with the server's key; the key is never sent). Returns counts only. */
export async function POST(request: Request) {
  if (!verifySchedulerRequest(request)) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "admin_client_unavailable" }, { status: 503 });
  const result = await runSummaryEmails(admin);
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
