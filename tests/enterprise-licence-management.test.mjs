import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("Phase 2 migration extends canonical licences and renewal history securely", () => {
  const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260723123000_enterprise_licence_seat_management_phase2.sql"), "utf8");

  for (const column of [
    "custom_plan_name",
    "end_date",
    "renewal_notice_days",
    "auto_renew",
    "renewal_notes",
    "cancelled_at",
    "suspended_at",
    "expired_at",
  ]) {
    assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`));
  }

  assert.match(migration, /enterprise_licence_renewals/);
  assert.match(migration, /ALTER TABLE public\.enterprise_licence_renewals ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /public\.is_active_enterprise_operator\(\)/);
  assert.match(migration, /'expired'/);
  assert.match(migration, /'starter','professional','enterprise','custom'/);
  assert.match(migration, /enterprise_licences_renewal_idx/);
  assert.doesNotMatch(migration, /USING\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(migration, /section_entries|documents|attachments|assets/);
});

test("enterprise licence service enforces plans, entitlement, lifecycle, renewal and privacy", () => {
  const service = fs.readFileSync(path.join(root, "lib/admin/enterpriseOperations.ts"), "utf8");

  assert.match(service, /ENTERPRISE_LICENCE_PLANS = \["starter", "professional", "enterprise", "custom"\]/);
  assert.match(service, /committedSeatsForRow/);
  assert.match(service, /active_seats[\s\S]*invited_seats[\s\S]*suspended_seats/);
  assert.match(service, /assertSeatEntitlement/);
  assert.match(service, /duplicate_open_licence/);
  assert.match(service, /isValidLicenceTransition/);
  assert.match(service, /renewEnterpriseLicence/);
  assert.match(service, /createEnterpriseSeatReservation/);
  assert.match(service, /licence_allocation_blocked/);
  assert.match(service, /seat_entitlement_exceeded/);
  assert.match(service, /vaultContentExcluded: true/);
  assert.doesNotMatch(service, /\.from\("assets"\)|\.from\("documents"\)|\.from\("attachments"\)|\.from\("records"\)/);
});

test("enterprise API exposes licence detail and per-action licence permissions", () => {
  const route = fs.readFileSync(path.join(root, "app/api/internal/admin/enterprise/route.ts"), "utf8");
  const capabilities = fs.readFileSync(path.join(root, "lib/admin/capabilities.ts"), "utf8");

  for (const action of [
    "create_licence",
    "update_licence",
    "change_licence_seats",
    "transition_licence",
    "renew_licence",
    "reserve_licence_seat",
  ]) {
    assert.match(route, new RegExp(action));
  }

  for (const capability of [
    "licence:view",
    "licence:create",
    "licence:edit",
    "licence:seats",
    "licence:renew",
    "licence:lifecycle",
    "licence:audit",
  ]) {
    assert.match(capabilities, new RegExp(capability.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(route, /getEnterpriseLicenceDetail/);
  assert.match(route, /Enterprise licence action rejected/);
  assert.match(route, /private_vault_content_excluded/);
});

test("licence UI has operational create, entitlement, renewal and lifecycle surfaces", () => {
  const portfolio = fs.readFileSync(path.join(root, "components/enterprise/EnterpriseOperationsWorkspace.tsx"), "utf8");
  const orgDetail = fs.readFileSync(path.join(root, "components/enterprise/EnterpriseOrganisationDetailWorkspace.tsx"), "utf8");
  const licenceDetail = fs.readFileSync(path.join(root, "components/enterprise/EnterpriseLicenceDetailWorkspace.tsx"), "utf8");
  const route = fs.readFileSync(path.join(root, "app/application/enterprise/licences/[licenceId]/page.tsx"), "utf8");

  for (const text of [
    "Create licence",
    "Custom plan name",
    "Purchased seats",
    "Available seats",
    "Renewal period",
    "Seat utilisation",
    "No licences are currently due for renewal.",
  ]) {
    assert.match(portfolio, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(orgDetail, /Configure licence/);
  assert.match(orgDetail, /create_licence/);
  assert.match(route, /EnterpriseLicenceDetailWorkspace/);

  for (const text of [
    "Seat usage",
    "Save seat entitlement",
    "Reserve seat",
    "Complete renewal",
    "Suspend",
    "Reactivate",
    "Cancel",
    "Private vault records",
  ]) {
    assert.match(licenceDetail, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
