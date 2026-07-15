import type { SupabaseClient } from "@supabase/supabase-js";

type AnySupabaseClient = SupabaseClient;

export type ProbateCaseStatus =
  | "submitted"
  | "needs_information"
  | "under_review"
  | "approved"
  | "rejected"
  | "revoked"
  | "closed";

export type ProbateCaseAction = "request_information" | "review" | "approve" | "reject" | "revoke";

export type ProbateEvidenceType =
  | "death_certificate"
  | "probate_grant"
  | "will_executor_appointment"
  | "identity_document"
  | "relationship_statement"
  | "other_supporting_evidence";

export type ProbateCaseItem = {
  id: string;
  ownerUserId: string;
  ownerName: string;
  applicantUserId: string | null;
  contactId: string | null;
  contactName: string;
  contactEmail: string;
  contactInvitationId: string | null;
  roleAssignmentId: string | null;
  verificationRequestId: string | null;
  accessGrantId: string | null;
  assignedRole: string;
  caseType: string;
  status: ProbateCaseStatus;
  assignedReviewerUserId: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  internalReviewerNotes: string | null;
  applicantStatusMessage: string;
  accessExpiresAt: string | null;
  revokedAt: string | null;
  revocationReason: string | null;
  evidence: ProbateCaseEvidenceItem[];
  updatedAt: string;
};

export type ProbateCaseEvidenceItem = {
  id: string;
  caseId: string;
  evidenceType: ProbateEvidenceType;
  source: string;
  storageBucket: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  reviewStatus: string;
  createdAt: string;
};

type ProbateCaseRow = {
  id: string;
  owner_user_id: string;
  applicant_user_id: string | null;
  contact_id: string | null;
  contact_invitation_id: string | null;
  role_assignment_id: string | null;
  verification_request_id: string | null;
  access_grant_id: string | null;
  case_type: string;
  status: ProbateCaseStatus;
  assigned_reviewer_user_id: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  internal_reviewer_notes: string | null;
  applicant_status_message: string;
  access_expires_at: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
  updated_at: string;
};

type EvidenceRow = {
  id: string;
  case_id: string;
  evidence_type: ProbateEvidenceType;
  source: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  review_status: string;
  created_at: string;
};

type RoleRow = {
  id: string;
  invitation_id: string;
  owner_user_id: string;
  assigned_role: string;
  activation_status: string;
  permissions_override?: Record<string, unknown> | null;
};

type InvitationRow = {
  id: string;
  contact_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  assigned_role: string;
  accepted_user_id: string | null;
  owner_user_id: string;
};

type ContactRow = {
  id: string;
  full_name: string;
  email: string | null;
  relationship: string | null;
  linked_user_id: string | null;
  user_id: string | null;
};

type ProfileRow = {
  user_id: string;
  display_name: string | null;
};

const CASE_SELECT = "id,owner_user_id,applicant_user_id,contact_id,contact_invitation_id,role_assignment_id,verification_request_id,access_grant_id,case_type,status,assigned_reviewer_user_id,submitted_at,reviewed_at,decided_at,decision_reason,internal_reviewer_notes,applicant_status_message,access_expires_at,revoked_at,revocation_reason,updated_at";
const EVIDENCE_SELECT = "id,case_id,evidence_type,source,storage_bucket,storage_path,file_name,mime_type,size_bytes,review_status,created_at";

export function normalizeProbateCaseAction(value: string | null | undefined): ProbateCaseAction | null {
  const action = String(value ?? "").trim().toLowerCase();
  if (["request_information", "review", "approve", "reject", "revoke"].includes(action)) return action as ProbateCaseAction;
  return null;
}

export function normalizeEvidenceType(value: string | null | undefined): ProbateEvidenceType {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["death_certificate", "probate_grant", "will_executor_appointment", "identity_document", "relationship_statement", "other_supporting_evidence"].includes(normalized)) {
    return normalized as ProbateEvidenceType;
  }
  return "other_supporting_evidence";
}

export function sanitizeEvidenceFileName(fileName: string) {
  return String(fileName || "evidence-file")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140) || "evidence-file";
}

export async function loadProbateCases(client: AnySupabaseClient) {
  const casesRes = await client
    .from("probate_cases")
    .select(CASE_SELECT)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (casesRes.error) throw new Error(casesRes.error.message);

  const cases = (casesRes.data ?? []) as ProbateCaseRow[];
  return hydrateProbateCases(client, cases);
}

