import type { AccessActivationStatus, CollaboratorRole } from "./roles.ts";

export const LF_IDENTITY_LEVEL_1_AUTHENTICATED = 1;
export const LF_IDENTITY_LEVEL_2_IDENTITY_VERIFIED = 2;
export const LF_IDENTITY_LEVEL_3_PRESENCE_REVERIFIED = 3;

export type IdentityAssuranceLevel =
  | typeof LF_IDENTITY_LEVEL_1_AUTHENTICATED
  | typeof LF_IDENTITY_LEVEL_2_IDENTITY_VERIFIED
  | typeof LF_IDENTITY_LEVEL_3_PRESENCE_REVERIFIED;

export type VaultLifecycleState =
  | "OWNER_ACTIVE"
  | "DEATH_REPORTED"
  | "PROTECTIVE_LOCK"
  | "ESTATE_LOCKED"
  | "DEATH_STATUS_DISPUTED"
  | "OWNER_RECOVERY";

export type ExplicitAccessPermission =
  | "view"
  | "view_summary"
  | "view_detail"
  | "download"
  | "contribute_document"
  | "manage_access"
  | "high_risk_access_change";

export type HighRiskAction =
  | "increase_access"
  | "change_executor_authority"
  | "change_trustee_authority"
  | "change_representative_authority"
  | "change_recovery_security"
  | "death_estate_access"
  | "owner_recovery";

export const ACTIVE_PROTECTED_GRANT_STATUSES: AccessActivationStatus[] = ["verified", "active"];

export const CONTACT_WALLET_GRANT_STATUSES: AccessActivationStatus[] = [
  "accepted",
  "pending_verification",
  "verification_submitted",
  "verified",
  "active",
];

export const MUTABLE_OWNER_VAULT_STATES: VaultLifecycleState[] = ["OWNER_ACTIVE", "OWNER_RECOVERY"];

export function normalizeIdentityAssuranceLevel(value: unknown): IdentityAssuranceLevel {
  const numeric = Number(value);
  if (numeric >= LF_IDENTITY_LEVEL_3_PRESENCE_REVERIFIED) return LF_IDENTITY_LEVEL_3_PRESENCE_REVERIFIED;
  if (numeric >= LF_IDENTITY_LEVEL_2_IDENTITY_VERIFIED) return LF_IDENTITY_LEVEL_2_IDENTITY_VERIFIED;
  return LF_IDENTITY_LEVEL_1_AUTHENTICATED;
}

export function isProtectedGrantActive(status: AccessActivationStatus | string | null | undefined) {
  return ACTIVE_PROTECTED_GRANT_STATUSES.includes(String(status ?? "") as AccessActivationStatus);
}

export function isContactWalletGrantVisible(status: AccessActivationStatus | string | null | undefined) {
  return CONTACT_WALLET_GRANT_STATUSES.includes(String(status ?? "") as AccessActivationStatus);
}

export function vaultAllowsOwnerMutation(state: VaultLifecycleState | string | null | undefined) {
  return MUTABLE_OWNER_VAULT_STATES.includes(normalizeVaultLifecycleState(state));
}

export function normalizeVaultLifecycleState(state: VaultLifecycleState | string | null | undefined): VaultLifecycleState {
  const normalized = String(state ?? "").trim().toUpperCase();
  if (
    normalized === "DEATH_REPORTED"
    || normalized === "PROTECTIVE_LOCK"
    || normalized === "ESTATE_LOCKED"
    || normalized === "DEATH_STATUS_DISPUTED"
    || normalized === "OWNER_RECOVERY"
  ) {
    return normalized;
  }
  return "OWNER_ACTIVE";
}

export function roleCanReceiveDocumentContribution(role: CollaboratorRole | string | null | undefined) {
  return role === "professional_advisor" || role === "lawyer" || role === "accountant" || role === "financial_advisor";
}

export function hasExplicitPermission(
  permissions: Record<string, unknown> | null | undefined,
  permission: ExplicitAccessPermission,
) {
  const source = permissions && typeof permissions === "object" ? permissions : {};
  const values = source["permissions"] ?? source["explicit_permissions"] ?? [];
  return Array.isArray(values) && values.map((item) => String(item ?? "").trim()).includes(permission);
}

export function canContributeDocument(input: {
  role: CollaboratorRole | string;
  activationStatus: AccessActivationStatus | string;
  identityLevel: IdentityAssuranceLevel | number;
  permissions: Record<string, unknown> | null | undefined;
  vaultState?: VaultLifecycleState | string | null;
}) {
  return (
    roleCanReceiveDocumentContribution(input.role)
    && isProtectedGrantActive(input.activationStatus)
    && normalizeIdentityAssuranceLevel(input.identityLevel) >= LF_IDENTITY_LEVEL_2_IDENTITY_VERIFIED
    && hasExplicitPermission(input.permissions, "contribute_document")
    && vaultAllowsOwnerMutation(input.vaultState)
  );
}

export function requiredIdentityLevelForHighRiskAction(action: HighRiskAction): IdentityAssuranceLevel {
  void action;
  return LF_IDENTITY_LEVEL_3_PRESENCE_REVERIFIED;
}

export function canPerformHighRiskAction(input: {
  action: HighRiskAction;
  identityLevel: IdentityAssuranceLevel | number;
}) {
  return normalizeIdentityAssuranceLevel(input.identityLevel) >= requiredIdentityLevelForHighRiskAction(input.action);
}
