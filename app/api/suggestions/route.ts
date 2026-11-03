import { NextResponse } from "next/server";
import { requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { clientAsUser, friendlyRpcError, heldFilePath, sendSuggestionEmail, SUGGESTION_BUCKET, validateSuggestedFile } from "@/lib/suggestions/service";

/**
 * POST multipart { assetId, file, note } — suggest a document for a record the owner chose (7a, p1).
 * The database decides whether the signed-in person may suggest for this record; the file is held
 * privately and is not part of the record until the owner approves.
 */
export async function POST(request: Request) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  const form = await request.formData().catch(() => null);
  const assetId = String(form?.get("assetId") ?? "").trim();
  const note = String(form?.get("note") ?? "").trim().slice(0, 1000);
  const file = form?.get("file");
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) return NextResponse.json({ ok: false, message: "Choose a record." }, { status: 400 });
  const fileError = validateSuggestedFile(file instanceof File ? file : null);
  if (fileError || !(file instanceof File)) return NextResponse.json({ ok: false, message: fileError }, { status: 400 });

  const asPerson = clientAsUser(request);
  const targets = await asPerson.rpc("lf_suggestion_targets");
  const target = ((targets.data ?? []) as Array<{ asset_id: string; owner_user_id: string }>).find((row) => row.asset_id === assetId);
  if (targets.error || !target) return NextResponse.json({ ok: false, message: "You can’t suggest documents for this record." }, { status: 403 });

  const path = heldFilePath(target.owner_user_id, access.user.id, file.name);
  const upload = await access.admin.storage.from(SUGGESTION_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) return NextResponse.json({ ok: false, message: "The file couldn’t be uploaded. Try again." }, { status: 502 });
  const created = await asPerson.rpc("lf_create_document_suggestion", {
    p_asset_id: assetId, p_file_name: file.name, p_mime_type: file.type, p_size_bytes: file.size, p_storage_path: path, p_note: note || null,
  });
  if (created.error || !created.data) {
    await access.admin.storage.from(SUGGESTION_BUCKET).remove([path]);
    return NextResponse.json({ ok: false, message: friendlyRpcError(created.error?.message) }, { status: 403 });
  }
  const emailed = await sendSuggestionEmail(access.admin, target.owner_user_id, "review", `lf-suggestion/${created.data}`).catch(() => false);
  return NextResponse.json({ ok: true, suggestionId: created.data, emailed });
}
