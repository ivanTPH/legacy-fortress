import type { SectionKey } from "../access-control/roles";
import { evaluateCompletionCount, getWorkflowStageConfig } from "../workflow/blockingModel";

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

export function buildCompletionChecklist(input: CompletionInput): CompletionItem[] {
  const profileScore = Number(input.profile.hasProfile) + Number(input.profile.hasAddress) + Number(input.profile.hasContact);
  const profileStatus =
    profileScore === 0 ? "not_started" : profileScore === 3 ? "complete" : "in_progress";

  return [
    {
      section: "profile",
      label: getWorkflowStageConfig("profile").label,
      href: getWorkflowStageConfig("profile").href,
      status: profileStatus,
      percent: Math.round((profileScore / 3) * 100),
      missingItems: 3 - profileScore,
    },
    {
      section: "personal",
      label: getWorkflowStageConfig("personal").label,
      href: getWorkflowStageConfig("personal").href,
      ...evaluateCompletionCount(input.personal.total),
    },
    {
      section: "financial",
      label: getWorkflowStageConfig("financial").label,
      href: getWorkflowStageConfig("financial").href,
      ...evaluateCompletionCount(input.financial.total),
    },
    {
      section: "legal",
      label: getWorkflowStageConfig("legal").label,
      href: getWorkflowStageConfig("legal").href,
      ...evaluateCompletionCount(input.legal.total),
    },
    {
      section: "property",
      label: getWorkflowStageConfig("property").label,
      href: getWorkflowStageConfig("property").href,
      ...evaluateCompletionCount(input.property.total),
    },
    {
      section: "business",
      label: getWorkflowStageConfig("business").label,
      href: getWorkflowStageConfig("business").href,
      ...evaluateCompletionCount(input.business.total),
    },
    {
      section: "digital",
      label: getWorkflowStageConfig("digital").label,
      href: getWorkflowStageConfig("digital").href,
      ...evaluateCompletionCount(input.digital.total),
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
