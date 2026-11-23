import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { enquiryAllowed, saveEnquiry, validateEnquiry } from "@/lib/partners/enquiries";
import { alertStaff } from "@/lib/admin/staffAlerts";

export const dynamic = "force-dynamic";

/** POST — public "Become a partner" form (owner decision 23 Nov 2026). Validated, rate-limited, service role only. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const checked = validateEnquiry(body);
  if (!checked.ok) {
    // Spam (the hidden field was filled in) gets a normal-looking answer and is not saved.
    if (checked.message === "spam") return NextResponse.json({ ok: true });
    return NextResponse.json({ ok: false, message: checked.message }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, message: "This form isn’t available right now. Please email us instead." }, { status: 503 });
  const allowed = await enquiryAllowed(admin, checked.value.contactEmail);
  if (allowed.unavailable) return NextResponse.json({ ok: false, message: "This form isn’t available right now. Please email us instead." }, { status: 503 });
  if (!allowed.ok) return NextResponse.json({ ok: false, message: "We’ve already got your enquiry. We’ll be in touch soon." }, { status: 429 });
  const saved = await saveEnquiry(admin, checked.value);
  if (saved.error) return NextResponse.json({ ok: false, message: "That didn’t send. Please try again." }, { status: 503 });
  await alertStaff(admin, "partner_enquiry", { source: "/api/partners/enquiry" });
  return NextResponse.json({ ok: true });
}
