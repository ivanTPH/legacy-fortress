import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { isDeliverableAddress } from "@/lib/identity-verification/resultEmail";
import { validateStagingSender } from "@/lib/auth/sendEmailHook";

/**
 * POST { linkId } — "Tell <name>" after linking someone who has joined to a record (owner decision
 * 2 Nov 2026: ask each time, no detail). The database function checks the caller owns the link and
 * writes a content-free notification; then a content-free email is sent. Nothing is shared.
 */
export async function POST(request: Request) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  const body = (await request.json().catch(() => ({}))) as { linkId?: string };
  const linkId = String(body.linkId ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(linkId)) return NextResponse.json({ ok: false, error: "invalid_link" }, { status: 400 });

  // Run as the signed-in owner so the database decides whether they may tell this person.
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const asOwner = createClient(String(process.env.NEXT_PUBLIC_SUPABASE_URL), String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const told = await asOwner.rpc("lf_tell_linked_person", { p_link_id: linkId });
  if (told.error) return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 });
  if (!told.data) return NextResponse.json({ ok: true, told: false });

  // Email: owner's name only. Never the record, its type, the role or anything shared.
  let emailed = false;
  const apiKey = String(process.env.RESEND_API_KEY ?? "").trim();
  const link = await access.admin.from("record_links").select("person_id").eq("id", linkId).eq("owner_user_id", access.user.id).maybeSingle();
  const contact = link.data ? await access.admin.from("contacts").select("linked_user_id").eq("id", link.data.person_id).eq("owner_user_id", access.user.id).maybeSingle() : null;
  const recipientId = contact?.data?.linked_user_id ?? null;
  if (apiKey && recipientId) {
    const [recipient, profile] = await Promise.all([
      access.admin.auth.admin.getUserById(recipientId),
      access.admin.from("user_profiles").select("display_name").eq("user_id", access.user.id).maybeSingle(),
    ]);
    const email = recipient.data.user?.email ?? null;
    const ownerName = String(profile.data?.display_name ?? "").trim() || "Someone you’re connected with";
    if (isDeliverableAddress(email)) {
      const appUrl = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://test.mylegacyfortress.com").replace(/\/$/, "");
      const text = `${ownerName} has added you to one of their records in Legacy Fortress.\n\nNothing new is shared with you. If ${ownerName.split(/\s+/)[0]} chooses to share something, you'll be told.\n\nSee your notifications: ${appUrl}/notifications`;
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `lf-link-told/${linkId}/${Math.floor(Date.now() / 60000)}` },
        body: JSON.stringify({ from: validateStagingSender(String(process.env.RESEND_AUTH_FROM ?? "")), to: [email], subject: `${ownerName} added you to a record`, text, html: text.split("\n\n").map((part) => `<p>${part.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/(https:\/\/\S+)/, '<a href="$1">$1</a>')}</p>`).join("") }),
      }).catch(() => null);
      emailed = Boolean(response?.ok);
    }
  }
  return NextResponse.json({ ok: true, told: true, emailed });
}
