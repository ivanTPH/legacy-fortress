import { assetMatchesLegalCategory } from "../legalCategories.ts";
import { getAssetsForBucket, getAssetsForFinanceCategory } from "../dashboard/summary.ts";
import type { VaultPreferences } from "../vaultPreferences.ts";
import { namedPeople, type VaultFacts } from "./nextSteps.ts";

/**
 * Readiness score (owner decision 18 Nov 2026). Shown to the Vault owner only, on Home. Admin and partners
 * only ever see anonymous averages, never a person's score.
 *
 * It asks whether each essential is there, not how many: one bank account ticks Bank as fully as five.
 * Anything the owner marks "Doesn't apply" comes off the total, so nobody is stuck below 100% for things
 * they don't have.
 */
export type ReadinessKey = "will" | "named" | "bank" | "home" | "pension" | "insurance" | "savings" | "other";

export const READINESS_ITEMS: Array<{ key: ReadinessKey; label: string; weight: number; href: string; addLabel: string; notApplicableLabel: string; dismissKeys: string[] }> = [
  { key: "will", label: "Will", weight: 20, href: "/legal/wills?add=1", addLabel: "Add your Will", notApplicableLabel: "I don't have a Will", dismissKeys: [] },
  { key: "named", label: "Someone named to act", weight: 15, href: "/people-access", addLabel: "Name an executor or someone you trust", notApplicableLabel: "Not for me", dismissKeys: [] },
  { key: "bank", label: "Bank", weight: 15, href: "/finances/bank?add=1", addLabel: "Add a bank account", notApplicableLabel: "I don't have one", dismissKeys: [] },
  { key: "home", label: "Home", weight: 15, href: "/add?area=property", addLabel: "Add your home", notApplicableLabel: "I rent or don't own one", dismissKeys: [] },
  { key: "pension", label: "Pension", weight: 10, href: "/finances/pensions?add=1", addLabel: "Add a pension", notApplicableLabel: "I don't have one", dismissKeys: ["has_pension"] },
  { key: "insurance", label: "Insurance", weight: 10, href: "/finances/insurance?add=1", addLabel: "Add an insurance policy", notApplicableLabel: "I don't have any", dismissKeys: ["has_life_insurance"] },
  { key: "savings", label: "Savings", weight: 10, href: "/finances/investments?add=1", addLabel: "Add savings or investments", notApplicableLabel: "I don't have any", dismissKeys: ["has_savings"] },
  { key: "other", label: "Other", weight: 5, href: "/add", addLabel: "Add something else that matters", notApplicableLabel: "Nothing else", dismissKeys: [] },
];

const READINESS_ICONS: Record<ReadinessKey, string> = {
  will: "gavel", named: "person_add", bank: "account_balance", home: "home", pension: "savings", insurance: "shield", savings: "trending_up", other: "inventory_2",
};

export const readinessPreferenceKey = (key: ReadinessKey) => `readiness_${key}`;

export type ReadinessItemState = {
  key: ReadinessKey;
  label: string;
  weight: number;
  /** 0, a part (the Will without its signing date; people named but nobody has joined yet) or 1. */
  done: number;
  notApplicable: boolean;
  /** Plain words for what's still missing, when part done. */
  hint: string | null;
  /** The next action in plain words, naming the document or person it's about (owner request 18 Nov 2026). */
  actionTitle: string;
  /** What it's about: the Will's title, the person's name. */
  subject: string | null;
  /** Opens the exact place to act: the Will itself, the person's page, or the add form. */
  href: string;
  icon: string;
  addLabel: string;
  notApplicableLabel: string;
};

export type Readiness = { percent: number; items: ReadinessItemState[]; nextSteps: ReadinessItemState[] };

function text(value: unknown) {
  return String(value ?? "").toLowerCase();
}

