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
  assert.match(controlCentre, /audit recorded/);
  assert.match(controlCentre, /Personal Vault content.*excluded|Personal Vault content is not shown/);
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

test("platform handoff does not change principal or expose vault content", () => {
  const controlCentre = read("components/admin/PlatformOrganisationControlCentre.tsx");

  assert.match(controlCentre, /Open Enterprise Operations/);
  assert.match(controlCentre, /does not change identity or organisation membership/);
  assert.match(controlCentre, /Day-to-day enrolment links/);
  assert.match(controlCentre, /financial values are excluded/);
  assert.match(controlCentre, /canEnterpriseHandoff/);
});

test("organisation detail exposes commercial setup, administrator and registration workflow state", () => {
  const controlCentre = read("components/admin/PlatformOrganisationControlCentre.tsx");
  assert.match(controlCentre, /Commercial setup/);
  assert.match(controlCentre, /Manage administrators/);
  assert.match(controlCentre, /Registration and enrolment/);
  assert.match(controlCentre, /registration-links/);
  assert.match(controlCentre, /activeRegistrationLinks/);
  assert.match(controlCentre, /customerReference: org\.customerReference/);
  assert.match(controlCentre, /initialStatus: org\.status/);
  assert.match(controlCentre, /lf-platform-organisation-cards/);
  assert.match(controlCentre, /Platform totals/);
});
