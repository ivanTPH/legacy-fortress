export type EstateCaseStatus =
  | "open"
  | "awaiting_authority"
  | "authority_under_review"
  | "administration_active"
  | "distribution_pending"
  | "completion_review"
  | "closed"
  | "suspended"
  | "disputed";

export type EstatePermission =
  | "view_estate_case"
  | "view_authorised_historic_data"
  | "view_estate_documents"
  | "download_estate_documents"
  | "contribute_estate_document"
  | "create_estate_task"
  | "update_estate_task"
  | "submit_authority_evidence"
  | "submit_valuation"
  | "record_liability"
  | "record_distribution"
  | "invite_estate_collaborator"
  | "manage_estate_collaborator"
  | "request_sensitive_action"
  | "approve_sensitive_action"
  | "close_estate_case";

export type EstateParticipantRole =
  | "executor"
  | "administrator"
  | "co_executor"
  | "solicitor"
  | "accountant"
  | "tax_adviser"
  | "valuer"
  | "trustee"
  | "beneficiary"
  | "authorised_representative"
  | "other";

export type EstateCaseRow = {
  id: string;
  owner_user_id: string;
  death_report_id: string | null;
  probate_case_id: string | null;
  case_reference: string;
  status: EstateCaseStatus;
  vault_state_at_open: string;
  opened_by_user_id: string | null;
  opened_at: string;
  closed_at: string | null;
  closure_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type EstateParticipantRow = {
  id: string;
  estate_case_id: string;
  estate_claim_id: string | null;
  user_id: string;
  participant_role: EstateParticipantRole;
  person_type: string;
  status: "invited" | "identity_required" | "authority_required" | "active" | "suspended" | "revoked" | "rejected";
  required_identity_level: number;
  permissions: Record<string, unknown>;
  added_by_user_id: string | null;
  suspended_at: string | null;
  revoked_at: string | null;
  decision_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SensitiveActionStatus = "requested" | "pending_approval" | "approved" | "rejected" | "expired" | "cancelled" | "executed";
