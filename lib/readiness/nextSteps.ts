import { assetMatchesLegalCategory } from "../legalCategories.ts";
import { getAssetsForBucket, type DashboardAssetRow } from "../dashboard/summary.ts";
import { buildGuidanceItems, type GuidanceEvidence, type GuidanceItem } from "./guidance.ts";
import type { VaultPreferences } from "../vaultPreferences.ts";

/**
 * Next steps (owner decision 4 Nov 2026): ONE rule for To do, the notifications bell and the summary email.
 * Built from what is actually in the Vault, so it never asks for something already there, and progresses
 * one step at a time (e.g. Will → people it names → invited → accepted → chosen to receive the Vault).
 *
 * Every step has two wordings: `title` for inside the app (may name people; the app is private to the
 * owner) and `emailTitle` for email (never names, records or values).
 */
export type VaultFactRow = DashboardAssetRow & {
  id: string;
  kind: "asset" | "record";
  title?: string | null;
  metadata_json?: Record<string, unknown> | null;
};

export type VaultFacts = {
  rows: VaultFactRow[];                    // active assets and older records
  willDocumentCount: number;               // documents that are Wills but aren't on a Will record
  contacts: Array<{ id: string; name: string; role: string | null; linkedUserId: string | null }>;
  invitations: Array<{ contactId: string | null; status: string; sentAt: string | null }>;
  links: Array<{ recordId: string; personId: string; role: string }>;
  suggestions: Array<{ recordId: string; name: string; role: string | null; status: string; matchPersonId: string | null }>;
  nominations: Array<{ personId: string; status: string }>;
};

export type NextStep = GuidanceItem & {
  /** Wording for email: general, never personal. */
  emailTitle: string;
  /** Wording for the "Not relevant" button where something friendlier fits ("I don't have one"). */
  dismissLabel?: string;
};

const EXECUTOR_ROLES = /executor|executrix/i;
const ATTORNEY_ROLES = /attorney/i;
const STALE_INVITE_DAYS = 14;

/** The general (email) wording for every built-in prompt. */
const EMAIL_TITLES: Record<string, string> = {
  will: "Add your Will, if you have one",
  capacity_arrangements: "Think about who could help if you couldn't manage things yourself",
  people_i_trust: "Add the people you trust",
  digital_life: "Add your important online accounts",
  personal_possessions: "Record any possessions that matter to you",
  wishes: "Record your wishes",
  financial_administration: "Add your bank accounts and regular commitments",
  executor_after_will: "Add the executors named in your Will",
  attorney_after_capacity: "Add the people named in your Power of Attorney",
};

function activeRows(facts: VaultFacts) {
  return facts.rows.filter((row) => row.deleted_at == null && row.archived_at == null && row.status !== "archived");
}

function text(value: unknown) {
  return String(value ?? "").toLowerCase();
}

/** The counts the built-in prompts use, from the same classifiers the Legal and Dashboard pages use. */
export function evidenceFromFacts(facts: VaultFacts): GuidanceEvidence {
  const rows = activeRows(facts);
  const executorRows = rows.filter((row) => /executor/.test(`${text(row.category_key)} ${text(row.metadata_json?.executor_type)}`));
  const executorContacts = facts.contacts.filter((contact) => EXECUTOR_ROLES.test(contact.role ?? ""));
  const executorLinks = facts.links.filter((link) => EXECUTOR_ROLES.test(link.role));
  return {
    willCount: rows.filter((row) => assetMatchesLegalCategory(row, "wills")).length + facts.willDocumentCount,
    powerOfAttorneyCount: rows.filter((row) => assetMatchesLegalCategory(row, "power-of-attorney")).length,
    trustedPeopleCount: facts.contacts.length,
    executorCount: executorRows.length + executorContacts.length + executorLinks.length,
    digitalRecordCount: getAssetsForBucket(rows, "digital").length,
    possessionCount: rows.filter((row) => text(row.section_key) === "personal" && !["executors", "beneficiaries", "tasks", "wishes", "next-of-kin"].includes(text(row.category_key))).length,
    wishesCount: rows.filter((row) => /wish|funeral|instruction/.test(`${text(row.section_key)} ${text(row.category_key)} ${text(row.title)}`)).length,
    financeRecordCount: getAssetsForBucket(rows, "finance").length,
  };
}

