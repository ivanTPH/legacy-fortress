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
};

export type VaultGrant = {
  id: string;
  personId: string | null;
  status: string;
  createdAt: string;
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
  const [contacts, nominations, scopeRows, authorities, grants] = await Promise.all([
    client.from("contacts").select("id,full_name,relationship,email,invite_status,verification_status,linked_user_id").eq("owner_user_id", ownerUserId).order("full_name"),
    client.from("vault_nominations").select("id,person_id,scope,status,notify_person,created_at,cancelled_at").eq("owner_user_id", ownerUserId).order("created_at", { ascending: false }),
    client.from("vault_nomination_records").select("nomination_id,mode").eq("owner_user_id", ownerUserId),
    client.from("legal_authorities").select("id,person_id,authority_type,usable_when,status,scope_areas,activated_at,withdrawn_at").eq("owner_user_id", ownerUserId),
    client.from("account_access_grants").select("id,contact_id,activation_status,created_at").eq("owner_user_id", ownerUserId),
  ]);
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
    })),
    // Grants are read for display only. Their rules are unchanged.
    grants: grants.error ? [] : (grants.data ?? []).map((row) => ({ id: row.id, personId: row.contact_id, status: row.activation_status, createdAt: row.created_at })),
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
