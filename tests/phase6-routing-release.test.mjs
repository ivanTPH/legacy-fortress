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
