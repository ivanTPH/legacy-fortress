import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Power of Attorney review (Platform Admin, server only; admin client = service role).
 * Three separate checks before an authority takes effect (VAULT_ACCESS.md rule 7):
 * the attorney's identity, the authority itself, and that it can be used now.
 * Activation goes through lf_activate_legal_authority, which re-checks everything.
 */

type AnySupabaseClient = SupabaseClient;

export type LegalAuthorityStatus = "pending_check" | "confirmed" | "needs_attention" | "rejected" | "withdrawn" | "ended";
export type LegalAuthorityAction = "confirm" | "needs_attention" | "reject" | "activate" | "end";

export type LegalAuthorityReviewItem = {
  id: string;
  ownerUserId: string;
  ownerName: string;
  attorneyName: string;
  attorneyJoined: boolean;
  attorneyIdVerified: boolean;
  authorityType: string;
  registered: string;
  registrationRef: string | null;
  usableWhen: string;
  scopeAreas: string[];
  status: LegalAuthorityStatus;
  activatedAt: string | null;
  withdrawnAt: string | null;
  withdrawnReason: string | null;
  createdAt: string;
  updatedAt: string;
  document: { type: "document" | "attachment"; id: string; fileName: string } | null;
  reviews: Array<{ action: string; messageToOwner: string | null; createdAt: string }>;
};

export class LegalAuthorityActionError extends Error {
  status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.name = "LegalAuthorityActionError";
    this.status = status;
  }
}

export function normalizeLegalAuthorityAction(value: unknown): LegalAuthorityAction | null {
  const action = String(value ?? "").trim();
  return ["confirm", "needs_attention", "reject", "activate", "end"].includes(action) ? action as LegalAuthorityAction : null;
}

/** Which actions the review team can take from each state. */
export function allowedLegalAuthorityActions(item: Pick<LegalAuthorityReviewItem, "status" | "activatedAt">): LegalAuthorityAction[] {
  if (item.status === "pending_check" || item.status === "needs_attention") return ["confirm", "needs_attention", "reject"];
  if (item.status === "confirmed" && !item.activatedAt) return ["activate", "needs_attention", "end"];
  if (item.status === "confirmed" && item.activatedAt) return ["end"];
  return [];
}

export function isDecisionAction(action: LegalAuthorityAction) {
  return action === "confirm" || action === "reject" || action === "activate" || action === "end";
}