export async function getProbateCase(client: AnySupabaseClient, caseId: string) {
  const caseRes = await client.from("probate_cases").select(CASE_SELECT).eq("id", caseId).single();
  if (caseRes.error || !caseRes.data) throw new Error(caseRes.error?.message || "Probate case not found.");
  const [item] = await hydrateProbateCases(client, [caseRes.data as ProbateCaseRow]);
  if (!item) throw new Error("Probate case not found.");
  return item;
}

export async function submitProbateCaseFromVerification(
  client: AnySupabaseClient,
  {
    verificationRequestId,
    reviewerUserId,
  }: {
    verificationRequestId: string;
    reviewerUserId?: string | null;
  },
) {
  const existing = await client
    .from("probate_cases")
    .select(CASE_SELECT)
    .eq("verification_request_id", verificationRequestId)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return getProbateCase(client, String(existing.data.id));

  const verificationRes = await client
    .from("verification_requests")
    .select("id,owner_user_id,role_assignment_id,request_type,request_status,evidence_document_path,submitted_at,review_notes,created_at,updated_at")
    .eq("id", verificationRequestId)
    .single();
  if (verificationRes.error || !verificationRes.data) throw new Error(verificationRes.error?.message || "Verification request not found.");

  const roleRes = await client
    .from("role_assignments")
    .select("id,invitation_id,owner_user_id,assigned_role,activation_status")
    .eq("id", verificationRes.data.role_assignment_id)
    .single();
  if (roleRes.error || !roleRes.data) throw new Error(roleRes.error?.message || "Role assignment not found.");

  const invitationRes = await client
    .from("contact_invitations")
    .select("id,contact_id,contact_name,contact_email,assigned_role,accepted_user_id,owner_user_id")
    .eq("id", roleRes.data.invitation_id)
    .maybeSingle();
  if (invitationRes.error) throw new Error(invitationRes.error.message);

  const grantRes = await client
    .from("account_access_grants")
    .select("id")
    .eq("invitation_id", roleRes.data.invitation_id)
    .maybeSingle();
  if (grantRes.error) throw new Error(grantRes.error.message);

  const now = new Date().toISOString();
  const insertRes = await client
    .from("probate_cases")
    .insert({
      owner_user_id: verificationRes.data.owner_user_id,
      applicant_user_id: invitationRes.data?.accepted_user_id ?? null,
      contact_id: invitationRes.data?.contact_id ?? null,
      contact_invitation_id: invitationRes.data?.id ?? null,
      role_assignment_id: roleRes.data.id,
      verification_request_id: verificationRes.data.id,
      access_grant_id: grantRes.data?.id ?? null,
      case_type: verificationRes.data.request_type === "death_certificate" ? "probate_access" : "executor_verification",
      status: mapVerificationStatusToCaseStatus(String(verificationRes.data.request_status)),
      assigned_reviewer_user_id: reviewerUserId ?? null,
      submitted_at: verificationRes.data.submitted_at ?? now,
      decision_reason: verificationRes.data.review_notes ?? null,
      applicant_status_message: "Submitted for review.",
      created_at: now,
      updated_at: now,
    })
    .select(CASE_SELECT)
    .single();
  if (insertRes.error || !insertRes.data) throw new Error(insertRes.error?.message || "Could not create probate case.");

  if (verificationRes.data.evidence_document_path) {
    await client.from("probate_case_evidence").insert({
      case_id: insertRes.data.id,
      owner_user_id: verificationRes.data.owner_user_id,
      uploaded_by_user_id: invitationRes.data?.accepted_user_id ?? null,
      evidence_type: verificationRes.data.request_type === "death_certificate" ? "death_certificate" : "other_supporting_evidence",
      source: "legacy_path",
      storage_bucket: "vault-docs",
      storage_path: verificationRes.data.evidence_document_path,
      file_name: verificationRes.data.evidence_document_path.split("/").pop() || "Evidence file",
      mime_type: "application/octet-stream",
      size_bytes: 0,
    });
  }

  return getProbateCase(client, String(insertRes.data.id));
}

