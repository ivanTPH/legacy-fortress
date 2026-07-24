import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

test("Phase 3 migration adds secure invitation, membership, enrolment and consent tables", () => {
  const migration = read("supabase/migrations/20260724103000_enterprise_invitations_memberships_phase3.sql");

  for (const table of [
    "enterprise_memberships",
    "enterprise_enrolment_links",
    "enterprise_enrolment_claims",
    "enterprise_consent_acceptances",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
  }

  assert.match(migration, /token_hash text NOT NULL UNIQUE/);
  assert.match(migration, /enterprise_invitations_pending_email_idx/);
  assert.match(migration, /enterprise_memberships_active_user_org_idx/);
  assert.match(migration, /enterprise_seats_active_user_licence_idx/);
  assert.match(migration, /organisation_terms_accepted/);
  assert.doesNotMatch(migration, /raw_token|plain_token|magic_link_token/i);
  assert.doesNotMatch(migration, /USING\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(migration, /section_entries|documents|attachments|assets/);
});

test("Phase 3 service handles token digests, acceptance, seat lifecycle and privacy boundaries", () => {
  const service = read("lib/admin/enterpriseOperations.ts");

  for (const symbol of [
    "acceptEnterpriseInvitation",
    "claimEnterpriseEnrolmentLink",
    "createEnterpriseEnrolmentLink",
    "transitionEnterpriseMembership",
    "releaseEnterpriseSeat",
    "activateEnterpriseSeat",
    "hashInvitationToken",
    "stagingAcceptPath",
    "stagingClaimPath",
  ]) {
    assert.match(service, new RegExp(symbol));
  }

  assert.match(service, /organisationTermsAccepted/);
  assert.match(service, /invitation_identity_mismatch/);
  assert.match(service, /claim_domain_rejected/);
  assert.match(service, /enrolment_link_exhausted/);
  assert.match(service, /vaultContentExcluded: true/);
  assert.doesNotMatch(service, /\.from\("assets"\)|\.from\("documents"\)|\.from\("attachments"\)|\.from\("records"\)/);
});

test("enterprise API has separate Phase 3 permission gates and audit actions", () => {
  const route = read("app/api/internal/admin/enterprise/route.ts");
  const caps = read("lib/admin/capabilities.ts");
  const acceptRoute = read("app/api/enterprise/invitations/accept/route.ts");
  const access = read("lib/admin/access.ts");
  const sessionRoute = read("app/api/internal/admin/session/route.ts");

  for (const action of [
    "invite_organisation_admin",
    "invite_enterprise_user",
    "update_invitation",
    "transition_membership",
    "create_enrolment_link",
    "update_enrolment_link",
    "validate_bulk_invitations",
  ]) {
    assert.match(route, new RegExp(action));
  }

  for (const capability of [
    "enterprise.invitation.manage",
    "enterprise.membership.manage",
    "enterprise.enrolment_link.manage",
    "enterprise.membership.read",
  ]) {
    assert.match(caps, new RegExp(capability.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(acceptRoute, /getRequestUser/);
  assert.match(acceptRoute, /acceptEnterpriseInvitation/);
  assert.match(acceptRoute, /claimEnterpriseEnrolmentLink/);
  assert.doesNotMatch(acceptRoute, /console\.log|token_hash.*json/i);
  assert.match(access, /requireEnterpriseAccess/);
  assert.match(access, /resolveEnterpriseMembershipAccess/);
  assert.match(access, /ENTERPRISE_WORKSPACE_MEMBERSHIP_ROLES/);
  assert.doesNotMatch(access, /organisation_member["\s,\]]+:[\s\S]*enterprise\.membership\.manage/);
  assert.match(route, /requireEnterpriseAccess\(request\)/);
  assert.match(route, /assertEnterpriseActionScope/);
  assert.match(sessionRoute, /requireEnterpriseAccess\(request\)/);
});

test("Phase 3B capability resolver keeps organisation-scoped access separate from platform admin", () => {
  const access = read("lib/admin/access.ts");
  const sessionRoute = read("app/api/internal/admin/session/route.ts");
  const switcher = read("components/navigation/WorkspaceSwitcher.tsx");

  assert.match(access, /enterpriseScope/);
  assert.match(access, /organisationScoped: activeRows\.length > 0/);
  assert.match(access, /adminRole: "enterprise_admin"/);
  assert.match(access, /capabilities: enterprise\.capabilities/);
  assert.match(access, /adminHasCapability\(access: AdminAccessState, capability: AdminCapability\)[\s\S]*access\.capabilities\.includes\(capability\)/);
  assert.match(access, /id: `enterprise-membership:\$\{firstMembershipId\}`/);
  assert.match(access, /granted_by_user_id: null/);
  assert.match(sessionRoute, /enterpriseScope: admin\.access\.enterpriseScope/);
  assert.match(switcher, /payload\.admin\.role === "enterprise_admin"/);
});

test("Phase 3 UI exposes operational invitations, users, seats, enrolment links and consent acceptance", () => {
  const workspace = read("components/enterprise/EnterpriseOperationsWorkspace.tsx");
  const orgDetail = read("components/enterprise/EnterpriseOrganisationDetailWorkspace.tsx");
  const acceptClient = read("app/accept-invitation/EnterpriseInvitationAcceptPageClient.tsx");

  for (const text of [
    "Users and seats",
    "Invite organisation user",
    "Create enrolment link",
    "Bulk CSV validation",
    "Purchased seats",
    "Active seats",
    "Invited/reserved seats",
    "Removing organisation access releases the seat",
  ]) {
    assert.match(workspace, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const text of [
    "Invite administrator or user",
    "Enrolment link",
    "Invitation history",
    "No organisation users have accepted access yet.",
  ]) {
    assert.match(orgDetail, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(acceptClient, /organisationTermsAccepted/);
  assert.match(acceptClient, /marketingConsent/);
  assert.match(acceptClient, /Private vault|private vault/i);
});
