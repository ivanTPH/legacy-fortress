export type OnboardingStepId =
  | "identity"
  | "verification"
  | "consent"
  | "personal_details"
  | "vault_categories"
  | "invite_contacts"
  | "send_invites"
  | "guided_tour"
  | "complete";

export type OnboardingStep = {
  id: OnboardingStepId;
  label: string;
  optional?: boolean;
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { id: "identity", label: "Identity" },
  { id: "verification", label: "Verification" },
  { id: "consent", label: "Terms and Marketing" },
  { id: "personal_details", label: "Personal details" },
  { id: "vault_categories", label: "Vault categories" },
  { id: "invite_contacts", label: "Invite contacts", optional: true },
  { id: "send_invites", label: "Send invitations", optional: true },
  { id: "guided_tour", label: "Guided tour", optional: true },
  { id: "complete", label: "Complete" },
];