export function computeReadiness(facts: VaultFacts, preferences: Pick<VaultPreferences, "applicability"> = { applicability: {} }): Readiness {
  const rows = facts.rows.filter((row) => row.deleted_at == null && row.archived_at == null && row.status !== "archived");
  const banks = getAssetsForFinanceCategory(rows, "bank");
  const savingsBanks = banks.filter((row) => /sav|isa|deposit|bond/.test(text(row.metadata_json?.bank_account_type ?? row.title)));
  const wills = rows.filter((row) => assetMatchesLegalCategory(row, "wills"));
  const willSigned = wills.some((row) => String(row.metadata_json?.will_signed_on ?? "").trim() !== "");
  const executorPeople = namedPeople(facts, "will").people;
  const executorContacts = facts.contacts.filter((contact) => /executor|executrix/i.test(contact.role ?? ""));
  const activeNominations = facts.nominations.filter((nomination) => nomination.status === "active");
  const anyoneNamed = executorPeople.length > 0 || executorContacts.length > 0 || activeNominations.length > 0;
  const anyoneJoined = activeNominations.length > 0
    || executorPeople.some((person) => person.stage === "accepted" || person.stage === "nominated")
    || executorContacts.some((contact) => Boolean(contact.linkedUserId));
  const otherCount = getAssetsForBucket(rows, "business").length + getAssetsForBucket(rows, "digital").length
    + rows.filter((row) => text(row.section_key) === "personal" && !["executors", "beneficiaries", "tasks", "wishes", "next-of-kin"].includes(text(row.category_key))).length;

  // The Will to finish, and the person to invite, so each step can name them and open them directly.
  const unsignedWill = wills.find((row) => String(row.metadata_json?.will_signed_on ?? "").trim() === "");
  const willHref = (row: { id: string; kind: "asset" | "record" }) => `/legal/wills?${row.kind === "asset" ? "asset" : "record"}=${encodeURIComponent(row.id)}`;
  const waitingPerson = executorPeople.find((person) => person.stage === "added" && person.contactId)
    ?? executorPeople.find((person) => (person.stage === "invited" || person.stage === "invited_stale") && person.contactId);
  const waitingContact = waitingPerson ? null : executorContacts.find((contact) => !contact.linkedUserId);
  const waitingName = waitingPerson?.name ?? waitingContact?.name ?? null;
  const waitingId = waitingPerson?.contactId ?? waitingContact?.id ?? null;
  const waitingInvited = waitingPerson ? waitingPerson.stage !== "added" : false;
  const measured: Record<ReadinessKey, { done: number; hint: string | null; actionTitle?: string; subject?: string | null; href?: string }> = {
    will: wills.length || facts.willDocumentCount
      ? { done: willSigned ? 1 : 0.5, hint: willSigned ? null : "Add the date it was signed",
          actionTitle: "Add the date your Will was signed", subject: unsignedWill?.title?.trim() || "Your Will",
          href: unsignedWill ? willHref(unsignedWill) : "/legal/wills" }
      : { done: 0, hint: null },
    named: anyoneNamed
      ? { done: anyoneJoined ? 1 : 0.5, hint: anyoneJoined ? null : "Invite them so they can join",
          actionTitle: waitingName ? (waitingInvited ? `Remind ${waitingName} to join` : `Invite ${waitingName} to join`) : "Invite your executor to join",
          subject: waitingName ? "Your executor" : null,
          href: waitingId ? `/contacts?contact=${encodeURIComponent(waitingId)}` : "/contacts?group=executors" }
      : { done: 0, hint: null },
    bank: { done: banks.length ? 1 : 0, hint: null },
    home: { done: getAssetsForBucket(rows, "property").length ? 1 : 0, hint: null },
    pension: { done: getAssetsForFinanceCategory(rows, "pensions").length ? 1 : 0, hint: null },
    insurance: { done: getAssetsForFinanceCategory(rows, "insurance").length ? 1 : 0, hint: null },
    savings: { done: getAssetsForFinanceCategory(rows, "investments").length || savingsBanks.length ? 1 : 0, hint: null },
    other: { done: otherCount ? 1 : 0, hint: null },
  };

  const items = READINESS_ITEMS.map((item) => {
    const state = measured[item.key];
    const answered = [readinessPreferenceKey(item.key), ...item.dismissKeys].some((key) => preferences.applicability[key] === "not_relevant");
    // Something recorded always counts, even if it was once marked "Doesn't apply".
    const notApplicable = answered && state.done === 0;
    const partial = state.done > 0 && state.done < 1;
    return { key: item.key, label: item.label, weight: item.weight, done: state.done, notApplicable, hint: state.hint,
      actionTitle: partial && state.actionTitle ? state.actionTitle : item.addLabel,
      subject: partial ? state.subject ?? null : null,
      href: partial && state.href ? state.href : item.href,
      icon: READINESS_ICONS[item.key],
      addLabel: item.addLabel, notApplicableLabel: item.notApplicableLabel };
  });
  const counted = items.filter((item) => !item.notApplicable);
  const total = counted.reduce((sum, item) => sum + item.weight, 0);
  const achieved = counted.reduce((sum, item) => sum + item.weight * item.done, 0);
  const percent = total ? Math.round((achieved / total) * 100) : 100;
  const nextSteps = counted.filter((item) => item.done < 1).sort((a, b) => b.weight * (1 - b.done) - a.weight * (1 - a.done)).slice(0, 3);
  return { percent, items, nextSteps };
}
