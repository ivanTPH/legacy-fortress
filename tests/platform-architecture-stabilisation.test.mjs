import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildCanonicalContactArchitectureSnapshot,
  CANONICAL_CONTACT_ENTITY_FIELDS,
  CANONICAL_CONTACT_INVITE_STATUSES,
  CANONICAL_CONTACT_SOURCE_TYPES,
  CANONICAL_CONTACT_VERIFICATION_STATUSES,
  CONTACT_PERSISTENCE_SURFACES,
  buildCanonicalSharedContactEntity,
  inferCanonicalContactPermissionScope,
  isCanonicalContactEntityField,
} from "../lib/contacts/canonicalContacts.ts";
import {
  CANONICAL_WORKSPACE_PREFERENCE_RULES,
  describeLegacyPersistenceCoexistence,
  getPersistenceReadinessReport,
  isAllowedLegacySectionEntriesSurface,
  PERSISTENCE_READINESS_SURFACES,
  shouldPreferCanonicalPersistence,
} from "../lib/persistenceReadiness.ts";
import {
  getProductionReadinessByArea,
  getProductionReadinessChecklist,
  PRODUCTION_READINESS_ITEMS,
} from "../lib/productionReadiness.ts";
import {
  buildAuditPreviewEvents,
  buildConsentGovernanceSummary,
  canIncludeInOutreachAudience,
  canShowDetailedInsights,
} from "../components/admin/prototype/complianceGovernance.ts";
import { organisationClients } from "../components/admin/prototype/mockData.ts";
import {
  ACCESS_MODEL_ROUTES,
  ACCESS_MODEL_SUMMARY,
  canRoleAccessPath,
  canShowApplicationToAdminSwitch,
  getAccessAreaForPath,
  shouldHideFromConsumerNavigation,
} from "../lib/accessModel.ts";
import {
  canAccessAnyAdminArea,
  canAccessEnterpriseLicensing,
  canAccessEnterpriseOperations,
  canAccessProbateOperations,
  canShowAdminViewSwitcher,
  getDefaultLandingForRoles,
  getPlatformRoleCapabilities,
  normalizePlatformRole,
} from "../lib/auth/platformRoles.ts";
import {
  AUDIT_EVENT_CATEGORIES,
  auditPersistenceReadiness,
  buildPrototypeAuditPreviewEvents,
  createPrototypeAuditEvent,
} from "../lib/audit/auditEvents.ts";

const root = process.cwd();

