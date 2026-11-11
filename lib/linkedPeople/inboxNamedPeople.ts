import type { SupabaseClient } from "@supabase/supabase-js";
import { loadVaultFacts } from "../readiness/vaultFacts.ts";
import { assetMatchesLegalCategory } from "../legalCategories.ts";
import { listPeopleContactsForOwner } from "../contacts/contactRepository.ts";

/**
 * The people named on a Will (executors) or Power of Attorney (attorneys), for deciding in the Inbox
 * (owner decision 11 Nov 2026). Reads only; adding and inviting use the same services as the record page
 * (reviewLinkedPersonSuggestion, sendRecordLinkedPersonInvitation), so the rules and audit are unchanged.
 */
export type InboxNamedPerson =
  | { kind: "found"; key: string; suggestionId: string; recordId: string; recordType: "asset" | "record"; name: string; match: { personId: string; name: string } | null }
  | { kind: "linked"; key: string; personId: string; recordId: string; recordType: "asset" | "record"; name: string; email: string | null; invite: "accepted" | "sent" | "not_invited" | "problem" };

const ROLES = { will: /executor|executrix/i, poa: /attorney/i };

export async function loadInboxNamedPeople(client: SupabaseClient, ownerUserId: string, doc: "will" | "poa"): Promise<{ recordId: string | null; people: InboxNamedPerson[] }> {
  const facts = await loadVaultFacts(client, ownerUserId);
  const records = facts.rows.filter((row) => row.deleted_at == null && row.archived_at == null && row.status !== "archived"
    && assetMatchesLegalCategory(row, doc === "will" ? "wills" : "power-of-attorney"));
  if (!records.length) return { recordId: null, people: [] };
  const typeOf = new Map(records.map((row) => [row.id, row.kind === "record" ? "record" as const : "asset" as const]));
  const ids = [...typeOf.keys()];
  const role = ROLES[doc];
  const [suggestions, links, contacts] = await Promise.all([
    client.from("extraction_suggestions").select("id,record_id,extracted_name,extracted_role,match_person_id,match_kind")
      .eq("owner_user_id", ownerUserId).eq("status", "pending").in("record_id", ids),
    client.from("record_links").select("record_id,person_id,role").eq("owner_user_id", ownerUserId).in("record_id", ids).is("removed_at", null),
    listPeopleContactsForOwner(client, ownerUserId),
  ]);
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  const people: InboxNamedPerson[] = [];
  const seen = new Set<string>();
  for (const link of (links.data ?? []) as Array<{ record_id: string; person_id: string; role: string }>) {
    if (!role.test(link.role ?? "") || seen.has(link.person_id)) continue;
    const contact = contactById.get(link.person_id);
    if (!contact) continue;
    seen.add(link.person_id);
    const status = String(contact.invite_status ?? "not_invited");
    const invite = status === "accepted" ? "accepted"
      : status === "invite_sent" ? "sent"
      : ["failed", "not_delivered", "expired", "rejected", "revoked"].includes(status) ? "problem" : "not_invited";
    people.push({ kind: "linked", key: `person:${link.person_id}`, personId: link.person_id, recordId: link.record_id, recordType: typeOf.get(link.record_id) ?? "asset", name: contact.full_name ?? "Someone", email: contact.email ?? null, invite });
  }
  for (const row of (suggestions.data ?? []) as Array<{ id: string; record_id: string; extracted_name: string; extracted_role: string | null; match_person_id: string | null; match_kind: string | null }>) {
    if (!role.test(row.extracted_role ?? "")) continue;
    if (row.match_person_id && seen.has(row.match_person_id)) continue;
    const matched = row.match_kind === "exact" && row.match_person_id ? contactById.get(row.match_person_id) : null;
    people.push({ kind: "found", key: `suggestion:${row.id}`, suggestionId: row.id, recordId: row.record_id, recordType: typeOf.get(row.record_id) ?? "asset", name: row.extracted_name, match: matched ? { personId: matched.id, name: matched.full_name ?? row.extracted_name } : null });
  }
  return { recordId: records[0].id, people };
}
