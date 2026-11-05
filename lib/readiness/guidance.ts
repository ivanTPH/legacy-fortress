import type {
  VaultApplicabilityState,
  VaultGuidanceDecision,
  VaultPreferences,
} from "../vaultPreferences";

export type GuidanceAction = "add" | "learn_more" | "already_done" | "not_relevant" | "remind_later";

export type GuidanceEvidence = {
  willCount: number;
  powerOfAttorneyCount: number;
  trustedPeopleCount: number;
  executorCount: number;
  digitalRecordCount: number;
  possessionCount: number;
  wishesCount: number;
  financeRecordCount: number;
};

export type GuidanceRuleKey =
  | "will"
  | "capacity_arrangements"
  | "people_i_trust"
  | "digital_life"
  | "personal_possessions"
  | "wishes"
  | "financial_administration"
  | "executor_after_will"
  | "attorney_after_capacity"
  // Progressive steps (lib/readiness/nextSteps.ts, 4 Nov 2026)
  | "review_executors" | "invite_executors" | "remind_executors" | "nominate_executors"
  | "review_attorneys" | "invite_attorneys" | "remind_attorneys"
  | "has_pension" | "has_savings" | "has_life_insurance"
  // Housekeeping once set up (5 Nov 2026)
  | "annual_review" | "will_still_current";

export type GuidanceItem = {
  key: GuidanceRuleKey;
  category: string;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  learnMoreHref?: string;
  state: VaultApplicabilityState;
  snoozedUntil: string | null;
  /** A critical prompt coming back a year after "Not now". */
  reasked?: boolean;
};

/**
 * How each prompt behaves (owner decision 5 Nov 2026). Critical things a family can't do without are never
 * dropped for good: "Not now" quiets them for a year, then we gently ask again. Ordinary things are asked
 * once; "No" settles them, and the yearly review covers any change. Housekeeping comes back on a cycle.
 */
export type PromptTier = "critical" | "ordinary" | "housekeeping";
export type PromptPolicy = { tier: PromptTier; remindDays: number; dismissDays: number | null; doneDays?: number; dismissLabel: string };
const CRITICAL: PromptPolicy = { tier: "critical", remindDays: 30, dismissDays: 365, dismissLabel: "Not now, ask me in a year" };
const ORDINARY: PromptPolicy = { tier: "ordinary", remindDays: 30, dismissDays: null, dismissLabel: "Not for me" };
export const PROMPT_POLICY: Record<GuidanceRuleKey, PromptPolicy> = {
  will: CRITICAL, capacity_arrangements: CRITICAL, executor_after_will: CRITICAL, attorney_after_capacity: CRITICAL,
  review_executors: CRITICAL, invite_executors: CRITICAL, remind_executors: { ...CRITICAL, remindDays: 14 }, nominate_executors: CRITICAL,
  review_attorneys: CRITICAL, invite_attorneys: CRITICAL, remind_attorneys: { ...CRITICAL, remindDays: 14 },
  people_i_trust: ORDINARY, digital_life: ORDINARY, personal_possessions: ORDINARY, wishes: ORDINARY, financial_administration: ORDINARY,
  has_pension: { ...ORDINARY, dismissLabel: "I don't have one" }, has_savings: { ...ORDINARY, dismissLabel: "I don't have any" },
  has_life_insurance: { ...ORDINARY, dismissLabel: "I don't have any" },
  annual_review: { tier: "housekeeping", remindDays: 30, dismissDays: 365, doneDays: 365, dismissLabel: "Ask me next year" },
  will_still_current: { tier: "housekeeping", remindDays: 60, dismissDays: 730, doneDays: 730, dismissLabel: "It's still current" },
};
const DAY = 24 * 60 * 60 * 1000;

type GuidanceRule = Omit<GuidanceItem, "state" | "snoozedUntil"> & {
  applies: (evidence: GuidanceEvidence) => boolean;
  evidence: (evidence: GuidanceEvidence) => boolean;
  defaultState: VaultApplicabilityState;
};

