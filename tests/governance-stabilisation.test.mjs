import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildPeopleContactEntity,
  PEOPLE_CONTACT_REPOSITORY_CONTRACT,
} from "../lib/contacts/contactRepository.ts";
import {
  buildPeopleRelationship,
  getPeopleRelationshipPolicy,
  inferPeopleRelationshipKind,
  PEOPLE_RELATIONSHIP_POLICIES,
} from "../lib/contacts/relationships.ts";
import {
  evaluateGovernanceAccess,
  governanceEngineReadiness,
} from "../lib/governance/policyEngine.ts";
import { createAuditPipeline } from "../lib/backend/auditPipeline.ts";
import {
  buildAuditPersistenceEnvelope,
  createPrototypeAuditEvent,
  validateAuditEventForPersistence,
} from "../lib/audit/auditEvents.ts";

const root = process.cwd();

function contact(overrides = {}) {
  return {
    id: "contact-1",
    owner_user_id: "owner-1",
    full_name: "Emma Carter",
    email: "emma@example.test",
    email_normalized: "emma@example.test",
    phone: "0207 000 1000",
    contact_role: "executor",
    relationship: "sister",
    linked_context: [{ source_kind: "asset", source_id: "asset-1", section_key: "legal", category_key: "executors", label: "Executor", role: "executor" }],
    invite_status: "invite_sent",
    verification_status: "invited",
    source_type: "executor_asset",
    permission_scope: ["executor_access"],
    validation_overrides: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

test("canonical People entity exposes governance-aware identity fields", () => {
  assert.ok(PEOPLE_CONTACT_REPOSITORY_CONTRACT.canonicalFields.includes("relationship_type"));
  assert.ok(PEOPLE_CONTACT_REPOSITORY_CONTRACT.canonicalFields.includes("consent_scope"));
  assert.ok(PEOPLE_CONTACT_REPOSITORY_CONTRACT.canonicalFields.includes("governance_flags"));
  assert.ok(PEOPLE_CONTACT_REPOSITORY_CONTRACT.canonicalFields.includes("audit_metadata"));

  const entity = buildPeopleContactEntity(contact());

  assert.equal(entity.id, "contact-1");
  assert.equal(entity.relationship_type, "executor");
  assert.equal(entity.contact_role, "executor");
  assert.equal(entity.invite_status, "invite_sent");
  assert.equal(entity.verification_status, "invited");
  assert.equal(entity.consent_scope.explicitDelegation, false);
  assert.equal(entity.governance_flags.exportRestricted, true);
  assert.equal(entity.governance_flags.requiresVerification, true);
  assert.equal(entity.audit_metadata.sourceModule, "records");
  assert.equal(entity.relationships[0]?.kind, "executor_assignment");
});

test("shared relationship layer covers executor, organisation, probate, reporting, and consent inheritance", () => {
  assert.equal(inferPeopleRelationshipKind("executor"), "executor_assignment");
  assert.equal(inferPeopleRelationshipKind("organisation_user"), "organisation_membership");
  assert.equal(inferPeopleRelationshipKind("probate_contact"), "probate_linkage");
  assert.equal(inferPeopleRelationshipKind("enterprise_contact"), "reporting_visibility");
  assert.equal(inferPeopleRelationshipKind("adviser"), "consent_inheritance");
  assert.equal(getPeopleRelationshipPolicy("reporting_visibility")?.requiredConsent, "adviser_insights");
  assert.ok(PEOPLE_RELATIONSHIP_POLICIES.every((policy) => policy.restrictedReason.length > 20));

  const relationship = buildPeopleRelationship({
    contactId: "contact-enterprise",
    relationshipType: "enterprise_contact",
    linkedContext: [{ source_kind: "record", source_id: "org-1", role: "organisation_owner" }],
    inheritedConsent: true,
  });
  assert.equal(relationship.kind, "reporting_visibility");
  assert.equal(relationship.inheritedConsent, true);
});

test("governance engine returns audit-compatible allowed and denied decisions", () => {
  assert.match(governanceEngineReadiness.deniedStateRule, /audit-compatible policy decision/);

  const allowed = evaluateGovernanceAccess({
    action: "view_enterprise_report",
    roles: ["enterprise_admin"],
    consent: { adviserInsights: true, marketing: false },
    targetEntity: { type: "report", id: "report-1" },
    prototypeOnly: true,
  });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.reason, "allowed");
  assert.equal(allowed.audit.policyDecision, "allowed");
  assert.equal(allowed.audit.governance.policyDecision, "allowed");

  const deniedConsent = evaluateGovernanceAccess({
    action: "view_enterprise_report",
    roles: ["enterprise_admin"],
    consent: { adviserInsights: false, marketing: true },
    targetEntity: { type: "report", id: "report-2" },
  });
  assert.equal(deniedConsent.allowed, false);
  assert.equal(deniedConsent.reason, "consent_required");
  assert.equal(deniedConsent.restrictedState?.title, "Access restricted");
  assert.equal(deniedConsent.audit.governance.exportEnabled, false);

  const deniedExport = evaluateGovernanceAccess({
    action: "export_report",
    roles: ["super_admin"],
    consent: { adviserInsights: true, marketing: true },
    targetEntity: { type: "report", id: "report-3" },
  });
  assert.equal(deniedExport.allowed, false);
  assert.equal(deniedExport.reason, "export_disabled");
  assert.equal(deniedExport.restrictedState?.status, 423);
});

test("audit pipeline carries policy decisions and consent context", async () => {
  const context = {
    requestId: "governance-1",
    principal: { userId: "admin-1", email: "admin@example.test", roles: ["enterprise_admin"], trustedRoleClaims: true },
    route: "/internal/admin/prototype/reports",
    environment: "test",
    governance: {
      consentChecked: true,
      adviserInsightConsent: false,
      marketingConsent: true,
      exportEnabled: false,
      policyDecision: "consent_required",
    },
  };

  const result = await createAuditPipeline().record({
    category: "restricted_action_blocked",
    action: "Insight detail blocked",
    result: "blocked",
    resource: { type: "report", id: "report-1", label: "Client insights" },
    context,
  });

  assert.equal(result.event.policyDecision, "consent_required");
  assert.equal(result.event.governance?.adviserInsightConsent, false);
  assert.equal(result.event.governance?.exportEnabled, false);
  assert.equal(result.persistence.storageMode, "blocked_preview");
  assert.ok(result.persistence.validationIssues.includes("prototype_event"));
  assert.ok(result.persistence.validationIssues.includes("preview_timestamp"));
});

test("audit persistence envelope blocks prototype events and accepts production-shaped append-only events", async () => {
  const preview = createPrototypeAuditEvent({
    id: "preview-export",
    category: "report_export_attempt",
    actor: { id: null, type: "admin", displayName: "Preview admin", role: "enterprise_admin" },
    action: "Export attempted",
    result: "disabled",
    resource: { type: "report", id: "report-1", label: "Client insights" },
    context: { surface: "client_insights", route: "/internal/admin/prototype/reports/client-insights" },
    governance: { exportEnabled: false, policyDecision: "export_disabled" },
  });
  const previewEnvelope = buildAuditPersistenceEnvelope(preview);
  assert.equal(previewEnvelope.storageMode, "blocked_preview");
  assert.ok(previewEnvelope.validationIssues.includes("prototype_event"));
  assert.ok(previewEnvelope.validationIssues.includes("preview_timestamp"));

  const productionReady = createPrototypeAuditEvent({
    id: "prod-export-blocked",
    category: "report_export_attempt",
    timestamp: "2026-05-17T12:00:00.000Z",
    actor: { id: "admin-1", type: "admin", displayName: "Admin", role: "enterprise_admin" },
    action: "Export blocked by governance",
    result: "blocked",
    policyDecision: "export_disabled",
    resource: { type: "report", id: "report-1", label: "Client insights" },
    context: { surface: "client_insights", route: "/internal/admin/prototype/reports/client-insights", organisationId: "org-1" },
    governance: { prototypeOnly: false, exportEnabled: false, consentChecked: true, policyDecision: "export_disabled" },
  });
  assert.deepEqual(validateAuditEventForPersistence(productionReady), []);
  const productionEnvelope = buildAuditPersistenceEnvelope(productionReady);
  assert.equal(productionEnvelope.storageMode, "ready_for_append_only");
  assert.match(productionEnvelope.idempotencyKey, /report_export_attempt:admin-1:report:report-1:org-1/);

  let writes = 0;
  const blocked = await createAuditPipeline({
    async recordEvent() {
      writes += 1;
      return { stored: true, eventId: "unexpected" };
    },
  }).record({
    category: "restricted_action_blocked",
    action: "Prototype write attempt",
    result: "blocked",
    resource: { type: "access_policy", id: null, label: "Prototype policy" },
    context: {
      requestId: "blocked-preview",
      principal: { userId: "admin-1", email: "admin@example.test", roles: ["enterprise_admin"], trustedRoleClaims: true },
      route: "/internal/admin/prototype/reports",
      environment: "test",
      governance: { policyDecision: "prototype_isolated", exportEnabled: false },
    },
  });
  assert.equal(blocked.stored, false);
  assert.equal(blocked.queued, false);
  assert.equal(writes, 0);
});

test("page surfaces use canonical relationship/governance helpers instead of new page-level people systems", () => {
  const invitationManager = fs.readFileSync(path.join(root, "app/(app)/components/dashboard/ContactInvitationManager.tsx"), "utf8");
  const workspace = fs.readFileSync(path.join(root, "components/records/UniversalRecordWorkspace.tsx"), "utf8");
  const rbac = fs.readFileSync(path.join(root, "lib/backend/rbacMiddleware.ts"), "utf8");
  const relationships = fs.readFileSync(path.join(root, "lib/contacts/relationships.ts"), "utf8");
  const governance = fs.readFileSync(path.join(root, "lib/governance/policyEngine.ts"), "utf8");

  assert.match(invitationManager, /contactRepository/);
  assert.match(workspace, /contactRepository/);
  assert.match(rbac, /evaluateGovernanceAccess/);
  assert.match(relationships, /PEOPLE_RELATIONSHIP_POLICIES/);
  assert.match(governance, /GOVERNANCE_ACTION_REQUIREMENTS/);
  assert.doesNotMatch(invitationManager, /from\("section_entries"\)/);
  assert.doesNotMatch(workspace, /function evaluateGovernanceAccess/);
});
