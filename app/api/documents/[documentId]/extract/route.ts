import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { readDocumentText, EXTRACTION_LIMITS } from "@/lib/documents/extraction/readDocumentText";
import { extractNamedPeople } from "@/lib/documents/extraction/peopleExtraction";
import { matchOwnerContact, mergePeopleByName, normalisePersonName } from "@/lib/documents/extraction/personMatching";
import { extractBankStatementCandidate } from "@/lib/documents/bankStatementExtraction";
import { matchBankStatementToAuthorisedAccounts } from "@/lib/documents/bankStatementMatching";
import { buildBankAccountFinding } from "@/lib/documents/extraction/bankFinding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const NO_STORE = { "Cache-Control": "private, no-store" };
const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

/**
 * Reads one of the caller's own documents inside Legacy Fortress and records what it finds
 * as pending suggestions. Nothing is linked, created or shared until the owner chooses.
 * Document text is never stored or logged; only the suggestion fields are kept.
 */
export async function POST(request: Request, context: { params: Promise<{ documentId: string }> }) {
  if (process.env.NEXT_PUBLIC_DOCUMENT_EXTRACTION !== "true") return fail(404, "not_available");
  const { documentId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) return fail(400, "invalid_document");

  const { user } = await getRequestUser(request);
  if (!user) return fail(401, "sign_in_required");
  const admin = createSupabaseAdminClient();
  if (!admin) return fail(503, "extraction_unavailable");

  // Ownership is checked here and again by the suggestion triggers.
  // Assets keep files in documents; Legal records (Wills, LPAs...) keep them in attachments.
  const fromAttachment = new URL(request.url).searchParams.get("source") === "attachment";
  let file: { bucket: string; path: string; size: number; recordId: string };
  let record: { id: string; section_key: string | null; category_key: string | null };
  if (fromAttachment) {
    const attachment = await admin.from("attachments")
      .select("id,owner_user_id,record_id,storage_bucket,storage_path,size_bytes")
      .eq("id", documentId).eq("owner_user_id", user.id).maybeSingle();
    if (attachment.error || !attachment.data) return fail(404, "document_not_found");
    const owned = await admin.from("records").select("id,section_key,category_key")
      .eq("id", attachment.data.record_id).eq("owner_user_id", user.id).maybeSingle();
    if (owned.error || !owned.data) return fail(404, "record_not_found");
    file = { bucket: attachment.data.storage_bucket, path: attachment.data.storage_path, size: Number(attachment.data.size_bytes ?? 0), recordId: owned.data.id };
    record = owned.data;
  } else {
    const doc = await admin.from("documents")
      .select("id,owner_user_id,asset_id,storage_bucket,storage_path,size_bytes")
      .eq("id", documentId).eq("owner_user_id", user.id).is("deleted_at", null).maybeSingle();
    if (doc.error || !doc.data?.asset_id) return fail(404, "document_not_found");
    const asset = await admin.from("assets")
      .select("id,owner_user_id,section_key,category_key")
      .eq("id", doc.data.asset_id).eq("owner_user_id", user.id).is("deleted_at", null).maybeSingle();
    if (asset.error || !asset.data) return fail(404, "record_not_found");
    file = { bucket: doc.data.storage_bucket, path: doc.data.storage_path, size: Number(doc.data.size_bytes ?? 0), recordId: asset.data.id };
    record = asset.data;
  }
  if (file.size > EXTRACTION_LIMITS.maxBytes) return fail(413, "too_large");
  const recordType = fromAttachment ? "record" : "asset";

  const download = await admin.storage.from(file.bucket || "vault-docs").download(file.path);
  if (download.error || !download.data) return fail(404, "document_unavailable");
  const bytes = new Uint8Array(await download.data.arrayBuffer());

  const read = await readDocumentText(bytes);
  bytes.fill(0);
  if (!read.ok) return NextResponse.json({ ok: true, readable: false, reason: read.reason, peopleSuggested: 0, account: null }, { headers: NO_STORE });

  const section = String(record.section_key ?? "");
  const category = String(record.category_key ?? "");
  const usedOcr = read.pages.some((page) => page.source === "ocr");

  // People named with a role.
  let peopleSuggested = 0;
  const allowPeople = !(section === "legal" && category === "identity-documents");
  const people = allowPeople ? mergePeopleByName(extractNamedPeople(read.pages)) : [];
  if (people.length) {
    const [contacts, existing, links] = await Promise.all([
      admin.from("contacts").select("id,full_name").eq("owner_user_id", user.id).limit(1000),
      admin.from("extraction_suggestions").select("extracted_name").eq("owner_user_id", user.id).eq(fromAttachment ? "attachment_id" : "document_id", documentId),
      admin.from("record_links").select("person_id").eq("owner_user_id", user.id).eq("record_type", recordType).eq("record_id", record.id).is("removed_at", null),
    ]);
    if (contacts.error || existing.error || links.error) return fail(500, "suggestions_unavailable");
    const alreadySuggested = new Set((existing.data ?? []).map((row) => normalisePersonName(row.extracted_name)));
    const linkedPeople = new Set((links.data ?? []).map((row) => row.person_id));
    const rows = people
      .filter((person) => !alreadySuggested.has(normalisePersonName(person.name)))
      .map((person) => ({ person, match: matchOwnerContact(person.name, contacts.data ?? []) }))
      .filter(({ match }) => !(match.kind === "exact" && match.personId && linkedPeople.has(match.personId)))
      .map(({ person, match }) => ({
        owner_user_id: user.id,
        ...(fromAttachment ? { record_type: "record", attachment_id: documentId } : { document_id: documentId }),
        record_id: record.id,
        page: person.page,
        extracted_name: person.name.slice(0, 120),
        extracted_role: person.role.slice(0, 60),
        match_person_id: match.personId,
        match_kind: match.kind,
      }));
    if (rows.length) {
      const inserted = await admin.from("extraction_suggestions").insert(rows).select("id");
      // Legal-record suggestions need the 30 Oct schema change; until it is live, say nothing rather than fail.
      if (inserted.error && fromAttachment) return NextResponse.json({ ok: true, readable: true, pagesRead: read.pages.length, usedOcr, peopleSuggested: 0, account: null, pendingSchema: true }, { headers: NO_STORE });
      if (inserted.error) return fail(500, "suggestions_not_saved");
      peopleSuggested = inserted.data?.length ?? 0;
    }
  }

  // Bank account details (statements) — returned to the owner only, never stored here.
  let account = null;
  const statement = extractBankStatementCandidate(read.pages);
  if (statement.fields.accountNumber || statement.fields.iban) {
    const banks = await admin.from("assets").select("id,owner_user_id,metadata_json")
      .eq("owner_user_id", user.id).eq("section_key", "finances").eq("category_key", "bank").is("deleted_at", null).limit(500);
    if (!banks.error) {
      const records = (banks.data ?? []).map((row) => {
        const metadata = (row.metadata_json ?? {}) as Record<string, unknown>;
        return { id: row.id, ownerUserId: row.owner_user_id, accountNumber: String(metadata.account_number ?? ""), sortCode: String(metadata.sort_code ?? ""), iban: String(metadata.iban ?? "") };
      });
      account = buildBankAccountFinding(statement, matchBankStatementToAuthorisedAccounts(statement, user.id, records), record.id);
    }
  }

  return NextResponse.json({
    ok: true,
    readable: true,
    pagesRead: read.pages.length,
    usedOcr,
    truncated: read.truncated,
    peopleSuggested,
    account,
    section,
    category,
  }, { headers: NO_STORE });
}