export const GUIDANCE_RULES: GuidanceRule[] = [
  {
    key: "will",
    category: "Legal",
    priority: "high",
    title: "Do you have a Will?",
    description: "A Will can help record how you want your estate dealt with and who should deal with it.",
    actionLabel: "Add my Will",
    href: "/legal/wills?add=1",
    learnMoreHref: "/support?topic=will",
    applies: () => true,
    evidence: (evidence) => evidence.willCount > 0,
    defaultState: "unknown",
  },
  {
    key: "capacity_arrangements",
    category: "Legal",
    priority: "high",
    title: "Who could help if you could not manage things yourself?",
    description: "You may want to record a power of attorney or another capacity arrangement, depending on your circumstances and jurisdiction.",
    actionLabel: "Add an arrangement",
    href: "/legal/power-of-attorney",
    learnMoreHref: "/legal/power-of-attorney",
    applies: () => true,
    evidence: (evidence) => evidence.powerOfAttorneyCount > 0,
    defaultState: "missing",
  },
  {
    key: "people_i_trust",
    category: "People",
    priority: "medium",
    title: "Who are the people you trust?",
    description: "Recording a trusted person can make it easier to organise future conversations and invitations when you are ready.",
    actionLabel: "Add a trusted person",
    href: "/contacts",
    applies: () => true,
    evidence: (evidence) => evidence.trustedPeopleCount > 0,
    defaultState: "missing",
  },
  {
    key: "digital_life",
    category: "Digital life",
    priority: "medium",
    title: "Have you thought about your digital life?",
    description: "Email, social media, cloud accounts and important online services are easy to overlook. Store useful information, never passwords.",
    actionLabel: "Add digital information",
    href: "/vault/digital",
    applies: () => true,
    evidence: (evidence) => evidence.digitalRecordCount > 0,
    defaultState: "missing",
  },
  {
    key: "personal_possessions",
    category: "Possessions",
    priority: "low",
    title: "Is there anything meaningful you would like to remember?",
    description: "Jewellery, watches, collections, photographs and heirlooms may be worth recording alongside their practical details.",
    actionLabel: "Add a possession",
    href: "/vault/personal",
    applies: () => true,
    evidence: (evidence) => evidence.possessionCount > 0,
    defaultState: "missing",
  },
  {
    key: "wishes",
    category: "Wishes",
    priority: "medium",
    title: "Would you like to record any wishes?",
    description: "You can keep personal wishes, funeral preferences, charitable wishes or pet-care notes together for later review.",
    actionLabel: "Add a wish",
    href: "/personal/wishes",
    applies: () => true,
    evidence: (evidence) => evidence.wishesCount > 0,
    defaultState: "missing",
  },
  {
    key: "financial_administration",
    category: "Finances",
    priority: "low",
    title: "Have you captured your regular commitments?",
    description: "Insurance, debts, standing orders and recurring commitments can be useful to review as your circumstances change.",
    actionLabel: "Review finances",
    href: "/finances",
    applies: () => true,
    evidence: (evidence) => evidence.financeRecordCount > 0,
    defaultState: "missing",
  },
  {
    key: "executor_after_will",
    category: "People",
    priority: "high",
    title: "Would you like to add an executor?",
    description: "You have recorded Will information. Adding the people named to act can make the next step easier to review later.",
    actionLabel: "Add an executor",
    href: "/contacts?group=executors",
    applies: (evidence) => evidence.willCount > 0 && evidence.executorCount === 0,
    evidence: (evidence) => evidence.executorCount > 0,
    defaultState: "missing",
  },
  {
    key: "attorney_after_capacity",
    category: "People",
    priority: "high",
    title: "Would you like to add the people named in your arrangement?",
    description: "You have recorded a capacity arrangement. You can add the relevant people now without giving them access automatically.",
    actionLabel: "Add a person",
    href: "/contacts?group=trusted-contacts",
    applies: (evidence) => evidence.powerOfAttorneyCount > 0 && evidence.trustedPeopleCount === 0,
    evidence: (evidence) => evidence.trustedPeopleCount > 0,
    defaultState: "missing",
  },
];

function isSnoozed(decision: VaultGuidanceDecision | undefined, now: Date) {
  return Boolean(decision?.snoozedUntil && new Date(decision.snoozedUntil).getTime() > now.getTime());
}

export function buildGuidanceItems(
  evidence: GuidanceEvidence,
  preferences: Pick<VaultPreferences, "applicability" | "guidance"> = { applicability: {}, guidance: {} },
  now = new Date(),
): GuidanceItem[] {
  const applicability = preferences.applicability ?? {};
  const guidance = preferences.guidance ?? {};
  return GUIDANCE_RULES
    .filter((rule) => rule.applies(evidence))
    .map((rule) => {
      const decision = guidance[rule.key];
      const selectedState = applicability[rule.key];
      const state = rule.evidence(evidence)
        ? "recorded"
        : decision?.state ?? (
            selectedState === "recorded"
              ? "needs_review"
              : selectedState ?? rule.defaultState
          );
      const policy = PROMPT_POLICY[rule.key];
      const reasked = !rule.evidence(evidence) && policy.tier === "critical" && decision?.state === "not_relevant" && !isSnoozed(decision, now);
      if (reasked) return { ...getReaskRule(rule), state: "missing" as VaultApplicabilityState, snoozedUntil: null, reasked: true };
      const contextualRule = rule.key === "will" ? getWillGuidanceRule(rule, state) : rule;
      return { ...contextualRule, state, snoozedUntil: decision?.snoozedUntil ?? null };
    })
    .filter((item) => item.state !== "recorded" && item.state !== "not_relevant")
    .filter((item) => !isSnoozed(guidance[item.key], now));
}

