import { NextResponse } from "next/server";
import { requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { reuseExistingVerification } from "@/lib/identity-verification/service";

/** POST { accessGrantId } — use the person's existing ID check for their own pending linked access. */
export async function POST(request: Request) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  const body = (await request.json().catch(() => ({}))) as { accessGrantId?: string };
  const grantId = String(body.accessGrantId ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(grantId)) return NextResponse.json({ ok: false, error: "invalid_grant" }, { status: 400 });
  try {
    const result = await reuseExistingVerification(access.admin, access.user.id, grantId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "reuse_failed";
    return NextResponse.json({ ok: false, error: code }, { status: code === "linked_access_context_mismatch" ? 403 : 500 });
  }
}
