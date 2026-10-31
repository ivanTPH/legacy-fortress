import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Vault access (V5.2 addition, 27 Oct design; owner decisions 30 Oct 2026).
 * Five separate facts: contact, invitation, identity, nomination (later) and access (now).
 * Only access (now) opens anything; this module never creates or changes access.
 */

export type VaultAccessPerson = {
  id: string;
  name: string;
  relationship: string | null;
  email: string | null;
  invitation: string | null;
  identity: string | null;
  joined: boolean;
};

export type VaultNomination = {
  id: string;
  personId: string;
  scope: "whole_vault" | "selected";
  status: "active" | "cancelled" | "released" | "ended";
  notifyPerson: boolean;
  createdAt: string;
  cancelledAt: string | null;
  includeCount: number;
  exceptionCount: number;
};

export type VaultAuthority = {
  id: string;
  personId: string;
  authorityType: string;
  usableWhen: string;
  status: string;
  scopeAreas: string[];
  activatedAt: string | null;
  withdrawnAt: string | null;
  /** Latest message from the review team, if any. Never contains record details. */
  reviewMessage: string | null;
};

export type VaultGrant = {
  id: string;
  personId: string | null;
  status: string;
  createdAt: string;
  source: string;
  endsAt: string | null;
  assetIds: string[];
  recordIds: string[];
};

export type VaultAccessSnapshot = {
  people: VaultAccessPerson[];
  nominations: VaultNomination[];
  authorities: VaultAuthority[];
  grants: VaultGrant[];
};

export type VaultRecordOption = { type: "asset" | "record"; id: string; title: string; area: string; section: string };

/** The tables exist only once the approved Vault access migration is applied. */
export async function vaultAccessAvailable(client: SupabaseClient) {
  const probe = await client.from("vault_nominations").select("id").limit(1);
  return !probe.error;
}

export async function loadVaultAccess(client: SupabaseClient, ownerUserId: string): Promise<VaultAccessSnapshot> {
  const [contacts, nominations, scopeRows, authorities, grants, reviews] = await Promise.all([
    client.from("contacts").select("id,full_name,relationship,email,invite_status,verification_status,linked_user_id").eq("owner_user_id", ownerUserId).order("full_name"),
    client.from("vault_nominations").select("id,person_id,scope,status,notify_person,created_at,cancelled_at").eq("owner_user_id", ownerUserId).order("created_at", { ascending: false }),
    client.from("vault_nomination_records").select("nomination_id,mode").eq("owner_user_id", ownerUserId),
    client.from("legal_authorities").select("id,person_id,authority_type,usable_when,status,scope_areas,activated_at,withdrawn_at").eq("owner_user_id", ownerUserId),
    client.from("account_access_grants").select("id,contact_id,activation_status,created_at,source,ends_at,paused_at,permissions_override").eq("owner_user_id", ownerUserId),
    client.from("legal_authority_reviews").select("authority_id,action,message_to_owner,created_at").eq("owner_user_id", ownerUserId).order("created_at", { ascending: false }),
  ]);
  // Show the team's message only while the latest review is asking the owner to fix something.
  const reviewMessage = new Map<string, string>();
  const seen = new Set<string>();
  for (const review of reviews.error ? [] : reviews.data ?? []) {
    if (seen.has(review.authority_id)) continue;
    seen.add(review.authority_id);
    if (review.action === "needs_attention" && review.message_to_owner) reviewMessage.set(review.authority_id, review.message_to_owner);
  }
  const firstError = contacts.error ?? nominations.error ?? scopeRows.error ?? authorities.error;
  if (firstError) throw new Error(firstError.message);
  const counts = new Map<string, { include: number; exclude: number }>();
  for (const row of scopeRows.data ?? []) {
    const current = counts.get(row.nomination_id) ?? { include: 0, exclude: 0 };
    if (row.mode === "include") current.include += 1; else current.exclude += 1;
    counts.set(row.nomination_id, current);
  }
  return {
    people: (contacts.data ?? []).map((row) => ({
      id: row.id,
      name: row.full_name || "Unnamed person",
      relationship: row.relationship ?? null,
      email: row.email ?? null,
      invitation: row.invite_status ?? null,
      identity: row.verification_status ?? null,
      joined: Boolean(row.linked_user_id),
    })),
    nominations: (nominations.data ?? []).map((row) => ({
      id: row.id,
      personId: row.person_id,
      scope: row.scope,
      status: row.status,
      notifyPerson: row.notify_person,
      createdAt: row.created_at,
      cancelledAt: row.cancelled_at,
      includeCount: counts.get(row.id)?.include ?? 0,
      exceptionCount: counts.get(row.id)?.exclude ?? 0,
    })),
    authorities: (authorities.data ?? []).map((row) => ({
      id: row.id,
      personId: row.person_id,
      authorityType: row.authority_type,
      usableWhen: row.usable_when,
      status: row.status,
      scopeAreas: row.scope_areas ?? [],
      activatedAt: row.activated_at,
      withdrawnAt: row.withdrawn_at,
      reviewMessage: reviewMessage.get(row.id) ?? null,
    })),
    // Grants are read for display only. Their rules are unchanged.
    grants: grants.error ? [] : (grants.data ?? []).map((row) => {
      const override = (row.permissions_override ?? {}) as Record<string, unknown>;
      const ids = (key: string) => Array.isArray(override[key]) ? (override[key] as unknown[]).map(String) : [];
      return {
        id: row.id, personId: row.contact_id, status: row.paused_at ? "paused" : row.activation_status, createdAt: row.created_at,
        source: row.source ?? "owner_grant", endsAt: row.ends_at ?? null, assetIds: ids("asset_ids"), recordIds: ids("record_ids"),
      };
    }),
  };
}