/** A year after "Not now" on something critical: one gentle question, never a nag. */
function getReaskRule(rule: GuidanceRule): GuidanceRule {
  const titles: Partial<Record<GuidanceRuleKey, string>> = {
    will: "A year ago you said you didn't have a Will. Has anything changed?",
    capacity_arrangements: "Last year you hadn't set up a Power of Attorney. Is it worth another look?",
    executor_after_will: "Have you thought again about adding the executors named in your Will?",
    attorney_after_capacity: "Have you thought again about adding the people named in your Power of Attorney?",
  };
  return { ...rule, title: titles[rule.key] ?? rule.title };
}

function getWillGuidanceRule(rule: GuidanceRule, state: VaultApplicabilityState): GuidanceRule {
  if (state === "no") {
    return {
      ...rule,
      title: "We'd recommend making a Will",
      description: "Without a Will, the law decides who inherits and your family may wait longer to sort things out. A solicitor, an online Will service or one of our partners can help, often in an afternoon.",
      actionLabel: "See my options",
      href: "/support?topic=will",
      learnMoreHref: "/support?topic=will",
    };
  }
  if (state === "unsure") {
    return {
      ...rule,
      title: "Would you like to understand what a Will does?",
      description: "Take a little time to understand the purpose of a Will before deciding what you want to record.",
      actionLabel: "Learn about Wills",
      href: "/support?topic=will",
      learnMoreHref: "/support?topic=will",
    };
  }
  if (state === "yes") {
    return {
      ...rule,
      title: "Would you like to add your Will to your Fortress?",
      description: "Add the document or record its details when you are ready. You can add executors afterwards.",
      actionLabel: "Add my Will",
      href: "/legal/wills?add=1",
      learnMoreHref: "/support?topic=will",
    };
  }
  return rule;
}

export function applyGuidanceAction(
  preferences: VaultPreferences,
  key: GuidanceRuleKey,
  action: Extract<GuidanceAction, "already_done" | "not_relevant" | "remind_later">,
  now = new Date(),
): VaultPreferences {
  const policy = PROMPT_POLICY[key] ?? ORDINARY;
  const willUnsure = key === "will" && preferences.applicability?.will === "unsure";
  // Housekeeping "done" ("Nothing has changed", "It's still current") just comes back on its cycle.
  const housekeepingDone = policy.tier === "housekeeping" && action !== "remind_later";
  const state: VaultApplicabilityState = housekeepingDone
    ? "unknown"
    : action === "not_relevant"
      ? "not_relevant"
      : action === "already_done"
        ? "needs_review"
        : "unknown";
  const days = action === "remind_later"
    ? (willUnsure ? 90 : policy.remindDays)
    : housekeepingDone
      ? (action === "already_done" ? policy.doneDays : policy.dismissDays) ?? null
      : action === "not_relevant" ? policy.dismissDays : null;
  const snoozedUntil = days ? new Date(now.getTime() + days * DAY).toISOString() : null;
  const decision: VaultGuidanceDecision = { state, snoozedUntil, updatedAt: now.toISOString() };
  return {
    ...preferences,
    guidance: { ...preferences.guidance, [key]: decision },
  };
}

/** What we tell the person after they choose, in plain words. */
export function describeGuidanceChoice(key: GuidanceRuleKey, action: "already_done" | "not_relevant" | "remind_later") {
  const policy = PROMPT_POLICY[key] ?? ORDINARY;
  if (policy.tier === "housekeeping") return action === "remind_later" ? "We'll remind you in a few weeks." : "Thanks. We'll check in again next time.";
  if (action === "remind_later") return `We'll remind you in ${policy.remindDays >= 60 ? `${Math.round(policy.remindDays / 30)} months` : `${policy.remindDays} days`}.`;
  if (action === "not_relevant") return policy.tier === "critical" ? "Understood. We'll ask again in a year, in case anything has changed." : "Understood. We won't ask again; your yearly check-in will cover any changes.";
  return "Noted. You can review this again from your Vault.";
}
