import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("enterprise operations migration creates private operational tables without vault access", () => {
  const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260722103000_admin_enterprise_operations.sql"), "utf8");

  for (const table of [
    "admin_invitations",
    "enterprise_organisations",
    "enterprise_licences",
    "enterprise_seats",
    "enterprise_invitations",
    "enterprise_consent_settings",
    "enterprise_saved_views",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
  }

  assert.match(migration, /enterprise_licences_seat_entitlement_check CHECK \(allocated_seats <= purchased_seats\)/);
  assert.match(migration, /is_active_enterprise_operator/);
  assert.match(migration, /admin_users au/);
  assert.doesNotMatch(migration, /USING\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(migration, /section_entries|documents|attachments|assets/);
});

test("enterprise API enforces admin access, audit, seat limits and privacy exclusions", () => {
  const route = fs.readFileSync(path.join(root, "app/api/internal/admin/enterprise/route.ts"), "utf8");
  const actionCapabilities = fs.readFileSync(path.join(root, "lib/admin/enterpriseActionCapabilities.ts"), "utf8");
  const service = fs.readFileSync(path.join(root, "lib/admin/enterpriseOperations.ts"), "utf8");

  assert.match(route, /requireEnterpriseAccess\(request\)/);
  assert.match(route, /assertEnterpriseActionScope/);
  assert.match(route, /capabilityForEnterpriseAction/);
  assert.match(actionCapabilities, /create_organisation[\s\S]*organisation:manage/);
  assert.match(route, /recordAdminAuditEvent/);
  assert.match(route, /private_vault_content_excluded/);
  assert.match(route, /document_content_excluded/);
  assert.match(route, /financial_values_excluded/);

  assert.match(service, /assertSeatEntitlement/);
  assert.match(service, /seat_entitlement_exceeded/);
  assert.match(service, /hashInvitationToken/);
  assert.match(service, /minimum_reporting_cohort/);
  assert.match(service, /vaultContentExcluded: true/);
  assert.doesNotMatch(service, /\.from\("assets"\)|\.from\("documents"\)|\.from\("attachments"\)|\.from\("records"\)/);
});

test("enterprise workspace replaces disabled prototype with functional controls", () => {
  const page = fs.readFileSync(path.join(root, "app/application/enterprise/page.tsx"), "utf8");
  const workspace = fs.readFileSync(path.join(root, "components/enterprise/EnterpriseOperationsWorkspace.tsx"), "utf8");
  const switcher = fs.readFileSync(path.join(root, "lib/workspaces.ts"), "utf8");

  assert.match(page, /EnterpriseOperationsWorkspace/);
  assert.doesNotMatch(page, /workspace not yet enabled|blocked in hosted UAT/i);
  assert.match(workspace, /Create organisation/);
  assert.match(workspace, /Add organisation/);
  assert.match(workspace, /Create licence/);
  assert.match(workspace, /Send invitation/);
  assert.match(workspace, /Request governed export/);
  assert.match(workspace, /Private vault records, uploaded documents, legal contents, individual financial values/);
  assert.match(workspace, /AdminWorkspaceShell/);
  assert.match(workspace, /onSignOut=\{signOut\}/);
  assert.match(workspace, /supabase\.auth\.signOut\(\)/);
  assert.match(workspace, /setPortfolio\(EMPTY_PORTFOLIO\)/);
  assert.match(workspace, /router\.replace\("\/sign-in"\)/);
  assert.match(workspace, /router\.refresh\(\)/);
  assert.match(switcher, /return "\/enterprise"/);
});

test("enterprise organisation Phase 1 migration adds lifecycle fields without vault leakage", () => {
  const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260722193000_enterprise_organisation_management_phase1.sql"), "utf8");

  for (const column of [
    "primary_contact_telephone",
    "contract_reference",
    "customer_reference",
    "onboarding_status",
    "nominated_admin_email",
    "archived_at",
  ]) {
    assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`));
  }

  assert.match(migration, /'archived'/);
  assert.match(migration, /enterprise_organisations_registration_unique_idx/);
  assert.match(migration, /audit_events_enterprise_org_idx/);
  assert.doesNotMatch(migration, /section_entries|documents|attachments|assets/);
  assert.doesNotMatch(migration, /USING\s*\(\s*true\s*\)/i);
});

test("enterprise organisation API supports view, edit, lifecycle, delete/archive and audit", () => {
  const route = fs.readFileSync(path.join(root, "app/api/internal/admin/enterprise/route.ts"), "utf8");
  const actionCapabilities = fs.readFileSync(path.join(root, "lib/admin/enterpriseActionCapabilities.ts"), "utf8");
  const service = fs.readFileSync(path.join(root, "lib/admin/enterpriseOperations.ts"), "utf8");
  const capabilities = fs.readFileSync(path.join(root, "lib/admin/capabilities.ts"), "utf8");

  assert.match(route, /requireAdminCapability\(admin\.access, "organisation:view"\)/);
  assert.match(actionCapabilities, /create_organisation[\s\S]*organisation:manage/);
  assert.match(route, /getEnterpriseOrganisationDetail/);
  assert.match(route, /updateEnterpriseOrganisation/);
  assert.match(route, /transitionEnterpriseOrganisation/);
  assert.match(route, /deleteOrArchiveEnterpriseOrganisation/);
  assert.match(route, /Enterprise organisation action rejected/);

  assert.match(service, /stale_organisation_update/);
  assert.match(service, /duplicate_registration_number/);
  assert.match(service, /invalid_organisation_transition/);
  assert.match(service, /canHardDelete/);
  assert.match(service, /resource_type", "organisation"/);
  assert.doesNotMatch(service, /\.from\("assets"\)|\.from\("documents"\)|\.from\("attachments"\)|\.from\("records"\)/);

  assert.match(capabilities, /"organisation:view"/);
  assert.match(capabilities, /auditor:[\s\S]*"organisation:view"/);
  assert.doesNotMatch(capabilities, /support_agent:[\s\S]*"organisation:manage"[\s\S]*verification_reviewer:/);
});

test("enterprise organisation UI exposes operational navigation, create form and detail route", () => {
  const workspace = fs.readFileSync(path.join(root, "components/enterprise/EnterpriseOperationsWorkspace.tsx"), "utf8");
  const detail = fs.readFileSync(path.join(root, "components/enterprise/EnterpriseOrganisationDetailWorkspace.tsx"), "utf8");
  const route = fs.readFileSync(path.join(root, "app/application/enterprise/organisations/[organisationId]/page.tsx"), "utf8");

  for (const label of [
    "Users and seats",
    "Consent and compliance",
    "Renewals",
    "Account settings",
    "STAGING — synthetic test data may be present",
    "No licence configured",
    "Prepare administrator invitation",
    "Archive/delete",
  ]) {
    assert.match(workspace, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(route, /EnterpriseOrganisationDetailWorkspace/);
  assert.match(detail, /Edit organisation/);
  assert.match(detail, /Save organisation/);
  assert.match(detail, /Suspend/);
  assert.match(detail, /Reactivate/);
  assert.match(detail, /Archive or delete/);
  assert.match(detail, /auditEvents/);
  assert.match(detail, /Private customer vault records/);
  assert.doesNotMatch(workspace, /Static mock data|Prototype session|Northbridge|Harrington|Ledger House|Whitestone/);
});

test("admin invitations replace direct administrator activation", () => {
  const helper = fs.readFileSync(path.join(root, "lib/admin/adminInvitations.ts"), "utf8");
  const route = fs.readFileSync(path.join(root, "app/api/internal/admin/admin-users/route.ts"), "utf8");
  const workspace = fs.readFileSync(path.join(root, "components/admin/AdminControlPlaneWorkspace.tsx"), "utf8");

  assert.match(helper, /admin_invitations/);
  assert.match(helper, /token_hash/);
  assert.match(helper, /duplicate_pending_admin_invitation/);
  assert.match(route, /createAdminInvitation/);
  assert.doesNotMatch(route, /addAdminUser\(admin\.adminClient/);
  assert.match(workspace, /Invite administrator/);
  assert.match(workspace, /Review and send invitation/);
  assert.match(workspace, /The recipient is not active until they accept/);
  assert.match(workspace, /Permission summary/);
});