test("canonical contact architecture documents the shared people entity and migration-safe surfaces", () => {
  assert.deepEqual(
    [...CANONICAL_CONTACT_ENTITY_FIELDS],
    [
      "id",
      "full_name",
      "email",
      "phone",
      "contact_role",
      "relationship",
      "linked_context",
      "invite_status",
      "verification_status",
      "source_type",
      "created_at",
      "updated_at",
      "permission_scope",
    ],
  );
  assert.equal(isCanonicalContactEntityField("invite_status"), true);
  assert.equal(isCanonicalContactEntityField("section_entries"), false);
  assert.deepEqual(CANONICAL_CONTACT_INVITE_STATUSES, ["not_invited", "invite_sent", "accepted", "rejected", "failed", "revoked"]);
  assert.ok(CANONICAL_CONTACT_VERIFICATION_STATUSES.includes("pending_verification"));
  assert.ok(CANONICAL_CONTACT_SOURCE_TYPES.includes("probate_contact"));
  assert.ok(CANONICAL_CONTACT_SOURCE_TYPES.includes("enterprise_contact"));

  const snapshot = buildCanonicalContactArchitectureSnapshot();
  assert.match(snapshot.migrationRule, /Reuse contacts, contact_links, contact_invitations, and permission_scope/);
  assert.ok(snapshot.relationshipPatterns.some((item) => item.key === "executor" && item.sourceTypes.includes("executor_asset")));
  assert.ok(snapshot.relationshipPatterns.some((item) => item.key === "next_of_kin" && item.linkedContext.includes("record")));
  assert.ok(snapshot.relationshipPatterns.some((item) => item.key === "probate_contact" && item.sourceTypes.includes("probate_contact")));
  assert.ok(snapshot.relationshipPatterns.some((item) => item.key === "enterprise_contact" && item.sourceTypes.includes("enterprise_contact")));
  assert.ok(CONTACT_PERSISTENCE_SURFACES.some((item) => item.surface === "/contacts" && item.currentPattern === "canonical"));
  assert.ok(CONTACT_PERSISTENCE_SURFACES.some((item) => item.currentPattern === "legacy" && item.migrationRisk === "high"));
  assert.equal(CONTACT_PERSISTENCE_SURFACES.filter((item) => item.currentPattern === "canonical" && item.canonicalTarget === "contacts").length, 1);
  assert.ok(CONTACT_PERSISTENCE_SURFACES.every((item) => item.canonicalTarget !== "section_entries"));
  assert.ok(snapshot.persistenceSurfaces.some((item) => item.surface === "executor and trusted-contact invitations" && item.canonicalTarget === "contact_invitations"));
  assert.ok(snapshot.persistenceSurfaces.some((item) => item.surface === "record-linked contacts" && item.canonicalTarget === "contact_links"));

  const entity = buildCanonicalSharedContactEntity({
    id: "contact-1",
    owner_user_id: "user-1",
    full_name: "Mina Executor",
    email: "mina@example.com",
    email_normalized: "mina@example.com",
    phone: null,
    contact_role: "executor",
    relationship: "Sister",
    linked_context: [{ source_kind: "asset", source_id: "asset-1", role: "executor" }],
    invite_status: "invite_sent",
    verification_status: "invited",
    source_type: "executor_asset",
    validation_overrides: {},
    created_at: "2026-01-01",
    updated_at: "2026-01-02",
  });
  assert.equal(entity.id, "contact-1");
  assert.deepEqual(entity.permission_scope, ["executor_access"]);
  assert.deepEqual(inferCanonicalContactPermissionScope({
    contact_role: "enterprise_contact",
    source_type: "enterprise_contact",
    linked_context: [],
  }), ["enterprise_reporting"]);
});

test("legacy persistence readiness keeps canonical assets, documents, and contacts ahead of section_entries", () => {
  const report = getPersistenceReadinessReport();
  assert.ok(report.canonical.some((surface) => surface.preferredTable === "assets"));
  assert.ok(report.canonical.some((surface) => surface.preferredTable === "documents"));
  assert.ok(report.compatibility.some((surface) => surface.preferredTable === "contacts" && surface.compatibilityTable === "section_entries"));
  assert.ok(report.legacy.every((surface) => surface.compatibilityTable === "section_entries"));
  assert.match(report.rule, /Prefer canonical assets, documents, contacts, and contact_links/);
  assert.equal(shouldPreferCanonicalPersistence("record attachments and dashboard documents"), true);
  assert.equal(shouldPreferCanonicalPersistence("legacy section_entries support surface"), false);
  assert.equal(isAllowedLegacySectionEntriesSurface("support requests"), true);
  assert.equal(isAllowedLegacySectionEntriesSurface("new enterprise reporting flow"), false);
  assert.ok(CANONICAL_WORKSPACE_PREFERENCE_RULES.some((rule) => /Action Centre/.test(rule)));
  assert.match(describeLegacyPersistenceCoexistence().migrationPath.join(" "), /Backfill canonical assets\/documents\/contacts/);
  assert.ok(PERSISTENCE_READINESS_SURFACES.every((surface) => surface.note.length > 20));
});