export async function applyProbateCaseAction(
  client: AnySupabaseClient,
  {
    caseId,
    action,
    reason,
    reviewerUserId,
  }: {
    caseId: string;
    action: ProbateCaseAction;
    reason: string;
    reviewerUserId: string;
  },
) {
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error("Decision notes are required for probate case actions.");

  const current = await getProbateCase(client, caseId);
  const now = new Date().toISOString();
  const status = getStatusForAction(action);
  const update: Record<string, unknown> = {
    status,
    assigned_reviewer_user_id: reviewerUserId,
    reviewed_at: now,
    decision_reason: trimmedReason,
    internal_reviewer_notes: trimmedReason,
    applicant_status_message: getApplicantStatusMessage(action),
    updated_at: now,
  };
  if (["approve", "reject"].includes(action)) update.decided_at = now;
  if (action === "revoke") {
    update.revoked_at = now;
    update.revoked_by = reviewerUserId;
    update.revocation_reason = trimmedReason;
  }

  let accessGrantId = current.accessGrantId;
  if (action === "approve") {
    accessGrantId = await activateCaseAccessGrant(client, current, now);
    update.access_grant_id = accessGrantId;
  }
  if (action === "reject") {
    await updateLinkedVerificationModels(client, current, {
      verificationStatus: "rejected",
      roleStatus: "rejected",
      grantStatus: "rejected",
      reviewerUserId,
      reason: trimmedReason,
      now,
    });
  }
  if (action === "revoke") {
    await updateLinkedVerificationModels(client, current, {
      roleStatus: "revoked",
      grantStatus: "revoked",
      reviewerUserId,
      reason: trimmedReason,
      now,
    });
  }
  if (action === "approve") {
    await updateLinkedVerificationModels(client, current, {
      verificationStatus: "approved",
      roleStatus: "verified",
      grantStatus: "active",
      reviewerUserId,
      reason: trimmedReason,
      now,
    });
  }

  const updateRes = await client.from("probate_cases").update(update).eq("id", caseId);
  if (updateRes.error) throw new Error(updateRes.error.message);
  return getProbateCase(client, caseId);
}

export async function addProbateCaseEvidence(
  client: AnySupabaseClient,
  {
    caseId,
    file,
    evidenceType,
    uploadedByUserId,
  }: {
    caseId: string;
    file: File;
    evidenceType: ProbateEvidenceType;
    uploadedByUserId: string;
  },
) {
  const probateCase = await getProbateCase(client, caseId);
  const safeName = sanitizeEvidenceFileName(file.name);
  const storageBucket = "vault-docs";
  const storagePath = `probate-evidence/${probateCase.ownerUserId}/${caseId}/${Date.now()}-${safeName}`;
  const upload = await client.storage.from(storageBucket).upload(storagePath, file, { upsert: false });
  if (upload.error) throw new Error(`Evidence upload failed: ${upload.error.message}`);

  const insertRes = await client
    .from("probate_case_evidence")
    .insert({
      case_id: caseId,
      owner_user_id: probateCase.ownerUserId,
      uploaded_by_user_id: uploadedByUserId,
      evidence_type: evidenceType,
      source: "case_upload",
      storage_bucket: storageBucket,
      storage_path: storagePath,
      file_name: safeName,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      review_status: "submitted",
    })
    .select(EVIDENCE_SELECT)
    .single();

  if (insertRes.error || !insertRes.data) {
    await client.storage.from(storageBucket).remove([storagePath]);
    throw new Error(insertRes.error?.message || "Evidence record could not be saved.");
  }

  await client.from("probate_cases").update({ updated_at: new Date().toISOString() }).eq("id", caseId);
  return mapEvidenceRow(insertRes.data as EvidenceRow);
}

export async function createProbateEvidenceSignedUrl(
  client: AnySupabaseClient,
  {
    caseId,
    evidenceId,
    expiresInSeconds = 300,
  }: {
    caseId: string;
    evidenceId: string;
    expiresInSeconds?: number;
  },
) {
  const evidenceRes = await client
    .from("probate_case_evidence")
    .select(EVIDENCE_SELECT)
    .eq("case_id", caseId)
    .eq("id", evidenceId)
    .is("deleted_at", null)
    .single();
  if (evidenceRes.error || !evidenceRes.data) throw new Error(evidenceRes.error?.message || "Evidence not found.");
  const evidence = evidenceRes.data as EvidenceRow;
  const signed = await client.storage.from(evidence.storage_bucket).createSignedUrl(evidence.storage_path, expiresInSeconds);
  if (signed.error || !signed.data?.signedUrl) throw new Error(signed.error?.message || "Evidence link could not be created.");
  return {
    evidence: mapEvidenceRow(evidence),
    signedUrl: signed.data.signedUrl,
    expiresInSeconds,
  };
}