/** Records the owner can choose for a selected nomination or as whole-Vault exceptions. */
export async function loadVaultRecordOptions(client: SupabaseClient, ownerUserId: string): Promise<VaultRecordOption[]> {
  const [assets, records] = await Promise.all([
    client.from("assets").select("id,title,section_key,category_key").eq("owner_user_id", ownerUserId).is("deleted_at", null).order("title").limit(500),
    client.from("records").select("id,title,section_key,category_key").eq("owner_user_id", ownerUserId).is("archived_at", null).order("title").limit(500),
  ]);
  const label = (value: string | null) => {
    const text = String(value ?? "").replace(/[_-]+/g, " ").trim();
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Other";
  };
  return [
    ...(assets.data ?? []).map((row) => ({ type: "asset" as const, id: row.id, title: row.title || "Untitled record", area: label(row.section_key), section: label(row.category_key) })),
    ...(records.data ?? []).map((row) => ({ type: "record" as const, id: row.id, title: row.title || "Untitled record", area: label(row.section_key), section: label(row.category_key) })),
  ];
}

/** One-step save through lf_save_vault_nomination. Creates no access. */
export async function saveVaultNomination(client: SupabaseClient, input: { personId: string; scope: "whole_vault" | "selected"; records: Array<Pick<VaultRecordOption, "type" | "id">>; notifyPerson: boolean }) {
  const { data, error } = await client.rpc("lf_save_vault_nomination", {
    p_person_id: input.personId,
    p_scope: input.scope,
    p_records: input.records.map((record) => ({ type: record.type, id: record.id })),
    p_notify_person: input.notifyPerson,
  });
  if (error) throw new Error(friendlyError(error.message));
  return String(data);
}

export async function cancelVaultNomination(client: SupabaseClient, ownerUserId: string, nominationId: string) {
  const { error } = await client.from("vault_nominations").update({ status: "cancelled" }).eq("id", nominationId).eq("owner_user_id", ownerUserId).eq("status", "active");
  if (error) throw new Error(friendlyError(error.message));
}

function friendlyError(message: string) {
  if (/duplicate key|one_active_person/i.test(message)) return "This person already has a nomination for later. Cancel it first to set up a different one.";
  if (/at least one record/i.test(message)) return "Choose at least one record.";
  return message;
}

export const AUTHORITY_LABEL: Record<string, string> = {
  lpa_property_finance: "Lasting Power of Attorney · property and finances",
  lpa_health_welfare: "Lasting Power of Attorney · health and welfare",
  enduring_poa: "Enduring Power of Attorney",
  general_poa: "General Power of Attorney",
  other: "Other legal authority",
};

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

// ---- Power of Attorney (va-l1–l6). Recording never gives access; the review team
// checks the authority and the attorney's identity, and only then can it take effect.

export type AuthorityType = "lpa_property_finance" | "lpa_health_welfare" | "enduring_poa" | "general_poa" | "other";
export type AuthorityDocument = { type: "document" | "attachment"; id: string; name: string; where: string; added: string };

