export type VaultLifecycleState =
  | "OWNER_ACTIVE"
  | "DEATH_REPORTED"
  | "PROTECTIVE_LOCK"
  | "ESTATE_LOCKED"
  | "DEATH_STATUS_DISPUTED"
  | "OWNER_RECOVERY";

export type DeathReportStatus =
  | "draft"
  | "submitted"
  | "evidence_required"
  | "under_review"
  | "protective_lock_applied"
  | "confirmed"
  | "rejected"
  | "disputed"
  | "cancelled"
  | "owner_recovery_required"
  | "closed";

export type EstateClaimStatus =
  | "claimed"
  | "identity_required"
  | "identity_verified"
  | "authority_evidence_required"
  | "authority_under_review"
  | "approved"
  | "active"
  | "suspended"
  | "revoked"
  | "rejected";

export type DeathReportAction =
  | "review"
  | "apply_protective_lock"
  | "confirm_death"
  | "reject"
  | "dispute"
  | "start_owner_recovery"
  | "approve_owner_recovery"
  | "close";

export type EstateClaimAction =
  | "mark_identity_verified"
  | "submit_authority"
  | "approve"
  | "reject"
  | "suspend"
  | "revoke";

export type DeathReportRow = {
  id: string;
  owner_user_id: string;
  claimant_user_id: string;
  claimant_role: string;
  relationship: string | null;
  status: DeathReportStatus;
  date_of_death: string | null;
  declaration_accepted: boolean;
  claimant_identity_level: number;
  claimant_presence_verified_at: string | null;
  vault_state_at_report: VaultLifecycleState;
  related_probate_case_id: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by_user_id: string | null;
  decision_reason: string | null;
  closed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type EstateAccessClaimRow = {
  id: string;
  death_report_id: string | null;
  probate_case_id: string | null;
  owner_user_id: string;
  claimant_user_id: string;
  access_grant_id: string | null;
  role_claimed: string;
  status: EstateClaimStatus;
  required_identity_level: number;
  authority_evidence_status: string;
  permissions: Record<string, unknown>;
  approved_at: string | null;
  approved_by_user_id: string | null;
  suspended_at: string | null;
  revoked_at: string | null;
  decision_reason: string | null;
  metadata: Record<string, unknown>;
};
