import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("prototype admin routes are quarantined outside local development by a server layout gate", () => {
  const layout = read("app/internal/admin/prototype/layout.tsx");
  const routeManifest = read("config/routeManifest.tsx");
  const workspace = read("components/enterprise/EnterpriseOperationsWorkspace.tsx");
  const adminShell = read("components/admin/AdminControlPlaneWorkspace.tsx");

  assert.match(layout, /notFound\(\)/);
  assert.match(layout, /NODE_ENV === "development"/);
  assert.match(layout, /LEGACY_FORTRESS_ALLOW_ADMIN_PROTOTYPES === "true"/);
  assert.match(layout, /!localDevelopment \|\| !explicitlyAllowed/);
  assert.match(layout, /robots:[\s\S]*index: false/);
  assert.doesNotMatch(layout, /searchParams|query|prototype=true|admin=true/);
  assert.doesNotMatch(routeManifest, /\/internal\/admin\/prototype/);
  assert.doesNotMatch(workspace, /\/internal\/admin\/prototype/);
  assert.doesNotMatch(adminShell, /\/internal\/admin\/prototype/);
});

test("canonical admin users page owns invitation and lifecycle controls without legacy route handoff", () => {
  const route = read("app/api/internal/admin/admin-users/route.ts");
  const workspace = read("components/admin/AdminControlPlaneWorkspace.tsx");

  assert.match(route, /createAdminInvitation/);
  assert.match(route, /updateAdminInvitationStatus/);
  assert.match(route, /resend_invitation/);
  assert.match(route, /revoke_invitation/);
  assert.match(route, /recordAdminAuditEvent/);
  assert.match(route, /planAdminUserLifecycleUpdate/);
  assert.match(route, /applyAdminUserLifecycleUpdate/);
  assert.match(workspace, /runAdminInvitationLifecycle/);
  assert.match(workspace, /Admin invitation revoked and audit recorded/);
  assert.match(workspace, /Admin invitation resent and audit recorded/);
  assert.match(workspace, /Admin lifecycle action completed and audit recorded/);
  assert.match(workspace, /Suspend access/);
  assert.match(workspace, /Reactivate access/);
  assert.match(workspace, /Edit role/);
  assert.match(workspace, /window\.confirm\("Revoke this pending administrator invitation/);
  assert.doesNotMatch(workspace, /Open legacy lifecycle controls/);
  assert.doesNotMatch(workspace, /href="\/internal\/admin"/);
});

test("admin segment disables static caching and clears protected state during sign-out", () => {
  const layout = read("app/admin/layout.tsx");
  const workspace = read("components/admin/AdminControlPlaneWorkspace.tsx");

  assert.match(layout, /dynamic = "force-dynamic"/);
  assert.match(layout, /revalidate = 0/);
  assert.match(layout, /fetchCache = "force-no-store"/);
  assert.match(workspace, /setState\("checking"\)/);
  assert.match(workspace, /setAdmin\(null\)/);
  assert.match(workspace, /setAdmins\(\[\]\)/);
  assert.match(workspace, /setAdminInvitations\(\[\]\)/);
  assert.match(workspace, /setMetrics\(\[\]\)/);
  assert.match(workspace, /setAuditEvents\(\[\]\)/);
  assert.match(workspace, /await supabase\.auth\.signOut\(\)/);
  assert.match(workspace, /router\.replace\("\/sign-in"\)/);
  assert.match(workspace, /router\.refresh\(\)/);
});

test("enterprise organisation and licence create forms are contextual rather than permanently rendered", () => {
  const workspace = read("components/enterprise/EnterpriseOperationsWorkspace.tsx");

  assert.match(workspace, /organisationFormOpen/);
  assert.match(workspace, /licenceFormOpen/);
  assert.match(workspace, /aria-label="Add organisation form"/);
  assert.match(workspace, /aria-label="Create licence form"/);
  assert.match(workspace, /setFormOpen\(true\)/);
  assert.match(workspace, /organisationFormOpen/);
  assert.match(workspace, /licenceFormOpen/);
  assert.match(workspace, /setOrganisationFormOpen\(false\)/);
  assert.match(workspace, /setLicenceFormOpen\(false\)/);
  assert.match(workspace, /contextPanelStyle/);
  assert.doesNotMatch(workspace, /scrollIntoView/);
  assert.doesNotMatch(workspace, /Manage users - Phase 3/);
});

test("organisation detail moves administrator invitation into a contextual panel and keeps sign-out visible", () => {
  const detail = read("components/enterprise/EnterpriseOrganisationDetailWorkspace.tsx");

  assert.match(detail, /inviteFormOpen/);
  assert.match(detail, /Invite administrator/);
  assert.match(detail, /aria-label="Invite administrator or user form"/);
  assert.match(detail, /Current invitations are shown before contextual administrator and user invite controls/);
  assert.match(detail, /setInviteFormOpen\(true\)/);
  assert.match(detail, /setInviteFormOpen\(false\)/);
  assert.match(detail, /supabase\.auth\.signOut\(\)/);
  assert.match(detail, /router\.replace\("\/sign-in"\)/);
  assert.match(detail, /AdminWorkspaceShell/);
  assert.match(detail, /onSignOut=\{signOut\}/);
  assert.match(detail, /stagingLabel="STAGING - synthetic test data may be present"/);
});

test("licence detail exposes canonical edit fields, seat protection messaging and sign-out", () => {
  const detail = read("components/enterprise/EnterpriseLicenceDetailWorkspace.tsx");

  assert.match(detail, /Edit licence/);
  assert.match(detail, /aria-label="Edit licence form"/);
  assert.match(detail, /update_licence/);
  assert.match(detail, /Minimum safe seat count is/);
  assert.match(detail, /The server rejects reductions below committed seats/);
  for (const field of [
    "Licence plan",
    "Custom plan name",
    "Contract reference",
    "Billing reference",
    "Purchased seats",
    "Start date",
    "Renewal date",
    "End date",
    "Renewal notice days",
    "Licence status",
    "Billing status",
    "Account owner",
  ]) {
    assert.match(detail, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(detail, /supabase\.auth\.signOut\(\)/);
  assert.match(detail, /router\.replace\("\/sign-in"\)/);
  assert.match(detail, /AdminWorkspaceShell/);
  assert.match(detail, /onSignOut=\{signOut\}/);
  assert.match(detail, /stagingLabel="STAGING - synthetic test data may be present"/);
});

test("admin dashboard completion uses shared responsive primitives for operational queues", () => {
  const workspace = read("components/admin/AdminControlPlaneWorkspace.tsx");
  const audit = read("docs/admin/ADMIN_PRODUCT_AUDIT.md");

  for (const caption of [
    "Operational metrics",
    "${title} table",
    "Verification queue",
    "Probate review queue",
    "Admin audit history",
    "Subsystem checks",
  ]) {
    const escaped = caption.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(workspace, new RegExp(`caption=(?:"${escaped}|\\{\\\`${escaped})`));
  }
  assert.doesNotMatch(workspace, /Review action available in legacy case controls/);
  assert.match(audit, /Action matrix totals for this phase: working 3, repaired 7, disabled\/deferred 0, blocked 1/);
  assert.match(audit, /ADMIN-DASH-001/);
});

test("probate case detail exposes canonical decision controls without bypassing server rules", () => {
  const workspace = read("components/admin/AdminControlPlaneWorkspace.tsx");
  const route = read("app/api/internal/admin/probate-cases/[caseId]/actions/route.ts");

  assert.match(workspace, /runProbateCaseAction/);
  assert.match(workspace, /\/api\/internal\/admin\/probate-cases\/\$\{encodeURIComponent\(caseId\)\}\/actions/);
  assert.match(workspace, /Decision notes are required before changing a probate case/);
  assert.match(workspace, /Confirm \$\{action\.replace\(/);
  assert.match(workspace, /setProbateCases\(\(current\) => current\.map/);
  assert.match(workspace, /verification:decide/);
  assert.match(workspace, /Mark under review/);
  assert.match(workspace, /Request information/);
  assert.match(workspace, /Approve/);
  assert.match(workspace, /Reject/);
  assert.match(route, /requireAdminCapability\(admin\.access, capability\)/);
  assert.match(route, /Decision notes are required before changing a probate case/);
  assert.match(route, /recordAdminAuditEvent/);
});