async function hydrateProbateCases(client: AnySupabaseClient, cases: ProbateCaseRow[]) {
  if (!cases.length) return [];
  const ownerIds = [...new Set(cases.map((row) => row.owner_user_id))];
  const roleIds = [...new Set(cases.map((row) => row.role_assignment_id).filter(Boolean))] as string[];
  const invitationIds = [...new Set(cases.map((row) => row.contact_invitation_id).filter(Boolean))] as string[];
  const contactIds = [...new Set(cases.map((row) => row.contact_id).filter(Boolean))] as string[];
  const caseIds = cases.map((row) => row.id);

  const [profilesRes, rolesRes, invitationsRes, contactsRes, evidenceRes] = await Promise.all([
    client.from("user_profiles").select("user_id,display_name").in("user_id", ownerIds),
    roleIds.length ? client.from("role_assignments").select("id,invitation_id,owner_user_id,assigned_role,activation_status,permissions_override").in("id", roleIds) : { data: [], error: null },
    invitationIds.length ? client.from("contact_invitations").select("id,contact_id,contact_name,contact_email,assigned_role,accepted_user_id,owner_user_id").in("id", invitationIds) : { data: [], error: null },
    contactIds.length ? client.from("contacts").select("id,full_name,email,relationship,linked_user_id,user_id").in("id", contactIds) : { data: [], error: null },
    client.from("probate_case_evidence").select(EVIDENCE_SELECT).in("case_id", caseIds).is("deleted_at", null).order("created_at", { ascending: false }),
  ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (rolesRes.error) throw new Error(rolesRes.error.message);
  if (invitationsRes.error) throw new Error(invitationsRes.error.message);
  if (contactsRes.error) throw new Error(contactsRes.error.message);
  if (evidenceRes.error) throw new Error(evidenceRes.error.message);

  const profiles = new Map(((profilesRes.data ?? []) as ProfileRow[]).map((row) => [row.user_id, row.display_name ?? "Secure Account"]));
  const roles = new Map(((rolesRes.data ?? []) as RoleRow[]).map((row) => [row.id, row]));
  const invitations = new Map(((invitationsRes.data ?? []) as InvitationRow[]).map((row) => [row.id, row]));
  const contacts = new Map(((contactsRes.data ?? []) as ContactRow[]).map((row) => [row.id, row]));
  const evidenceByCase = new Map<string, ProbateCaseEvidenceItem[]>();
  for (const row of (evidenceRes.data ?? []) as EvidenceRow[]) {
    const list = evidenceByCase.get(row.case_id) ?? [];
    list.push(mapEvidenceRow(row));
    evidenceByCase.set(row.case_id, list);
  }

  return cases.map((row) => {
    const role = row.role_assignment_id ? roles.get(row.role_assignment_id) : null;
    const invitation = row.contact_invitation_id ? invitations.get(row.contact_invitation_id) : null;
    const contact = row.contact_id ? contacts.get(row.contact_id) : null;
    return {
      id: row.id,
      ownerUserId: row.owner_user_id,
      ownerName: String(profiles.get(row.owner_user_id) ?? "Secure Account"),
      applicantUserId: row.applicant_user_id,
      contactId: row.contact_id,
      contactName: contact?.full_name ?? invitation?.contact_name ?? "Unknown contact",
      contactEmail: contact?.email ?? invitation?.contact_email ?? "",
      contactInvitationId: row.contact_invitation_id,
      roleAssignmentId: row.role_assignment_id,
      verificationRequestId: row.verification_request_id,
      accessGrantId: row.access_grant_id,
      assignedRole: role?.assigned_role ?? invitation?.assigned_role ?? "executor",
      caseType: row.case_type,
      status: row.status,
      assignedReviewerUserId: row.assigned_reviewer_user_id,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      decidedAt: row.decided_at,
      decisionReason: row.decision_reason,
      internalReviewerNotes: row.internal_reviewer_notes,
      applicantStatusMessage: row.applicant_status_message,
      accessExpiresAt: row.access_expires_at,
      revokedAt: row.revoked_at,
      revocationReason: row.revocation_reason,
      evidence: evidenceByCase.get(row.id) ?? [],
      updatedAt: row.updated_at,
    } satisfies ProbateCaseItem;
  });
}

function mapEvidenceRow(row: EvidenceRow): ProbateCaseEvidenceItem {
  return {
    id: row.id,
    caseId: row.case_id,
    evidenceType: row.evidence_type,
    source: row.source,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes ?? 0),
    reviewStatus: row.review_status,
    createdAt: row.created_at,
  };
}

function mapVerificationStatusToCaseStatus(status: string): ProbateCaseStatus {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  return "submitted";
}

function getStatusForAction(action: ProbateCaseAction): ProbateCaseStatus {
  if (action === "request_information") return "needs_information";
  if (action === "review") return "under_review";
  if (action === "approve") return "approved";
  if (action === "reject") return "rejected";
  return "revoked";
}

function getApplicantStatusMessage(action: ProbateCaseAction) {
  if (action === "request_information") return "More information is required before review can continue.";
  if (action === "review") return "Your case is under review.";
  if (action === "approve") return "Approved for limited read-only access.";
  if (action === "reject") return "The request was rejected after review.";
  return "Access has been revoked.";
}

async function activateCaseAccessGrant(client: AnySupabaseClient, probateCase: ProbateCaseItem, now: string) {
  if (!probateCase.contactInvitationId) throw new Error("A linked invitation is required before access can be approved.");
  const [invitationRes, contactRes] = await Promise.all([
    client.from("contact_invitations").select("id,contact_id,contact_name,contact_email,assigned_role,accepted_user_id,owner_user_id").eq("id", probateCase.contactInvitationId).single(),
    probateCase.contactId ? client.from("contacts").select("id,full_name,email,relationship,linked_user_id,user_id").eq("id", probateCase.contactId).maybeSingle() : { data: null, error: null },
  ]);
  if (invitationRes.error || !invitationRes.data) throw new Error(invitationRes.error?.message || "Linked invitation not found.");
  if (contactRes.error) throw new Error(contactRes.error.message);

  const invitation = invitationRes.data as InvitationRow;
  const contact = contactRes.data as ContactRow | null;
  const linkedUserId = probateCase.applicantUserId ?? invitation.accepted_user_id ?? contact?.linked_user_id ?? contact?.user_id ?? null;
  if (!linkedUserId) throw new Error("An accepted linked user is required before access can be approved.");

  const grantRes = await client
    .from("account_access_grants")
    .upsert(
      {
        owner_user_id: probateCase.ownerUserId,
        linked_user_id: linkedUserId,
        contact_id: probateCase.contactId ?? invitation.contact_id,
        invitation_id: invitation.id,
        assigned_role: invitation.assigned_role || probateCase.assignedRole,
        relationship: contact?.relationship ?? null,
        activation_status: "active",
        permissions_override: {
          scope: "probate_case",
          case_id: probateCase.id,
          read_only: true,
          no_billing: true,
          no_owner_settings: true,
          approved_at: now,
        },
        updated_at: now,
      },
      { onConflict: "invitation_id" },
    )
    .select("id")
    .single();
  if (grantRes.error || !grantRes.data) throw new Error(grantRes.error?.message || "Access grant could not be activated.");
  return String(grantRes.data.id);
}

async function updateLinkedVerificationModels(
  client: AnySupabaseClient,
  probateCase: ProbateCaseItem,
  {
    verificationStatus,
    roleStatus,
    grantStatus,
    reviewerUserId,
    reason,
    now,
  }: {
    verificationStatus?: string;
    roleStatus?: string;
    grantStatus?: string;
    reviewerUserId: string;
    reason: string;
    now: string;
  },
) {
  if (probateCase.verificationRequestId && verificationStatus) {
    const verificationRes = await client
      .from("verification_requests")
      .update({
        request_status: verificationStatus,
        reviewed_at: now,
        reviewed_by: reviewerUserId,
        review_notes: reason,
        updated_at: now,
      })
      .eq("id", probateCase.verificationRequestId);
    if (verificationRes.error) throw new Error(verificationRes.error.message);
  }

  if (probateCase.roleAssignmentId && roleStatus) {
    const roleRes = await client
      .from("role_assignments")
      .update({ activation_status: roleStatus, updated_at: now })
      .eq("id", probateCase.roleAssignmentId);
    if (roleRes.error) throw new Error(roleRes.error.message);
  }

  if ((probateCase.accessGrantId || probateCase.contactInvitationId) && grantStatus) {
    let grantQuery = client.from("account_access_grants").update({ activation_status: grantStatus, updated_at: now });
    grantQuery = probateCase.accessGrantId
      ? grantQuery.eq("id", probateCase.accessGrantId)
      : grantQuery.eq("invitation_id", probateCase.contactInvitationId);
    const grantRes = await grantQuery;
    if (grantRes.error) throw new Error(grantRes.error.message);
  }
}
