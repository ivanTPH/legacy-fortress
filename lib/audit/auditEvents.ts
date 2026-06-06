export type AuditEventCategory =
  | "login_session"
  | "record_create"
  | "record_update"
  | "record_delete"
  | "document_upload"
  | "document_view"
  | "document_download"
  | "document_remove"
  | "consent_grant"
  | "consent_revoke"
  | "executor_invitation"
  | "executor_review"
  | "admin_review"
  | "admin_approval"
  | "report_access"
  | "report_export_attempt"
  | "restricted_action_blocked"
  | "billing_licence_placeholder"
  | "campaign_outreach_blocked";

export type AuditEventResult = "success" | "pending" | "rejected" | "blocked" | "disabled" | "preview_only";

export type AuditActorType = "user" | "executor" | "admin" | "organisation_user" | "support" | "system";

export type AuditResourceType =
  | "session"
  | "record"
  | "document"
  | "contact"
  | "case"
  | "verification"
  | "report"
  | "organisation"
  | "licence"
  | "campaign"
  | "access_policy";

export type AuditGovernanceMetadata = {
  consentChecked?: boolean;
  adviserInsightConsent?: boolean;
  marketingConsent?: boolean;
  exportEnabled?: false;
  prototypeOnly?: boolean;
  restrictedReason?: string;
  policyDecision?: string;
};

export type PlatformAuditEvent = {
  id: string;
  category: AuditEventCategory;
  timestamp: string;
  actor: {
    id: string | null;
    type: AuditActorType;
    displayName: string;
    role?: string | null;
  };
  action: string;
  result: AuditEventResult;
  policyDecision?: string;
  resource: {
    type: AuditResourceType;
    id: string | null;
    label?: string | null;
  };
  context: {
    surface: string;
    organisationId?: string | null;
    caseId?: string | null;
    route?: string | null;
  };
  governance?: AuditGovernanceMetadata;
};

export type AuditPersistenceAdapter = {
  recordEvent(event: PlatformAuditEvent): Promise<{ stored: boolean; eventId: string }>;
};

export type AuditPersistenceValidationIssue =
  | "preview_timestamp"
  | "prototype_event"
  | "missing_actor_identity"
  | "missing_resource_identity"
  | "missing_governance_metadata"
  | "missing_policy_decision";

export type AuditPersistenceEnvelope = {
  event: PlatformAuditEvent;
  storageMode: "ready_for_append_only" | "blocked_preview";
  idempotencyKey: string;
  validationIssues: AuditPersistenceValidationIssue[];
};

export const AUDIT_EVENT_CATEGORIES: AuditEventCategory[] = [
  "login_session",
  "record_create",
  "record_update",
  "record_delete",
  "document_upload",
  "document_view",
  "document_download",
  "document_remove",
  "consent_grant",
  "consent_revoke",
  "executor_invitation",
  "executor_review",
  "admin_review",
  "admin_approval",
  "report_access",
  "report_export_attempt",
  "restricted_action_blocked",
  "billing_licence_placeholder",
  "campaign_outreach_blocked",
];

export const auditPersistenceReadiness = {
  currentAdapter: "prototype_preview_only",
  futureAdapter: "production_audit_event_store",
  rule: "Prototype audit events are preview data only and must not be treated as persisted compliance logs.",
  requiredBeforeProduction: [
    "append-only audit event store",
    "trusted actor/session identity",
    "ISO timestamp generated server-side",
    "idempotency key for duplicate-safe writes",
    "resource permission checks",
    "consent/governance metadata capture",
    "export and campaign blocked-action recording",
  ],
} as const;

export function createPrototypeAuditEvent(input: Omit<PlatformAuditEvent, "timestamp" | "governance"> & {
  timestamp?: string;
  governance?: AuditGovernanceMetadata;
}): PlatformAuditEvent {
  return {
    ...input,
    timestamp: input.timestamp ?? "Static preview timestamp",
    governance: {
      prototypeOnly: true,
      ...input.governance,
    },
  };
}

export function buildPrototypeAuditPreviewEvents(surface: string): PlatformAuditEvent[] {
  const surfaceLabel = surface.replace(/_/g, " ");
  return [
    createPrototypeAuditEvent({
      id: `${surface}-access-preview`,
      category: "report_access",
      actor: { id: null, type: "admin", displayName: "Mock admin", role: "prototype_admin" },
      action: `${surfaceLabel} viewed`,
      result: "preview_only",
      resource: { type: "report", id: null, label: surfaceLabel },
      context: { surface },
      governance: { consentChecked: true, exportEnabled: false },
    }),
    createPrototypeAuditEvent({
      id: `${surface}-consent-check`,
      category: "restricted_action_blocked",
      actor: { id: null, type: "system", displayName: "System preview" },
      action: "Consent gate checked before restricted data display",
      result: "preview_only",
      resource: { type: "access_policy", id: null, label: "Consent policy" },
      context: { surface },
      governance: { consentChecked: true, restrictedReason: "Adviser and marketing consent are enforced before insight detail or outreach readiness." },
    }),
    createPrototypeAuditEvent({
      id: `${surface}-export-blocked`,
      category: "report_export_attempt",
      actor: { id: null, type: "system", displayName: "System preview" },
      action: "Export action held behind production governance",
      result: "disabled",
      resource: { type: "report", id: null, label: surfaceLabel },
      context: { surface },
      governance: { exportEnabled: false, restrictedReason: "Exports require production audit persistence and permission checks." },
    }),
  ];
}

export function validateAuditEventForPersistence(event: PlatformAuditEvent): AuditPersistenceValidationIssue[] {
  const issues: AuditPersistenceValidationIssue[] = [];
  const needsGovernance = event.category === "restricted_action_blocked"
    || event.category === "report_export_attempt"
    || event.category === "campaign_outreach_blocked"
    || event.category === "admin_approval"
    || event.category === "consent_grant"
    || event.category === "consent_revoke";

  if (event.timestamp === "Static preview timestamp" || Number.isNaN(Date.parse(event.timestamp))) {
    issues.push("preview_timestamp");
  }

  if (event.governance?.prototypeOnly !== false) {
    issues.push("prototype_event");
  }

  if (event.actor.type !== "system" && !event.actor.id) {
    issues.push("missing_actor_identity");
  }

  if (!event.resource.id && event.resource.type !== "access_policy") {
    issues.push("missing_resource_identity");
  }

  if (needsGovernance && !event.governance) {
    issues.push("missing_governance_metadata");
  }

  if (needsGovernance && !(event.policyDecision || event.governance?.policyDecision || event.governance?.restrictedReason)) {
    issues.push("missing_policy_decision");
  }

  return issues;
}

export function buildAuditPersistenceEnvelope(event: PlatformAuditEvent): AuditPersistenceEnvelope {
  const validationIssues = validateAuditEventForPersistence(event);
  return {
    event,
    storageMode: validationIssues.length === 0 ? "ready_for_append_only" : "blocked_preview",
    idempotencyKey: [
      event.category,
      event.actor.id ?? event.actor.type,
      event.resource.type,
      event.resource.id ?? "none",
      event.context.organisationId ?? "no-org",
      event.context.caseId ?? "no-case",
      event.context.route ?? event.context.surface,
      event.id,
    ].join(":"),
    validationIssues,
  };
}
