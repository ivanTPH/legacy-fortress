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