test("implementation keeps shared documents and contacts canonical while known compatibility writes remain explicit", () => {
  const dashboard = fs.readFileSync(path.join(root, "app/(app)/dashboard/page.tsx"), "utf8");
  const contactsWorkspace = fs.readFileSync(path.join(root, "components/contacts/ContactsNetworkWorkspace.tsx"), "utf8");
  const documentsWorkspace = fs.readFileSync(path.join(root, "components/documents/DocumentsWorkspace.tsx"), "utf8");
  const sectionWorkspace = fs.readFileSync(path.join(root, "components/sections/SectionWorkspace.tsx"), "utf8");
  const supportWorkspace = fs.readFileSync(path.join(root, "components/support/SupportWorkspace.tsx"), "utf8");
  const routeManifest = fs.readFileSync(path.join(root, "config/routeManifest.tsx"), "utf8");

  assert.match(contactsWorkspace, /ContactInvitationManager/);
  assert.match(contactsWorkspace, /normalizeContactGroupKey/);
  assert.match(documentsWorkspace, /AttachmentGallery/);
  assert.match(documentsWorkspace, /loadCanonicalDocumentWorkspaceData/);
  assert.match(documentsWorkspace, /createCanonicalAssetDocument/);
  assert.match(dashboard, /<ActionQueuePanel items=\{dashboardState\.actions\.items\}/);
  assert.doesNotMatch(dashboard, /title="Tasks"/);
  assert.doesNotMatch(routeManifest, /\/internal\/admin|\/internal\/test-login/);

  assert.match(sectionWorkspace, /from\("section_entries"\)/);
  assert.match(sectionWorkspace, /schema\.drift\.detected/);
  assert.match(supportWorkspace, /from\("section_entries"\)/);
  assert.match(supportWorkspace, /Support/);
});

test("production readiness contracts keep backend auth billing and release boundaries explicit", () => {
  const nextConfig = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");
  const service = fs.readFileSync(path.join(root, "components/admin/prototype/prototypeDataService.ts"), "utf8");
  const prototypePage = fs.readFileSync(path.join(root, "app/internal/admin/prototype/page.tsx"), "utf8");
  const casesPage = fs.readFileSync(path.join(root, "app/internal/admin/prototype/cases/page.tsx"), "utf8");
  const usersPage = fs.readFileSync(path.join(root, "app/internal/admin/prototype/users/page.tsx"), "utf8");
  const campaignsPage = fs.readFileSync(path.join(root, "app/internal/admin/prototype/campaigns/page.tsx"), "utf8");
  const licencesPage = fs.readFileSync(path.join(root, "app/internal/admin/prototype/licences/page.tsx"), "utf8");
  const enterprisePage = fs.readFileSync(path.join(root, "app/internal/admin/prototype/enterprise/page.tsx"), "utf8");
  const verificationsPage = fs.readFileSync(path.join(root, "app/internal/admin/prototype/verifications/page.tsx"), "utf8");
  const complianceGovernance = fs.readFileSync(path.join(root, "components/admin/prototype/complianceGovernance.ts"), "utf8");

  const checklist = getProductionReadinessChecklist();
  assert.match(checklist.rule, /Keep prototype\/static boundaries explicit/);
  assert.equal(PRODUCTION_READINESS_ITEMS.length, 6);
  assert.equal(getProductionReadinessByArea("billing")[0]?.boundary, "consumer billing and enterprise licence management");
  assert.equal(getProductionReadinessByArea("security")[0]?.boundary, "browser security headers and CSP migration");
  assert.ok(PRODUCTION_READINESS_ITEMS.every((item) => item.mustNotDoYet.startsWith("Do not")));
  assert.match(nextConfig, /X-Content-Type-Options/);
  assert.match(nextConfig, /X-Frame-Options/);
  assert.match(nextConfig, /Referrer-Policy/);
  assert.match(nextConfig, /Permissions-Policy/);
  assert.match(nextConfig, /Content-Security-Policy/);
  assert.doesNotMatch(nextConfig, /Content-Security-Policy-Report-Only/);
  assert.match(nextConfig, /frame-ancestors 'none'/);
  assert.doesNotMatch(nextConfig, /fonts\.googleapis\.com/);
  assert.match(nextConfig, /source: "\/fonts\/:path\*"/);
  assert.match(nextConfig, /max-age=31536000, immutable/);

  assert.match(service, /export const prototypeDataServiceBoundary/);
  assert.match(service, /futureAdapter: "api_backed_repository"/);
  assert.match(service, /export function getAdminOverviewData/);
  assert.match(service, /export function getCaseListData/);
  assert.match(service, /export function getUserDirectoryData/);
  assert.match(service, /getRoleManagementData/);
  assert.match(service, /export function getEnterpriseCommandCentreData/);
  assert.match(service, /export function getVerificationQueueData/);
  assert.match(service, /export function getLicenceManagementData/);
  assert.match(service, /export function getCampaignPrototypeData/);
  assert.match(service, /buildConsentGovernanceSummary/);
  assert.match(service, /buildAuditPreviewEvents/);
  assert.match(complianceGovernance, /export function buildConsentGovernanceSummary/);
  assert.match(complianceGovernance, /export function canShowDetailedInsights/);
  assert.match(complianceGovernance, /export function canIncludeInOutreachAudience/);
  assert.match(enterprisePage, /getEnterpriseCommandCentreData/);
  assert.match(verificationsPage, /getVerificationQueueData/);
  assert.match(licencesPage, /getLicenceManagementData/);
  assert.match(prototypePage, /getAdminOverviewData/);
  assert.match(casesPage, /getCaseListData/);
  assert.match(usersPage, /getRoleManagementData/);
  assert.match(campaignsPage, /getCampaignPrototypeData/);
  assert.doesNotMatch(prototypePage, /from "@\/components\/admin\/prototype\/mockData"/);
  assert.doesNotMatch(casesPage, /from "@\/components\/admin\/prototype\/mockData"/);
  assert.doesNotMatch(usersPage, /from "@\/components\/admin\/prototype\/mockData"/);
  assert.doesNotMatch(campaignsPage, /from "@\/components\/admin\/prototype\/mockData"/);
  assert.doesNotMatch(campaignsPage, /from "@\/components\/admin\/prototype\/reportInsights"/);
  assert.doesNotMatch(enterprisePage, /from "@\/components\/admin\/prototype\/mockData"/);
  assert.doesNotMatch(verificationsPage, /from "@\/components\/admin\/prototype\/mockData"/);
});