function names(list: string[]) {
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

type PersonStage = "suggested" | "added" | "invited" | "invited_stale" | "accepted" | "nominated";

/** Where each person named on a Will or Power of Attorney is in the journey. */
export function namedPeople(facts: VaultFacts, kind: "will" | "poa", now = new Date()) {
  const rows = activeRows(facts).filter((row) => assetMatchesLegalCategory(row, kind === "will" ? "wills" : "power-of-attorney"));
  const recordIds = new Set(rows.map((row) => row.id));
  const roleTest = kind === "will" ? EXECUTOR_ROLES : ATTORNEY_ROLES;
  const people = new Map<string, { key: string; name: string; contactId: string | null; stage: PersonStage }>();
  for (const suggestion of facts.suggestions) {
    if (!recordIds.has(suggestion.recordId) || suggestion.status !== "pending" || !roleTest.test(suggestion.role ?? "")) continue;
    const key = suggestion.matchPersonId ?? `name:${suggestion.name.toLowerCase()}`;
    if (!people.has(key)) people.set(key, { key, name: suggestion.name, contactId: suggestion.matchPersonId, stage: "suggested" });
  }
  const contactById = new Map(facts.contacts.map((contact) => [contact.id, contact]));
  const linkedIds = new Set<string>();
  for (const link of facts.links) if (recordIds.has(link.recordId) && roleTest.test(link.role)) linkedIds.add(link.personId);
  // Executors recorded as people (role on the contact) count too when a Will is recorded.
  if (rows.length) for (const contact of facts.contacts) if (roleTest.test(contact.role ?? "")) linkedIds.add(contact.id);
  for (const personId of linkedIds) {
    const contact = contactById.get(personId);
    if (!contact) continue;
    const invites = facts.invitations.filter((invite) => invite.contactId === personId);
    const nominated = facts.nominations.some((nomination) => nomination.personId === personId && nomination.status === "active");
    const accepted = Boolean(contact.linkedUserId) || invites.some((invite) => invite.status === "accepted");
    const pending = invites.find((invite) => invite.status === "pending");
    const stale = pending?.sentAt ? now.getTime() - Date.parse(pending.sentAt) > STALE_INVITE_DAYS * 86400000 : false;
    const stage: PersonStage = nominated ? "nominated" : accepted ? "accepted" : pending ? (stale ? "invited_stale" : "invited") : "added";
    people.set(personId, { key: personId, name: contact.name, contactId: personId, stage });
  }
  return { hasDocument: rows.length > 0, people: [...people.values()] };
}

function step(input: Omit<NextStep, "state" | "snoozedUntil" | "category"> & { category?: string }): NextStep {
  return { category: input.category ?? "People", state: "missing", snoozedUntil: null, ...input };
}

/** Will and Power of Attorney journeys: review → add → invite → accepted → choose what they receive. */
function peopleSteps(facts: VaultFacts, now: Date): NextStep[] {
  const steps: NextStep[] = [];
  const will = namedPeople(facts, "will", now);
  const poa = namedPeople(facts, "poa", now);
  const journey = (list: typeof will.people, label: "executor" | "attorney", docName: string, href: string) => {
    const plural = `${label}s`;
    const suggested = list.filter((person) => person.stage === "suggested");
    if (suggested.length) steps.push(step({
      key: `review_${label}s` as const, priority: "high",
      title: `Your ${docName} names ${names(suggested.map((person) => person.name))} as ${suggested.length === 1 ? `an ${label}` : plural}. Check and add them.`,
      emailTitle: `Check the ${plural} found in your ${docName}`,
      description: "We found these names when reading your document. Nothing is shared until you choose to.",
      actionLabel: "Review", href,
    }));
    const toInvite = list.filter((person) => person.stage === "added");
    if (toInvite.length) steps.push(step({
      key: `invite_${label}s` as const, priority: "high",
      title: `Invite ${names(toInvite.map((person) => person.name))}, your ${toInvite.length === 1 ? label : plural}, to connect`,
      emailTitle: `Invite your ${plural} to connect`,
      description: "Connecting doesn't show them anything. It means they're ready if they're ever needed.",
      actionLabel: "Invite", href: "/people-access",
    }));
    const stale = list.filter((person) => person.stage === "invited_stale");
    if (stale.length) steps.push(step({
      key: `remind_${label}s` as const, priority: "medium",
      title: `${names(stale.map((person) => person.name))} ${stale.length === 1 ? "hasn't" : "haven't"} accepted your invitation yet`,
      emailTitle: `An ${label} hasn't accepted your invitation yet`,
      description: "You can send the invitation again, or check the email address is right.",
      actionLabel: "Send again", href: "/people-access",
    }));
    if (label === "executor") {
      const toNominate = list.filter((person) => person.stage === "accepted");
      if (toNominate.length) steps.push(step({
        key: "nominate_executors", priority: "medium",
        title: `Choose what ${names(toNominate.map((person) => person.name))} should receive after your death`,
        emailTitle: "Choose what your executors receive after your death",
        description: "Nominate them for later. Nothing opens until after your death, and only after checks.",
        actionLabel: "Choose", href: "/people-access?view=vault",
      }));
    }
  };
  journey(will.people, "executor", "Will", "/legal/wills");
  journey(poa.people, "attorney", "Power of Attorney", "/legal/power-of-attorney");
  return steps;
}

/** Things most households have, suggested only next to related records, each with "I don't have one". */
function typeSteps(facts: VaultFacts): NextStep[] {
  const rows = activeRows(facts);
  const finance = getAssetsForBucket(rows, "finance");
  const has = (category: string) => finance.some((row) => text(row.category_key) === category);
  const bankTypes = finance.filter((row) => text(row.category_key) === "bank").map((row) => text(row.metadata_json?.bank_account_type ?? row.title));
  const steps: NextStep[] = [];
  if (finance.length && !has("pensions")) steps.push(step({
    key: "has_pension", category: "Finances", priority: "medium",
    title: "Do you have a pension? Most people have at least one, often from a job.",
    emailTitle: "Add your pensions, if you have any",
    description: "Workplace and personal pensions are among the hardest things for families to trace.",
    actionLabel: "Add a pension", href: "/finances/pensions", dismissLabel: "I don't have one",
  }));
  if (bankTypes.length && !bankTypes.some((type) => /sav|isa|deposit/.test(type)) && !has("investments")) steps.push(step({
    key: "has_savings", category: "Finances", priority: "low",
    title: "Do you have savings or an ISA as well as your current account?",
    emailTitle: "Add any savings accounts or ISAs",
    description: "Savings accounts and ISAs are often with a different bank from your current account.",
    actionLabel: "Add savings", href: "/finances/bank?add=1", dismissLabel: "I don't have any",
  }));
  if (finance.length && !has("insurance")) steps.push(step({
    key: "has_life_insurance", category: "Finances", priority: "low",
    title: "Do you have life insurance or other policies?",
    emailTitle: "Add any insurance policies",
    description: "Life cover, home and car policies help your family know who to contact.",
    actionLabel: "Add a policy", href: "/finances/insurance", dismissLabel: "I don't have any",
  }));
  return steps;
}

/**
 * The one list. Answers saved by the owner ("Not relevant", "Remind me later") apply to every step.
 * Ordered by priority (high, medium, low), keeping the usual order within each.
 */
export function buildNextSteps(
  facts: VaultFacts,
  preferences: Pick<VaultPreferences, "applicability" | "guidance"> = { applicability: {}, guidance: {} },
  now = new Date(),
): NextStep[] {
  const evidence = evidenceFromFacts(facts);
  const guidance = preferences.guidance ?? {};
  const people = peopleSteps(facts, now);
  const builtIn = buildGuidanceItems(evidence, preferences, now)
    // A specific executor or attorney step replaces the general one.
    .filter((item) => !(item.key === "executor_after_will" && people.some((entry) => String(entry.key).endsWith("_executors")))
      && !(item.key === "attorney_after_capacity" && people.some((entry) => String(entry.key).endsWith("_attorneys"))))
    .map((item) => ({ ...item, emailTitle: EMAIL_TITLES[item.key] ?? "Take a look at your Vault" }));
  const extra = [...people, ...typeSteps(facts)].filter((item) => {
    const decision = guidance[item.key];
    // "Not relevant" / "I don't have one" and "Already done" both settle a progressive step.
    if (decision?.state === "not_relevant" || decision?.state === "recorded" || decision?.state === "needs_review") return false;
    return !(decision?.snoozedUntil && Date.parse(decision.snoozedUntil) > now.getTime());
  });
  // Most important first (people a family will need before possessions), keeping each group's order.
  const rank = { high: 0, medium: 1, low: 2 } as const;
  return [...builtIn, ...extra]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank[a.item.priority] - rank[b.item.priority] || a.index - b.index)
    .map(({ item }) => item);
}

/** For email: general wording only, each line once. */
export function emailLines(steps: NextStep[], limit = 5) {
  return [...new Set(steps.map((item) => item.emailTitle))].slice(0, limit);
}