export async function loadLegalAuthorities(client: AnySupabaseClient, options: { id?: string } = {}): Promise<LegalAuthorityReviewItem[]> {
  let query = client
    .from("legal_authorities")
    .select("id,owner_user_id,person_id,authority_type,registered,usable_when,document_type,document_id,scope_areas,status,activated_at,withdrawn_at,withdrawn_reason,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(100); // keeps ID look-ups below short request URLs
  if (options.id) query = query.eq("id", options.id);
  const authorities = await query;
  if (authorities.error) throw new Error(authorities.error.message);
  const rows = authorities.data ?? [];
  if (!rows.length) return [];

  const ownerIds = [...new Set(rows.map((row) => row.owner_user_id))];
  const personIds = [...new Set(rows.map((row) => row.person_id))];
  const ids = rows.map((row) => row.id);
  const documentIds = rows.filter((row) => row.document_type === "document").map((row) => row.document_id);
  const attachmentIds = rows.filter((row) => row.document_type === "attachment").map((row) => row.document_id);

  const [profiles, contacts, privateRows, reviews, documents, attachments] = await Promise.all([
    client.from("user_profiles").select("user_id,display_name").in("user_id", ownerIds),
    client.from("contacts").select("id,full_name,linked_user_id").in("id", personIds),
    client.from("legal_authority_private").select("authority_id,registration_ref").in("authority_id", ids),
    client.from("legal_authority_reviews").select("authority_id,action,message_to_owner,created_at").in("authority_id", ids).order("created_at", { ascending: false }),
    documentIds.length ? client.from("documents").select("id,file_name,display_title").in("id", documentIds) : Promise.resolve({ data: [], error: null }),
    attachmentIds.length ? client.from("attachments").select("id,file_name").in("id", attachmentIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const linkedIds = [...new Set((contacts.data ?? []).map((row) => row.linked_user_id).filter(Boolean))] as string[];
  const identity = linkedIds.length
    ? await client.from("identity_assurance_states").select("user_id,identity_level,expires_at").in("user_id", linkedIds)
    : { data: [] as Array<{ user_id: string; identity_level: number; expires_at: string | null }>, error: null };
  const now = Date.now();
  const verified = new Set((identity.data ?? [])
    .filter((row) => Number(row.identity_level) >= 2 && (!row.expires_at || Date.parse(row.expires_at) > now))
    .map((row) => row.user_id));

  const ownerName = new Map((profiles.data ?? []).map((row) => [row.user_id, String(row.display_name ?? "").trim()]));
  const contact = new Map((contacts.data ?? []).map((row) => [row.id, row]));
  const ref = new Map((privateRows.data ?? []).map((row) => [row.authority_id, row.registration_ref]));
  const docName = new Map<string, string>([
    ...(documents.data ?? []).map((row) => [row.id, String((row as { display_title?: string }).display_title || row.file_name || "Document")] as [string, string]),
    ...(attachments.data ?? []).map((row) => [row.id, String(row.file_name || "Document")] as [string, string]),
  ]);

  return rows.map((row) => {
    const person = contact.get(row.person_id);
    return {
      id: row.id,
      ownerUserId: row.owner_user_id,
      ownerName: ownerName.get(row.owner_user_id) || "Vault owner",
      attorneyName: String(person?.full_name ?? "").trim() || "Attorney",
      attorneyJoined: Boolean(person?.linked_user_id),
      attorneyIdVerified: Boolean(person?.linked_user_id && verified.has(person.linked_user_id)),
      authorityType: row.authority_type,
      registered: row.registered,
      registrationRef: ref.get(row.id) ?? null,
      usableWhen: row.usable_when,
      scopeAreas: row.scope_areas ?? [],
      status: row.status,
      activatedAt: row.activated_at,
      withdrawnAt: row.withdrawn_at,
      withdrawnReason: row.withdrawn_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      document: row.document_type && row.document_id ? { type: row.document_type, id: row.document_id, fileName: docName.get(row.document_id) ?? "Document" } : null,
      reviews: (reviews.data ?? []).filter((review) => review.authority_id === row.id)
        .map((review) => ({ action: review.action, messageToOwner: review.message_to_owner, createdAt: review.created_at })),
    } satisfies LegalAuthorityReviewItem;
  });
}

export async function applyLegalAuthorityAction(client: AnySupabaseClient, input: {
  authorityId: string; action: LegalAuthorityAction; messageToOwner: string; reviewerUserId: string;
}) {
  const [current] = await loadLegalAuthorities(client, { id: input.authorityId });
  if (!current) throw new LegalAuthorityActionError("Authority not found.", 404);
  if (!allowedLegalAuthorityActions(current).includes(input.action)) {
    throw new LegalAuthorityActionError("That step isn’t available for this authority now. Refresh and try again.");
  }
  const message = input.messageToOwner.trim().slice(0, 500) || null;

  if (input.action === "activate") {
    if (!current.attorneyJoined) throw new LegalAuthorityActionError("The attorney hasn’t joined yet.");
    if (!current.attorneyIdVerified) throw new LegalAuthorityActionError("The attorney’s ID hasn’t been verified.");
    const { error } = await client.rpc("lf_activate_legal_authority", { p_authority_id: current.id, p_reviewer_user_id: input.reviewerUserId });
    if (error) throw new LegalAuthorityActionError(error.message.replace(/^.*?:\s*/, ""));
    return (await loadLegalAuthorities(client, { id: current.id }))[0];
  }

  const nextStatus: Record<Exclude<LegalAuthorityAction, "activate">, LegalAuthorityStatus> = {
    confirm: "confirmed", needs_attention: "needs_attention", reject: "rejected", end: "ended",
  };
  const status = nextStatus[input.action];
  const update = await client.from("legal_authorities").update({ status })
    .eq("id", current.id).eq("status", current.status).select("id");
  if (update.error) throw new LegalAuthorityActionError(update.error.message);
  if (!update.data?.length) throw new LegalAuthorityActionError("The authority changed while this was being saved. Refresh and try again.");
  const reviewAction = input.action === "confirm" ? "confirmed" : input.action === "reject" ? "rejected" : input.action === "end" ? "ended" : "needs_attention";
  const review = await client.from("legal_authority_reviews").insert({
    authority_id: current.id, owner_user_id: current.ownerUserId, action: reviewAction, message_to_owner: message, reviewer_user_id: input.reviewerUserId,
  });
  if (review.error) throw new LegalAuthorityActionError(review.error.message);
  return (await loadLegalAuthorities(client, { id: current.id }))[0];
}

export async function createLegalAuthorityDocumentUrl(client: AnySupabaseClient, authorityId: string) {
  const [current] = await loadLegalAuthorities(client, { id: authorityId });
  if (!current?.document) throw new LegalAuthorityActionError("No document is attached to this authority.", 404);
  const table = current.document.type === "document" ? "documents" : "attachments";
  const row = await client.from(table).select("id,owner_user_id,storage_bucket,storage_path,file_name")
    .eq("id", current.document.id).eq("owner_user_id", current.ownerUserId).maybeSingle();
  if (row.error || !row.data?.storage_path) throw new LegalAuthorityActionError("The document couldn’t be found.", 404);
  const expiresInSeconds = 120;
  const signed = await client.storage.from(row.data.storage_bucket || "vault-docs").createSignedUrl(row.data.storage_path, expiresInSeconds);
  if (signed.error || !signed.data?.signedUrl) throw new LegalAuthorityActionError("The document couldn’t be opened.", 502);
  return { authority: current, fileName: String(row.data.file_name || current.document.fileName), signedUrl: signed.data.signedUrl, expiresInSeconds };
}
