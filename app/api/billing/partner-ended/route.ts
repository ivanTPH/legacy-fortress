import { NextResponse } from "next/server";
import { requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { acknowledgePartnerEnded } from "@/lib/billing/partnerPlan";

/** POST — the member chooses to stay on Free after their organisation's licence ended (18 Nov 2026). */
export async function POST(request: Request) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    await acknowledgePartnerEnded(access.admin, access.user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: "That couldn’t be saved. Please try again." }, { status: 503 });
  }
}
