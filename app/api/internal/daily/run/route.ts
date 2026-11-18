import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { runSummaryEmails, verifySchedulerRequest } from "@/lib/summaryEmail/service";
import { sweepExpiredIdentityEvidence } from "@/lib/identity-verification/evidenceSweep";
import { purgeRecentlyDeleted } from "@/lib/records/recentlyDeleted";

export const dynamic = "force-dynamic";

/** POST — daily jobs (signed scheduler request): delete expired ID evidence, empty Recently deleted after 30 days, then send due summary emails. Counts only. */
export async function POST(request: Request) {
  if (!verifySchedulerRequest(request)) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "admin_client_unavailable" }, { status: 503 });
  const evidence = await sweepExpiredIdentityEvidence(admin);
  const recentlyDeleted = await purgeRecentlyDeleted(admin);
  const summaries = await runSummaryEmails(admin);
  const ok = evidence.ok && recentlyDeleted.ok && summaries.ok;
  return NextResponse.json({ ok, evidence, recentlyDeleted, summaries }, { status: ok ? 200 : 503 });
}
