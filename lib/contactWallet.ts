import type { ViewerAccessState } from "./access-control/viewerAccess.ts";

export type ContactWalletAssuranceLevel = 0 | 1 | 2 | 3 | 4;

export type ContactWalletTask = {
  id: string;
  title: string;
  detail: string;
  status: "blocked" | "available" | "complete";
  requiredAssuranceLevel: ContactWalletAssuranceLevel;
};

export const CONTACT_WALLET_ENTITLEMENT = {
  key: "contact_wallet",
  label: "Contact Wallet",
  paidSubscriptionRequired: false,
  conversionOptional: true,
} as const;

export const CONTACT_WALLET_ASSURANCE_LEVELS: Record<ContactWalletAssuranceLevel, {
  label: string;
  permitted: string[];
  blocked: string[];
}> = {
  0: {
    label: "Invitation only",
    permitted: ["Open invitation landing page", "View inviter summary", "Start registration"],
    blocked: ["Protected documents", "Legal evidence upload", "Detailed vault records"],
  },
  1: {
    label: "Registered and email verified",
    permitted: ["Enter Contact Wallet onboarding", "View relationship summary", "Manage basic account settings"],
    blocked: ["Sensitive record access", "Probate evidence upload", "Protected decisions"],
  },
  2: {
    label: "Phone and MFA ready",
    permitted: ["Enter Contact Wallet dashboard", "View relationship and verification status", "See non-sensitive responsibilities"],
    blocked: ["Protected document download", "High-risk legal actions"],
  },
  3: {
    label: "Identity verified",
    permitted: ["View relationship status", "Request review of legal authority", "Use separately authorised evidence actions"],
    blocked: ["Vault records without explicit release", "Step-up protected actions without recent strong authentication"],
  },
  4: {
    label: "Recent strong authentication",
    permitted: ["Review separately authorised records", "Use approved evidence or recovery actions"],
    blocked: ["Vault records without explicit release", "Actions outside the approved release scope"],
  },
};

export function getContactWalletAssuranceLevel(input: {
  emailVerified?: boolean;
  phoneVerified?: boolean;
  mfaEnabled?: boolean;
  kycVerified?: boolean;
  recentStrongAuth?: boolean;
}): ContactWalletAssuranceLevel {
  if (input.recentStrongAuth && input.kycVerified && input.mfaEnabled) return 4;
  if (input.kycVerified && input.mfaEnabled) return 3;
  if (input.phoneVerified && input.mfaEnabled) return 2;
  if (input.emailVerified) return 1;
  return 0;
}

export function buildContactWalletTasks(viewer: ViewerAccessState, assuranceLevel: ContactWalletAssuranceLevel): ContactWalletTask[] {
  const tasks: ContactWalletTask[] = [
    {
      id: "confirm-role",
      title: `Review your ${viewer.viewerRole.replace(/_/g, " ")} responsibility`,
      detail: `Confirm what ${viewer.accountHolderName} has asked you to support before any protected access is used.`,
      status: viewer.activationStatus === "active" || viewer.activationStatus === "verified" ? "complete" : "available",
      requiredAssuranceLevel: 1,
    },
    {
      id: "security-setup",
      title: "Complete security setup",
      detail: "Phone verification and MFA are required before protected Contact Wallet actions are unlocked.",
      status: assuranceLevel >= 2 ? "complete" : "available",
      requiredAssuranceLevel: 2,
    },
    {
      id: "identity-verification",
      title: "Complete identity verification when requested",
      detail: "Protected legal documents and probate evidence require provider-confirmed identity verification.",
      status: assuranceLevel >= 3 ? "complete" : "blocked",
      requiredAssuranceLevel: 3,
    },
  ];

  if (viewer.viewerRole === "executor" || viewer.viewerRole === "power_of_attorney") {
    tasks.push({
      id: "probate-readiness",
      title: "Prepare probate evidence if requested",
      detail: "Death certificate or probate grant uploads stay unavailable until the required assurance level and case request are present.",
      status: assuranceLevel >= 3 ? "available" : "blocked",
      requiredAssuranceLevel: 3,
    });
  }

  return tasks;
}

export function buildSupportedPersonSummary(viewer: ViewerAccessState) {
  return {
    ownerUserId: viewer.targetOwnerUserId,
    accountHolderName: viewer.accountHolderName,
    contactName: viewer.linkedContactName || "Linked contact",
    role: viewer.viewerRole,
    activationStatus: viewer.activationStatus,
    grantId: viewer.grantId,
    allowedSections: viewer.assignedSectionKeys,
    readOnly: viewer.readOnly,
    conversionOptional: viewer.canUpgradeToOwnAccount,
  };
}