export const AUTHORITY_CHOICES: Array<{ value: AuthorityType; title: string; detail: string }> = [
  { value: "lpa_property_finance", title: "Lasting Power of Attorney: property and financial affairs", detail: "Money, property and bills." },
  { value: "lpa_health_welfare", title: "Lasting Power of Attorney: health and welfare", detail: "Care and medical decisions. Only usable if you lack mental capacity." },
  { value: "enduring_poa", title: "Enduring Power of Attorney", detail: "Made before 1 October 2007. Property and finances only." },
  { value: "general_poa", title: "General Power of Attorney", detail: "Ends if you lose mental capacity." },
  { value: "other", title: "Something else", detail: "For example a court order. Our team will check it." },
];

/** What each type could ever cover. Owners can only narrow this. Wills are never included (owner decision 5). */
export const AUTHORITY_AREAS: Record<AuthorityType, string[]> = {
  lpa_property_finance: ["finances", "property", "business"],
  enduring_poa: ["finances", "property", "business"],
  general_poa: ["finances", "property", "business"],
  // Owner decision 8 is open: health and welfare covers profile details only until it's decided.
  lpa_health_welfare: ["profile"],
  other: ["finances", "property", "business", "digital", "possessions"],
};

export const AREA_LABEL: Record<string, string> = { profile: "Profile", finances: "Finances", legal: "Legal", property: "Property", business: "Business", digital: "Digital", possessions: "Possessions" };

export async function loadAuthorityDocuments(client: SupabaseClient, ownerUserId: string): Promise<AuthorityDocument[]> {
  const [documents, attachments] = await Promise.all([
    client.from("documents").select("id,file_name,display_title,asset_id,created_at").eq("owner_user_id", ownerUserId).is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
    client.from("attachments").select("id,file_name,record_id,created_at").eq("owner_user_id", ownerUserId).order("created_at", { ascending: false }).limit(200),
  ]);
  const added = (value: string | null) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(" at ", ", ") : "";
  };
  return [
    ...(attachments.data ?? []).map((row) => ({ type: "attachment" as const, id: row.id, name: row.file_name || "Document", where: "Legal", added: added(row.created_at) })),
    ...(documents.data ?? []).map((row) => ({ type: "document" as const, id: row.id, name: row.display_title || row.file_name || "Document", where: "Vault", added: added(row.created_at) })),
  ];
}

export async function recordLegalAuthority(client: SupabaseClient, ownerUserId: string, input: {
  personId: string; authorityType: AuthorityType; registered: "yes" | "no" | "unknown"; registrationRef: string;
  usableWhen: "with_consent" | "lacks_capacity_only"; document: AuthorityDocument; areas: string[];
}) {
  const vault = await client.from("wallets").select("id").eq("owner_user_id", ownerUserId).eq("status", "active").order("created_at").limit(1).maybeSingle();
  if (vault.error || !vault.data) throw new Error("Your Vault isn’t ready yet.");
  const allowed = AUTHORITY_AREAS[input.authorityType];
  const inserted = await client.from("legal_authorities").insert({
    owner_user_id: ownerUserId,
    vault_id: vault.data.id,
    person_id: input.personId,
    authority_type: input.authorityType,
    registered: input.registered,
    usable_when: input.authorityType === "lpa_health_welfare" ? "lacks_capacity_only" : input.usableWhen,
    document_type: input.document.type,
    document_id: input.document.id,
    scope_areas: input.areas.filter((area) => allowed.includes(area)),
    created_by: ownerUserId,
  }).select("id").single();
  if (inserted.error) throw new Error(inserted.error.message);
  const ref = input.registrationRef.trim();
  if (ref) {
    const privateDetails = await client.from("legal_authority_private").insert({ authority_id: inserted.data.id, owner_user_id: ownerUserId, registration_ref: ref.slice(0, 60) });
    if (privateDetails.error) throw new Error("The authority was recorded, but the reference number wasn’t saved. Add it again from the person’s Vault access.");
  }
  return String(inserted.data.id);
}

export async function withdrawLegalAuthority(client: SupabaseClient, ownerUserId: string, authorityId: string, reason: string) {
  const { error } = await client.from("legal_authorities").update({ status: "withdrawn", withdrawn_reason: reason.trim().slice(0, 300) || "Withdrawn by the owner" })
    .eq("id", authorityId).eq("owner_user_id", ownerUserId);
  if (error) throw new Error(error.message);
}

// ---- What the nominee sees (va-r4, va-r5). The narrow RPC returns only the owner's name,
// the kind and the state: never scope, records, counts or documents.

export type MyNomination = { ownerName: string; kind: string; status: "active" | "released" };

