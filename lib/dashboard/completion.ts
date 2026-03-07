import type { SectionKey } from "../access-control/roles";

export type CompletionState = "not_started" | "in_progress" | "complete";

export type CompletionInput = {
  profile: { hasProfile: boolean; hasAddress: boolean; hasContact: boolean };
  personal: { total: number };
  financial: { total: number };
  legal: { total: number };
  property: { total: number };
  business: { total: number };
  digital: { total: number };
};

export type CompletionItem = {
  section: Exclude<SectionKey, "dashboard" | "settings">;
  label: string;
  href: string;
  status: CompletionState;
  percent: number;
  missingItems: number;
};

function calcByCount(count: number, targetCompleteCount = 1): { status: CompletionState; percent: number; missingItems: number } {
  if (count <= 0) return { status: "not_started", percent: 0, missingItems: targetCompleteCount };
  if (count >= targetCompleteCount) return { status: "complete", percent: 100, missingItems: 0 };
  const percent = Math.max(1, Math.round((count / targetCompleteCount) * 100));
  return { status: "in_progress", percent, missingItems: targetCompleteCount - count };
}

export function buildCompletionChecklist(input: CompletionInput): CompletionItem[] {
  const profileScore = Number(input.profile.hasProfile) + Number(input.profile.hasAddress) + Number(input.profile.hasContact);
  const profileStatus =
    profileScore === 0 ? "not_started" : profileScore === 3 ? "complete" : "in_progress";

  return [
    {
      section: "profile",
      label: "Profile",
      href: "/profile",
      status: profileStatus,
      percent: Math.round((profileScore / 3) * 100),
      missingItems: 3 - profileScore,
    },
    {
      section: "personal",
      label: "Personal",
      href: "/vault/personal",
      ...calcByCount(input.personal.total),
    },
    {
      section: "financial",
      label: "Financial",
      href: "/vault/financial",
      ...calcByCount(input.financial.total),
    },
    {
      section: "legal",
      label: "Legal",
      href: "/vault/legal",
      ...calcByCount(input.legal.total),
    },
    {
      section: "property",
      label: "Property",
      href: "/vault/property",
      ...calcByCount(input.property.total),
    },
    {
      section: "business",
      label: "Business",
      href: "/vault/business",
      ...calcByCount(input.business.total),
    },
    {
      section: "digital",
      label: "Digital",
      href: "/vault/digital",
      ...calcByCount(input.digital.total),
    },
  ];
}

export function humanizeCompletionStatus(status: CompletionState) {
  switch (status) {
    case "complete":
      return "Completed";
    case "in_progress":
      return "Partially completed";
    default:
      return "Not completed";
  }
}