test("audit readiness defines production event shape while prototype previews remain non-persistent", () => {
  assert.ok(AUDIT_EVENT_CATEGORIES.includes("login_session"));
  assert.ok(AUDIT_EVENT_CATEGORIES.includes("document_upload"));
  assert.ok(AUDIT_EVENT_CATEGORIES.includes("consent_grant"));
  assert.ok(AUDIT_EVENT_CATEGORIES.includes("admin_approval"));
  assert.ok(AUDIT_EVENT_CATEGORIES.includes("report_export_attempt"));
  assert.ok(AUDIT_EVENT_CATEGORIES.includes("campaign_outreach_blocked"));
  assert.equal(auditPersistenceReadiness.currentAdapter, "prototype_preview_only");
  assert.match(auditPersistenceReadiness.rule, /must not be treated as persisted compliance logs/);
  assert.ok(auditPersistenceReadiness.requiredBeforeProduction.includes("idempotency key for duplicate-safe writes"));
  assert.ok(auditPersistenceReadiness.requiredBeforeProduction.includes("ISO timestamp generated server-side"));

  const event = createPrototypeAuditEvent({
    id: "audit-1",
    category: "restricted_action_blocked",
    actor: { id: null, type: "system", displayName: "System preview" },
    action: "Restricted export blocked",
    result: "blocked",
    resource: { type: "report", id: null, label: "Client insights" },
    context: { surface: "client_insights", route: "/internal/admin/prototype/reports/client-insights" },
    governance: { consentChecked: true, exportEnabled: false },
  });
  assert.equal(event.governance?.prototypeOnly, true);
  assert.equal(event.governance?.exportEnabled, false);
  assert.equal(event.actor.type, "system");

  const previews = buildPrototypeAuditPreviewEvents("reports");
  assert.ok(previews.every((item) => item.governance?.prototypeOnly === true));
  assert.ok(previews.some((item) => item.category === "report_export_attempt" && item.result === "disabled"));
  assert.ok(previews.some((item) => item.category === "restricted_action_blocked" && item.governance?.consentChecked));
});

