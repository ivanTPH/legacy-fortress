import { NextResponse } from "next/server";
import { requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { loadVaultFacts } from "@/lib/readiness/vaultFacts";

/**
 * GET — the facts the next-steps rule uses, for the signed-in owner's own Vault only (4 Nov 2026).
 * The app turns them into To do items with the same function the summary email uses.
 */
export async function GET(request: Request) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  const facts = await loadVaultFacts(access.admin, access.user.id);
  return NextResponse.json({ ok: true, facts }, { headers: { "Cache-Control": "no-store" } });
}
