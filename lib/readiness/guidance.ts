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
  | "attorney_after_capacity";

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
};

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
    title: "Have you thought about your Will?",
    description: "A Will can help make your wishes clearer. You can record what you have or note what you still want to arrange.",
    actionLabel: "Add my Will",
    href: "/legal/wills",
    learnMoreHref: "/legal/wills",
    applies: () => true,
    evidence: (evidence) => evidence.willCount > 0,
    defaultState: "missing",
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
    applies: (evidence) => evidence.willCount > 0 && evidence.trustedPeopleCount === 0,
    evidence: (evidence) => evidence.trustedPeopleCount > 0,
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
      const state = decision?.state ?? (
        rule.evidence(evidence)
          ? "recorded"
          : selectedState === "recorded"
            ? "needs_review"
            : selectedState ?? rule.defaultState
      );
      return { ...rule, state, snoozedUntil: decision?.snoozedUntil ?? null };
    })
    .filter((item) => item.state !== "recorded" && item.state !== "not_relevant")
    .filter((item) => !isSnoozed(guidance[item.key], now));
}

export function applyGuidanceAction(
  preferences: VaultPreferences,
  key: GuidanceRuleKey,
  action: Extract<GuidanceAction, "already_done" | "not_relevant" | "remind_later">,
  now = new Date(),
): VaultPreferences {
  const state: VaultApplicabilityState = action === "not_relevant"
    ? "not_relevant"
    : action === "already_done"
      ? "needs_review"
      : "unknown";
  const snoozedUntil = action === "remind_later"
    ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const decision: VaultGuidanceDecision = { state, snoozedUntil, updatedAt: now.toISOString() };
  return {
    ...preferences,
    guidance: { ...preferences.guidance, [key]: decision },
  };
}