test("compliance governance keeps reporting exports disabled and consent gates explicit", () => {
  const reportsPage = fs.readFileSync(path.join(root, "app/internal/admin/prototype/reports/page.tsx"), "utf8");
  const clientInsightsPage = fs.readFileSync(path.join(root, "app/internal/admin/prototype/reports/client-insights/page.tsx"), "utf8");
  const service = fs.readFileSync(path.join(root, "components/admin/prototype/prototypeDataService.ts"), "utf8");

  const summary = buildConsentGovernanceSummary(organisationClients, "reports");
  assert.equal(summary.exportState, "disabled");
  assert.match(summary.exportReason, /Exports are disabled/);
  assert.match(summary.restrictedDataRule, /banded, non-document signals/);
  assert.ok(summary.safeguards.every((item) => !/account details|documents|notes/i.test(item) || /hidden|remain hidden/i.test(item)));
  assert.equal(summary.adviserInsightAllowed + summary.adviserInsightRestricted, organisationClients.length);
  assert.equal(summary.marketingAllowed + summary.marketingRestricted, organisationClients.length);

  const consentedClient = organisationClients.find((client) => client.consent.adviserInsights);
  const nonConsentedClient = organisationClients.find((client) => !client.consent.adviserInsights);
  assert.ok(consentedClient);
  assert.ok(nonConsentedClient);
  assert.equal(canShowDetailedInsights(consentedClient), true);
  assert.equal(canShowDetailedInsights(nonConsentedClient), false);
  assert.equal(canIncludeInOutreachAudience(nonConsentedClient), false);
  assert.ok(buildAuditPreviewEvents("client_insights").some((event) => event.action.includes("Consent gate checked")));
  assert.ok(buildAuditPreviewEvents("client_insights").every((event) => event.governance?.prototypeOnly === true));

  assert.match(service, /buildConsentGovernanceSummary/);
  assert.match(service, /buildAuditPreviewEvents/);
  assert.match(service, /export function getReportPrototypeData/);
  assert.match(reportsPage, /getReportPrototypeData/);
  assert.match(reportsPage, /Compliance governance/);
  assert.match(clientInsightsPage, /getReportPrototypeData/);
  assert.match(clientInsightsPage, /Consent, export, and audit controls/);
  assert.match(clientInsightsPage, /PlatformNotice/);
  assert.doesNotMatch(clientInsightsPage, /const noticeStyle/);
});

