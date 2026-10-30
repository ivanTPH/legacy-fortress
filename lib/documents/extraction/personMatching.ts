import type { ExtractedPerson } from "./peopleExtraction.ts";

export type OwnerContact = { id: string; full_name: string | null };
export type PersonMatch = { personId: string | null; kind: "exact" | "possible" | "none" };

const ROLE_PRIORITY = ["Executor", "Reserve executor", "Attorney", "Replacement attorney", "Trustee", "Guardian", "Beneficiary", "Solicitor"];

export function normalisePersonName(value: string | null | undefined) {
  return String(value ?? "").toLowerCase().replace(/^(?:mr|mrs|ms|miss|mx|dr|prof|sir|dame|rev)\.?\s+/, "").replace(/[^a-z' -]/g, "").replace(/\s+/g, " ").trim();
}

/** One suggestion per person per document: a record link carries a single role. */
export function mergePeopleByName(people: ExtractedPerson[]) {
  const byName = new Map<string, ExtractedPerson>();
  for (const person of people) {
    const key = normalisePersonName(person.name);
    const current = byName.get(key);
    if (!current || rank(person.role) < rank(current.role)) byName.set(key, person);
  }
  return [...byName.values()];
}

/** Exact = same full name (one candidate only); possible = same surname and first initial. Never auto-links. */
export function matchOwnerContact(name: string, contacts: OwnerContact[]): PersonMatch {
  const target = normalisePersonName(name);
  const exact = contacts.filter((contact) => normalisePersonName(contact.full_name) === target);
  if (exact.length === 1) return { personId: exact[0].id, kind: "exact" };
  if (exact.length > 1) return { personId: exact[0].id, kind: "possible" };
  const parts = target.split(" ");
  const surname = parts.at(-1);
  const initial = parts[0]?.[0];
  const possible = contacts.filter((contact) => {
    const other = normalisePersonName(contact.full_name).split(" ");
    return other.length >= 2 && other.at(-1) === surname && other[0]?.[0] === initial;
  });
  if (possible.length >= 1) return { personId: possible[0].id, kind: "possible" };
  return { personId: null, kind: "none" };
}

function rank(role: string) {
  const index = ROLE_PRIORITY.indexOf(role);
  return index === -1 ? ROLE_PRIORITY.length : index;
}
