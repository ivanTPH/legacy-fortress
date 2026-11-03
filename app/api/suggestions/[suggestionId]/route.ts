import { NextResponse } from "next/server";
import { requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { applyApprovedSuggestion, clientAsUser, friendlyRpcError, REJECT_REASONS, removeHeldFile, sendSuggestionEmail } from "@/lib/suggestions/service";

type Body = { action?: string; reason?: string; comment?: string; body?: string };

/**
 * POST { action: "approve" | "reject" | "withdraw" | "comment" } for one suggestion (7c–7e, p2).
 * Approve and reject are the owner's only; withdraw is the proposer's only; the database enforces both.
 */
export async function POST(request: Request, { params }: { params: Promise<{ suggestionId: string }> }) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  const { suggestionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(suggestionId)) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  const input = (await request.json().catch(() => ({}))) as Body;
  const asPerson = clientAsUser(request);
  const parties = await access.admin.from("record_suggestions").select("owner_user_id,proposer_user_id").eq("id", suggestionId).maybeSingle();

  if (input.action === "approve") {
    const approved = await asPerson.rpc("lf_approve_suggestion", { p_suggestion_id: suggestionId });
    const row = Array.isArray(approved.data) ? approved.data[0] : null;
    if (approved.error || !row) return NextResponse.json({ ok: false, message: friendlyRpcError(approved.error?.message) }, { status: 403 });
    try {
      const documentId = await applyApprovedSuggestion(access.admin, suggestionId, row);
      if (parties.data) await sendSuggestionEmail(access.admin, parties.data.proposer_user_id, "decided", `lf-suggestion-decided/${suggestionId}`).catch(() => false);
      return NextResponse.json({ ok: true, documentId, assetId: row.asset_id });
    } catch {
      // Stays approved; approving again retries adding the file.
      return NextResponse.json({ ok: false, message: "Approved, but the document couldn’t be added yet. Try Approve again." }, { status: 502 });
    }
  }
  if (input.action === "reject") {
    const reason = String(input.reason ?? "");
    if (!(REJECT_REASONS as readonly string[]).includes(reason)) return NextResponse.json({ ok: false, message: "Choose a reason." }, { status: 400 });
    const rejected = await asPerson.rpc("lf_reject_suggestion", { p_suggestion_id: suggestionId, p_reason: reason, p_comment: String(input.comment ?? "").slice(0, 1000) || null });
    if (rejected.error) return NextResponse.json({ ok: false, message: friendlyRpcError(rejected.error.message) }, { status: 403 });
    await removeHeldFile(access.admin, suggestionId, rejected.data as string);
    if (parties.data) await sendSuggestionEmail(access.admin, parties.data.proposer_user_id, "decided", `lf-suggestion-decided/${suggestionId}`).catch(() => false);
    return NextResponse.json({ ok: true });
  }
  if (input.action === "withdraw") {
    const withdrawn = await asPerson.rpc("lf_withdraw_suggestion", { p_suggestion_id: suggestionId });
    if (withdrawn.error) return NextResponse.json({ ok: false, message: friendlyRpcError(withdrawn.error.message) }, { status: 403 });
    await removeHeldFile(access.admin, suggestionId, withdrawn.data as string);
    return NextResponse.json({ ok: true });
  }
  if (input.action === "comment") {
    const text = String(input.body ?? "").trim();
    if (!text) return NextResponse.json({ ok: false, message: "Write a comment first." }, { status: 400 });
    const commented = await asPerson.rpc("lf_comment_on_suggestion", { p_suggestion_id: suggestionId, p_body: text.slice(0, 1000) });
    if (commented.error) return NextResponse.json({ ok: false, message: friendlyRpcError(commented.error.message) }, { status: 403 });
    if (parties.data) {
      const other = parties.data.owner_user_id === access.user.id ? parties.data.proposer_user_id : parties.data.owner_user_id;
      await sendSuggestionEmail(access.admin, other, "comment", `lf-suggestion-comment/${commented.data}`).catch(() => false);
    }
    return NextResponse.json({ ok: true, commentId: commented.data });
  }
  return NextResponse.json({ ok: false, message: "Unknown action." }, { status: 400 });
}
