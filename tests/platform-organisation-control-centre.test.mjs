import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("organisation register and detail pages use the canonical platform control centre", () => {
  const register = read("app/admin/organisations/page.tsx");
  const detail = read("app/admin/organisations/[organisationId]/page.tsx");
  const controlCentre = read("components/admin/PlatformOrganisationControlCentre.tsx");

  assert.match(register, /PlatformOrganisationControlCentre/);
  assert.match(detail, /PlatformOrganisationControlCentre/);
  assert.doesNotMatch(register, /AdminControlPlaneWorkspace/);
  assert.doesNotMatch(detail, /AdminControlPlaneWorkspace/);
  assert.match(controlCentre, /\/admin\/organisations\/\$\{created\.id\}/);
  assert.doesNotMatch(controlCentre, /\/application\/enterprise/);
});

test("control centre exposes only canonical audited commercial actions", () => {
  const controlCentre = read("components/admin/PlatformOrganisationControlCentre.tsx");
  const api = read("app/api/internal/admin/enterprise/route.ts");

  for (const action of [
    "create_organisation",
    "update_organisation",
    "create_licence",
    "invite_organisation_admin",
    "transition_organisation",
  ]) {
    assert.match(controlCentre, new RegExp(`runAction\\(\"${action}\"`));
    assert.match(api, new RegExp(action));
  }

  assert.match(controlCentre, /requirement|API enforces/);
  assert.match(controlCentre, /The change is in the audit log/);
  assert.match(controlCentre, /Members’ Vaults stay private: no record names, values, notes or documents/);
  assert.doesNotMatch(controlCentre, /service_role|SUPABASE_SERVICE_ROLE_KEY|\.from\(/);
});

test("register supports safe operational search, filters, sorting and responsive-safe action surfaces", () => {
  const controlCentre = read("components/admin/PlatformOrganisationControlCentre.tsx");

  for (const field of [
    "Search",
    "Status",
    "Type",
    "Licence",
    "Organisation name",
    "Renewal date",
    "Available capacity",
    "No organisations match",
    "New organisation",
  ]) {
    assert.match(controlCentre, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(controlCentre, /overflowX: "auto"/);
  assert.match(controlCentre, /gridTemplateColumns: "repeat\(auto-fit/);
  assert.match(controlCentre, /caption>Platform organisation register/);
});

test("dialogs have labelled keyboard and pointer dismissal behavior", () => {
  const controlCentre = read("components/admin/PlatformOrganisationControlCentre.tsx");

  assert.match(controlCentre, /event\.key === "Escape"/);
  assert.match(controlCentre, /event\.target === event\.currentTarget/);
  assert.match(controlCentre, /role="dialog"/);
  assert.match(controlCentre, /aria-modal="true"/);
  assert.match(controlCentre, /aria-labelledby="platform-dialog-title"/);
  assert.match(controlCentre, /tabIndex=\{-1\}/);
  assert.match(controlCentre, /dialogRef\.current\?\.focus\(\)/);
  assert.match(controlCentre, /commercial action could not be reached/);
  assert.match(controlCentre, /nextYearDate\(\)/);
  assert.match(controlCentre, /<h2 id="platform-dialog-title"/);
  assert.doesNotMatch(controlCentre, /<h2 id="platform-dialog-title"[^>]*>\{children\}/);
});

test("organisation detail links to registration links without changing principal or exposing vault content", () => {
  const controlCentre = read("components/admin/PlatformOrganisationControlCentre.tsx");

  assert.match(controlCentre, /canEnterpriseHandoff \? <Link href="\/enterprise\?tab=registration-links"/);
  assert.match(controlCentre, /Members’ Vaults stay private/);
  assert.doesNotMatch(controlCentre, /Enterprise Operations handoff|Platform commercial account/);
});

test("organisation detail follows the ADMIN_PARTNER template with a reasoned suspend", () => {
  const controlCentre = read("components/admin/PlatformOrganisationControlCentre.tsx");
  for (const label of ["Seats bought", "Reserved by invitations", "Available", "Administrators", "Manage administrators", "Members and invitations", "Recent activity", "Open audit log", "Set up licence", "Manage licence", "Invite administrator", "Edit details"]) {
    assert.match(controlCentre, new RegExp(label));
  }
  assert.match(controlCentre, /Reason \(Required\)/);
  assert.match(controlCentre, /disabled=\{saving \|\| !reason\.trim\(\)\}/);
  assert.match(controlCentre, /reason: reason\.trim\(\)/);
  assert.match(controlCentre, /Members keep their own Vaults but lose organisation access until it’s restored/);
  assert.match(controlCentre, /activeRegistrationLinks/);
  assert.match(controlCentre, /customerReference: org\.customerReference/);
  assert.match(controlCentre, /initialStatus: org\.status/);
  assert.match(controlCentre, /lf-platform-organisation-cards/);
});
