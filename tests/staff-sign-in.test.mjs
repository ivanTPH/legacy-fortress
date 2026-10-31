import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { tokenAssurance, staffMfaRequired } from "../lib/admin/access.ts";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const jwt = (payload) => `x.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.y`;
const now = () => Math.floor(Date.now() / 1000);

test("staff two-step verification is required unless a local server turns it off", () => {
  const before = process.env.STAFF_MFA_REQUIRED;
  delete process.env.STAFF_MFA_REQUIRED;
  assert.equal(staffMfaRequired(), true);
  process.env.STAFF_MFA_REQUIRED = "true";
  assert.equal(staffMfaRequired(), true);
  process.env.STAFF_MFA_REQUIRED = "false";
  assert.equal(staffMfaRequired(), false);
  if (before === undefined) delete process.env.STAFF_MFA_REQUIRED; else process.env.STAFF_MFA_REQUIRED = before;
});

test("only a recent authenticator code counts", () => {
  assert.deepEqual(tokenAssurance(jwt({ aal: "aal2", amr: [{ method: "totp", timestamp: now() - 60 }] })), { aal2: true, fresh: true });
  assert.deepEqual(tokenAssurance(jwt({ aal: "aal2", amr: [{ method: "totp", timestamp: now() - 13 * 3600 }] })), { aal2: true, fresh: false });
  assert.deepEqual(tokenAssurance(jwt({ aal: "aal1", amr: [{ method: "password", timestamp: now() }] })), { aal2: false, fresh: false });
  assert.deepEqual(tokenAssurance("not-a-token"), { aal2: false, fresh: false });
});

test("the code check runs after the role check, for staff and membership partners alike", () => {
  const access = read("lib/admin/access.ts");
  const admin = access.slice(access.indexOf("export async function requireAdminAccess"), access.indexOf("export async function requireEnterpriseAccess"));
  assert.ok(admin.indexOf("staffAssuranceFailure(") > admin.indexOf('message: "Admin access is restricted."'));
  const partner = access.slice(access.indexOf("export async function requireEnterpriseAccess"), access.indexOf("export async function resolveEnterpriseMembershipAccess"));
  assert.ok(partner.indexOf("staffAssuranceFailure(") > partner.indexOf("canAccessEnterpriseWorkspace) {"));
});

test("sign-in return paths stay inside the portal", async () => {
  const source = read("components/auth/StaffSignIn.tsx");
  assert.match(source, /value\.startsWith\(prefix\) && !value\.startsWith\("\/\/"\)/);
  const session = read("lib/auth/session.ts");
  assert.match(session, /\/admin\/sign-in\?next=/);
  assert.match(session, /\/enterprise\/sign-in\?next=/);
});