export async function loadMyNominations(client: SupabaseClient): Promise<MyNomination[]> {
  const { data, error } = await client.rpc("my_vault_nomination_status");
  if (error || !Array.isArray(data)) return [];
  return data
    .filter((row) => row && (row.status === "active" || row.status === "released"))
    .map((row) => ({ ownerName: String(row.owner_display_name || "Your contact"), kind: String(row.kind || "estate"), status: row.status }));
}


// ---- Sharing now: review, end date, stop, history (va-s*, va-v2–v4). ----

/** A grant opens records only while it has some, is active and hasn't ended. */
export function grantIsOpen(grant: VaultGrant, now = Date.now()) {
  return ["accepted", "active", "verified"].includes(String(grant.status).toLowerCase())
    && grant.assetIds.length + grant.recordIds.length > 0
    && (!grant.endsAt || Date.parse(grant.endsAt) > now);
}

export function grantHasEnded(grant: VaultGrant, now = Date.now()) {
  return Boolean(grant.endsAt && Date.parse(grant.endsAt) <= now && grant.assetIds.length + grant.recordIds.length > 0);
}

export async function loadGrantRecordTitles(client: SupabaseClient, ownerUserId: string, grant: VaultGrant) {
  const [assets, records] = await Promise.all([
    grant.assetIds.length ? client.from("assets").select("id,title").eq("owner_user_id", ownerUserId).in("id", grant.assetIds) : Promise.resolve({ data: [], error: null }),
    grant.recordIds.length ? client.from("records").select("id,title").eq("owner_user_id", ownerUserId).in("id", grant.recordIds) : Promise.resolve({ data: [], error: null }),
  ]);
  return [...(assets.data ?? []), ...(records.data ?? [])].map((row) => String((row as { title?: string }).title || "Untitled record"));
}

export async function stopVaultAccess(client: SupabaseClient, grantId: string, note: string) {
  const { error } = await client.rpc("lf_stop_vault_access", { p_grant_id: grantId, p_note: note.trim() || null });
  if (error) throw new Error(error.message);
}

export async function setVaultAccessEndDate(client: SupabaseClient, ownerUserId: string, grantId: string, date: string | null) {
  // A date means "until the end of that day" in the owner's time.
  const endsAt = date ? new Date(`${date}T23:59:59`).toISOString() : null;
  const { error } = await client.from("account_access_grants").update({ ends_at: endsAt, updated_at: new Date().toISOString() })
    .eq("id", grantId).eq("owner_user_id", ownerUserId).eq("source", "owner_grant");
  if (error) throw new Error(/tomorrow/i.test(error.message) ? "Choose a date from tomorrow onwards." : error.message);
}

export type VaultAccessHistoryItem = { at: string; action: string; byOwner: boolean; recordCount: number | null; note: string | null };

export async function loadVaultAccessHistory(client: SupabaseClient, personId: string): Promise<VaultAccessHistoryItem[]> {
  const { data, error } = await client.rpc("my_vault_access_history", { p_person_id: personId });
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => ({ at: row.at, action: row.action, byOwner: Boolean(row.by_owner), recordCount: row.record_count ?? null, note: row.note ?? null }));
}

export function describeHistory(item: VaultAccessHistoryItem): { icon: string; title: string } {
  const who = item.byOwner ? "by you" : "by our review team";
  const records = item.recordCount ? ` · ${item.recordCount} record${item.recordCount === 1 ? "" : "s"}` : "";
  const map: Record<string, [string, string]> = {
    "access.given": ["visibility", `Access given ${who}${records}`],
    "access.changed": ["edit", `Records changed ${who}${records}`],
    "access.stopped": ["block", `Access stopped ${who}${records}`],
    "access.end_date_changed": ["event", `End date changed ${who}`],
    "nomination.created": ["bookmark_added", `Nominated for later ${who}`],
    "nomination.changed": ["edit", `Nomination changed ${who}`],
    "nomination.cancelled": ["block", `Nomination cancelled ${who}`],
    "nomination.released": ["lock_open", "Released after the release was approved"],
    "nomination.ended": ["block", "Nomination ended"],
    "authority.recorded": ["gavel", `Authority recorded ${who}`],
    "authority.confirmed": ["check_circle", "Authority confirmed by our review team"],
    "authority.needs_attention": ["error", "Our review team asked you to fix something"],
    "authority.rejected": ["block", "Authority rejected by our review team"],
    "authority.activated": ["check_circle", "Authority in effect"],
    "authority.withdrawn": ["block", "Authority withdrawn by you"],
    "authority.ended": ["block", "Authority ended by our review team"],
  };
  const [icon, title] = map[item.action] ?? ["history", "Access updated"];
  return { icon, title };
}
