import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { runSummaryEmails, verifySchedulerRequest } from "@/lib/summaryEmail/service";
import { sweepExpiredIdentityEvidence } from "@/lib/identity-verification/evidenceSweep";
import { purgeRecentlyDeleted } from "@/lib/records/recentlyDeleted";
import { alertStaffForAllWaiting } from "@/lib/admin/staffAlerts";
import { closeOldTestIdChecks } from "@/lib/admin/testIdChecks";

export const dynamic = "force-dynamic";

/** POST — daily jobs (signed scheduler request): delete expired ID evidence, empty Recently deleted after 30 days, then send due summary emails. Counts only. */
export async function POST(request: Request) {
  if (!verifySchedulerRequest(request)) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "admin_client_unavailable" }, { status: 503 });
  const evidence = await sweepExpiredIdentityEvidence(admin);
  const recentlyDeleted = await purgeRecentlyDeleted(admin);
  const summaries = await runSummaryEmails(admin);
  // TEST only: close ID checks left waiting by release checks, keeping the newest two to review (25 Nov 2026).
  const testIdChecks = await closeOldTestIdChecks(admin);
  // Staff reminder for anything still waiting for a person (23 Nov 2026); counts only, never blocks the run.
  const staff = (await alertStaffForAllWaiting(admin)).map((item) => ({ kind: item.kind, sent: item.sent, skipped: item.skipped ?? null }));
  const ok = evidence.ok && recentlyDeleted.ok && summaries.ok;
  return NextResponse.json({ ok, evidence, recentlyDeleted, summaries, testIdChecks, staff }, { status: ok ? 200 : 503 });
}
