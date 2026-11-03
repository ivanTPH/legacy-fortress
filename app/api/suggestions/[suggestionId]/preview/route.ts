import { NextResponse } from "next/server";
import { requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { clientAsUser, SUGGESTION_BUCKET } from "@/lib/suggestions/service";

/**
 * GET — a 60-second link to view a held suggested file. Only the owner and the proposer can see the
 * suggestion (checked by the database as the signed-in person); nothing is downloadable after a decision.
 */
export async function GET(request: Request, { params }: { params: Promise<{ suggestionId: string }> }) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  const { suggestionId } = await params;
  const visible = await clientAsUser(request).from("record_suggestions").select("storage_path,status,file_removed_at").eq("id", suggestionId).maybeSingle();
  if (visible.error || !visible.data) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  if (visible.data.status !== "pending" || visible.data.file_removed_at) return NextResponse.json({ ok: false, message: "This file is no longer held here." }, { status: 410 });
  const signed = await access.admin.storage.from(SUGGESTION_BUCKET).createSignedUrl(visible.data.storage_path, 60);
  if (signed.error || !signed.data?.signedUrl) return NextResponse.json({ ok: false, message: "The file couldn’t be opened." }, { status: 502 });
  return NextResponse.json({ ok: true, url: signed.data.signedUrl }, { headers: { "Cache-Control": "no-store" } });
}