test("access model keeps consumer navigation separate while allowing authorised admin switching", () => {
  const shell = fs.readFileSync(path.join(root, "components/admin/prototype/AdminPrototypeShell.tsx"), "utf8");
  const authEntry = fs.readFileSync(path.join(root, "components/auth/PublicAuthEntry.tsx"), "utf8");
  const routeManifest = fs.readFileSync(path.join(root, "config/routeManifest.tsx"), "utf8");

  assert.equal(ACCESS_MODEL_SUMMARY.preferredModel, "one_authentication_system_with_role_permissions");
  assert.match(ACCESS_MODEL_SUMMARY.consumerToAdminSwitchRule, /trusted production role claims/);
  assert.equal(ACCESS_MODEL_SUMMARY.consumerDefaultLanding, "/dashboard");
  assert.equal(ACCESS_MODEL_SUMMARY.adminDefaultLanding, "/admin");
  assert.equal(getAccessAreaForPath("/dashboard"), "consumer");
  assert.equal(getAccessAreaForPath("/user"), "consumer");
  assert.equal(getAccessAreaForPath("/internal/admin"), "probate_admin");
  assert.equal(getAccessAreaForPath("/application/admin"), "probate_admin");
  assert.equal(getAccessAreaForPath("/internal/admin/prototype/enterprise"), "test_preview");
  assert.equal(getAccessAreaForPath("/application/enterprise"), "enterprise_admin");
  assert.equal(canRoleAccessPath(["consumer_user"], "/internal/admin"), false);
  assert.equal(canRoleAccessPath(["consumer_user"], "/application/admin"), false);
  assert.equal(canRoleAccessPath(["consumer_user"], "/application/enterprise"), false);
  assert.equal(canRoleAccessPath(["probate_admin"], "/internal/admin"), true);
  assert.equal(canRoleAccessPath(["probate_admin"], "/application/admin"), true);
  assert.equal(canRoleAccessPath(["enterprise_admin"], "/internal/admin/prototype/enterprise"), false);
  assert.equal(canRoleAccessPath(["enterprise_admin"], "/application/enterprise"), true);
  assert.equal(canShowApplicationToAdminSwitch({ roles: ["enterprise_admin"], trustedRoleClaims: false }), false);
  assert.equal(canShowApplicationToAdminSwitch({ roles: ["enterprise_admin"], trustedRoleClaims: true }), true);
  assert.equal(shouldHideFromConsumerNavigation("/internal/admin/prototype"), true);
  assert.equal(shouldHideFromConsumerNavigation("/application/admin"), true);
  assert.equal(shouldHideFromConsumerNavigation("/application/enterprise"), true);
  assert.equal(shouldHideFromConsumerNavigation("/dashboard"), false);
  assert.ok(ACCESS_MODEL_ROUTES.some((route) => route.visibility === "authorised_role_only" && route.routePrefix === "/internal/admin"));
  assert.doesNotMatch(routeManifest, /\/internal\/admin|\/internal\/test-login/);

  assert.match(shell, /WorkspaceSwitcher/);
  assert.match(shell, /lf-prototype-session-details/);
  assert.doesNotMatch(shell, /viewSwitchLinkStyle/);
  assert.match(authEntry, /Operational dashboards are opened only when account permissions allow them/);
  assert.match(authEntry, /Admin access is role controlled/);
  assert.match(authEntry, /resolvePermissionedAdminDestination/);
  assert.doesNotMatch(authEntry, /lf-login-target-switch/);
});

test("production role helpers centralise future auth capability checks without adding providers", () => {
  assert.deepEqual(getPlatformRoleCapabilities(["consumer_user"]), ["consumer_app"]);
  assert.equal(canAccessProbateOperations(["probate_admin"]), true);
  assert.equal(canAccessProbateOperations(["enterprise_admin"]), false);
  assert.equal(canAccessEnterpriseOperations(["enterprise_admin"]), true);
  assert.equal(canAccessEnterpriseLicensing(["enterprise_admin"]), false);
  assert.equal(canAccessEnterpriseLicensing(["licensing_admin"]), true);
  assert.equal(canAccessAnyAdminArea(["consumer_user"]), false);
  assert.equal(canAccessAnyAdminArea(["support_admin"]), true);
  assert.equal(canShowAdminViewSwitcher({ roles: ["super_admin"], trustedRoleClaims: true }), true);
  assert.equal(canShowAdminViewSwitcher({ roles: ["super_admin"], trustedRoleClaims: false }), false);
  assert.equal(getDefaultLandingForRoles(["consumer_user"]), "/dashboard");
  assert.equal(getDefaultLandingForRoles(["executor"]), "/contact-wallet");
  assert.equal(getDefaultLandingForRoles(["probate_admin"]), "/internal/admin/probate");
  assert.equal(getDefaultLandingForRoles(["enterprise_admin"]), "/enterprise");
  assert.equal(getDefaultLandingForRoles(["super_admin"]), "/admin");
  assert.equal(normalizePlatformRole("super-admin"), "super_admin");
  assert.equal(normalizePlatformRole("unknown"), null);
});
