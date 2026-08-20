export type AccessAction =
  | "view"
  | "view_summary"
  | "view_detail"
  | "add"
  | "edit"
  | "delete"
  | "download"
  | "invite"
  | "contribute_document"
  | "manage_access"
  | "high_risk_access_change";

export type SectionKey =
  | "dashboard"
  | "profile"
  | "personal"
  | "financial"
  | "legal"
  | "property"
  | "business"
  | "digital"
  | "settings";

export type AccessActivationStatus =
  | "invited"
  | "accepted"
  | "pending_verification"
  | "verification_submitted"
  | "verified"
  | "active"
  | "rejected"
  | "revoked";

export type CollaboratorRole =
  | "owner"
  | "professional_advisor"
  | "accountant"
  | "financial_advisor"
  | "lawyer"
  | "trustee"
  | "executor"
  | "power_of_attorney"
  | "friend_or_family";

export type RoleRule = {
  role: CollaboratorRole;
  label: string;
  allowedSections: SectionKey[];
  allowedActions: AccessAction[];
  obscuredSections: SectionKey[];
  requiresVerifiedActivation: boolean;
};

const ALL_SECTIONS: SectionKey[] = [
  "dashboard",
  "profile",
  "personal",
  "financial",
  "legal",
  "property",
  "business",
  "digital",
  "settings",
];

export const ROLE_RULES: Record<CollaboratorRole, RoleRule> = {
  owner: {
    role: "owner",
    label: "Owner",
    allowedSections: ALL_SECTIONS,
    allowedActions: ["view", "view_summary", "view_detail", "add", "edit", "delete", "download", "invite"],
    obscuredSections: [],
    requiresVerifiedActivation: false,
  },
  professional_advisor: {
    role: "professional_advisor",
    label: "Advisor",
    allowedSections: ["dashboard", "financial", "legal", "property", "business", "settings"],
    allowedActions: ["view", "view_summary", "view_detail", "download"],
    obscuredSections: ["personal", "digital", "profile"],
    requiresVerifiedActivation: true,
  },
  accountant: {
    role: "accountant",
    label: "Accountant",
    allowedSections: ["dashboard", "financial"],
    allowedActions: ["view", "view_summary", "view_detail", "download"],
    obscuredSections: ["profile", "personal", "legal", "property", "business", "digital"],
    requiresVerifiedActivation: true,
  },
  financial_advisor: {
    role: "financial_advisor",
    label: "Advisor",
    allowedSections: ["dashboard", "financial", "legal", "property", "business"],
    allowedActions: ["view", "view_summary", "view_detail", "download"],
    obscuredSections: ["profile", "personal", "digital"],
    requiresVerifiedActivation: true,
  },
  lawyer: {
    role: "lawyer",
    label: "Lawyer",
    allowedSections: ["dashboard", "legal"],
    allowedActions: ["view", "view_summary", "view_detail", "download"],
    obscuredSections: ["profile", "personal", "financial", "property", "business", "digital"],
    requiresVerifiedActivation: true,
  },
  trustee: {
    role: "trustee",
    label: "Trustee",
    allowedSections: ["dashboard", "legal"],
    allowedActions: ["view", "view_summary"],
    obscuredSections: ["profile", "personal", "financial", "property", "business", "digital"],
    requiresVerifiedActivation: true,
  },
  executor: {
    role: "executor",
    label: "Executor",
    allowedSections: ["dashboard", "profile", "personal", "financial", "legal", "property", "business", "digital"],
    allowedActions: ["view", "view_summary", "view_detail", "download"],
    obscuredSections: [],
    requiresVerifiedActivation: true,
  },
  power_of_attorney: {
    role: "power_of_attorney",
    label: "Power of Attorney",
    allowedSections: ["dashboard", "profile", "personal", "financial", "legal", "property", "business", "digital"],
    allowedActions: ["view", "view_summary", "view_detail", "download"],
    obscuredSections: [],
    requiresVerifiedActivation: true,
  },
  friend_or_family: {
    role: "friend_or_family",
    label: "Friend or Family",
    allowedSections: ["dashboard", "profile", "personal", "financial", "legal", "property", "business", "digital"],
    allowedActions: ["view", "view_summary", "view_detail", "download"],
    obscuredSections: [],
    requiresVerifiedActivation: true,
  },
};

const ACTIVE_STATUSES: AccessActivationStatus[] = ["verified", "active"];

export function resolveRoleRule(role: CollaboratorRole) {
  return ROLE_RULES[role];
}

export function isActivationGranted(status: AccessActivationStatus) {
  return ACTIVE_STATUSES.includes(status);
}

export function canAccessSection(
  role: CollaboratorRole,
  section: SectionKey,
  action: AccessAction,
  activationStatus: AccessActivationStatus,
) {
  const rule = resolveRoleRule(role);

  if (!rule.allowedSections.includes(section)) return false;
  if (!rule.allowedActions.includes(action)) return false;

  if (role !== "owner" && ["view_detail", "download", "contribute_document", "manage_access", "high_risk_access_change"].includes(action)) {
    return isActivationGranted(activationStatus);
  }

  return true;
}

export function shouldObscureSection(
  role: CollaboratorRole,
  section: SectionKey,
  activationStatus: AccessActivationStatus,
) {
  const rule = resolveRoleRule(role);

  if (role !== "owner" && !isActivationGranted(activationStatus)) {
    return ["financial", "property", "business", "digital", "legal"].includes(section);
  }

  return rule.obscuredSections.includes(section);
}
