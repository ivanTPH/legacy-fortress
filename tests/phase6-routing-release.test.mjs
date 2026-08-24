import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { getDefaultLandingForRoles } from "../lib/auth/platformRoles.ts";
import { canRoleAccessPath, getAccessAreaForPath, isInternalAccessRoute } from "../lib/accessModel.ts";
import { buildPrototypeWorkspaceUrl, getCurrentWorkspaceForPath } from "../lib/workspaces.ts";

const root = process.cwd();

test("Phase 6 canonical route entries exist without removing compatibility routes", () => {
  assert.equal(existsSync(`${root}/app/(app)/access/page.tsx`), true);
  assert.equal(existsSync(`${root}/app/enterprise/page.tsx`), true);
  assert.equal(existsSync(`${root}/app/admin/page.tsx`), true);
  assert.equal(existsSync(`${root}/app/page.tsx`), true);

  const access = readFileSync(`${root}/app/(app)/access/page.tsx`, "utf8");
  const enterprise = readFileSync(`${root}/app/enterprise/page.tsx`, "utf8");
  assert.match(access, /AccessRequestsWorkspace/);
  assert.match(enterprise, /EnterpriseOperationsWorkspace/);
});

test("Phase 6 role-aware destinations use canonical operational routes", () => {
  assert.equal(getDefaultLandingForRoles(["consumer_user"]), "/dashboard");
  assert.equal(getDefaultLandingForRoles(["enterprise_admin"]), "/enterprise");
  assert.equal(buildPrototypeWorkspaceUrl("application"), "/dashboard");
  assert.equal(buildPrototypeWorkspaceUrl("contact_wallet"), "/access");
  assert.equal(buildPrototypeWorkspaceUrl("enterprise_admin"), "/enterprise");
  assert.equal(getCurrentWorkspaceForPath("/access"), "contact_wallet");
  assert.equal(getCurrentWorkspaceForPath("/enterprise"), "enterprise_admin");
});

test("Phase 6 route authorization keeps admin and enterprise boundaries server-side", () => {
  assert.equal(isInternalAccessRoute("/admin"), true);
  assert.equal(isInternalAccessRoute("/enterprise"), true);
  assert.equal(getAccessAreaForPath("/enterprise"), "enterprise_admin");
  assert.equal(canRoleAccessPath(["consumer_user"], "/admin"), false);
  assert.equal(canRoleAccessPath(["consumer_user"], "/enterprise"), false);
  assert.equal(canRoleAccessPath(["enterprise_admin"], "/enterprise"), true);
  assert.equal(canRoleAccessPath(["super_admin"], "/admin"), true);
  assert.equal(canRoleAccessPath(["executor"], "/access"), true);
});

test("Phase 6 hosted smoke harnesses use canonical routes", () => {
  const contactSmoke = readFileSync(`${root}/scripts/smoke-contact-consistency.mjs`, "utf8");
  const invitationSmoke = readFileSync(`${root}/scripts/smoke-invitation-linked-access.mjs`, "utf8");
  const mobileCore = readFileSync(`${root}/scripts/smoke-mobile-core.mjs`, "utf8");
  const mobilePolish = readFileSync(`${root}/scripts/smoke-mobile-polish.mjs`, "utf8");
  const demoAccess = readFileSync(`${root}/scripts/smoke-demo-access.mjs`, "utf8");
  const dashboardBank = readFileSync(`${root}/scripts/smoke-dashboard-bank-dev.mjs`, "utf8");
  assert.doesNotMatch(contactSmoke, /\/app\/(?:dashboard|onboarding)/);
  assert.doesNotMatch(invitationSmoke, /\/app\/(?:dashboard|onboarding)/);
  assert.doesNotMatch(mobileCore, /\/app\/dashboard/);
  assert.doesNotMatch(mobilePolish, /\/app\/dashboard/);
  assert.doesNotMatch(demoAccess, /\/app\/dashboard/);
  assert.doesNotMatch(dashboardBank, /\/app\/dashboard/);
  assert.match(contactSmoke, /"\/dashboard"/);
  assert.match(invitationSmoke, /"\/dashboard"/);
});

test("Phase 6 Auth deletion does not mutate append-only audit rows", () => {
  const migration = readFileSync(
    `${root}/supabase/migrations/20260824090000_phase6_auth_lifecycle_audit_fk.sql`,
    "utf8",
  );
  assert.match(migration, /DROP CONSTRAINT IF EXISTS audit_events_actor_user_id_fkey/);
  assert.match(migration, /append-only/);
});

test("Phase 6 invitation smoke proves accepted-but-unverified denial", () => {
  const invitationSmoke = readFileSync(`${root}/scripts/smoke-invitation-linked-access.mjs`, "utf8");
  assert.match(invitationSmoke, /Accepted-but-unverified user read protected records/);
  assert.match(invitationSmoke, /Accepted-but-unverified user obtained a signed URL/);
  assert.match(invitationSmoke, /activation_status.*active/);
});

test("Phase 6 governance docs record policy matrix and production gate", () => {
  const governance = readFileSync(`${root}/LEGACY_FORTRESS_DATA_PROTECTION_GOVERNANCE.md`, "utf8");
  const policy = readFileSync(`${root}/LEGACY_FORTRESS_LEGAL_POLICY_REQUIREMENTS.md`, "utf8");
  const readiness = readFileSync(`${root}/LEGACY_FORTRESS_PRODUCTION_READINESS_CHECKLIST.md`, "utf8");
  assert.match(governance, /Canonical data domains and route boundaries/);
  assert.match(policy, /Identity Verification \/ Biometric Notice/);
  assert.match(policy, /Data Processing Agreement/);
  assert.match(readiness, /Production deployment remains prohibited/);
  assert.match(readiness, /Production KMS\/HSM/);
});
