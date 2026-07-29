import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  DOMAIN_ENTITY_CONTRACTS,
  getDomainEntityContract,
} from "../lib/backend/domainEntities.ts";
import {
  getApiContract,
  listApiContractsForCapability,
  PLATFORM_API_CONTRACTS,
} from "../lib/backend/apiContracts.ts";
import {
  getPersistenceAdapter,
  PERSISTENCE_ADAPTERS,
} from "../lib/backend/persistence.ts";
import {
  auditPipelineReadiness,
  buildRestrictedActionAuditPreview,
  createAuditPipeline,
} from "../lib/backend/auditPipeline.ts";
import {
  getEnvironmentReadiness,
  shouldExposeTestPersonaRoutes,
} from "../lib/backend/environment.ts";
import {
  parsePlatformRoles,
  resolveRequestSessionContext,
  sessionLifecycleReadiness,
} from "../lib/backend/sessionLifecycle.ts";
import {
  decideRouteAccess,
  roleMiddlewareReadiness,
} from "../lib/backend/rbacMiddleware.ts";
import { CANONICAL_STORAGE_BOUNDARY } from "../lib/storage/canonicalStorage.ts";
import { QUEUE_READINESS_CONTRACT, createDisabledBackgroundJobAdapter } from "../lib/queue/backgroundJobs.ts";
import { getStripeProviderReadiness, STRIPE_INTEGRATION_READINESS } from "../lib/billing/providerReadiness.ts";
import { getPlatformFoundationReport } from "../lib/backend/platformFoundation.ts";

const root = process.cwd();

function requestFor(pathname, headers = {}, cookies = {}) {
  const url = new URL(pathname, "http://localhost");
  return {
    nextUrl: { pathname: url.pathname, searchParams: url.searchParams },
    headers: {
      get(key) {
        return headers[key.toLowerCase()] ?? headers[key] ?? null;
      },
    },
    cookies: {
      get(key) {
        return cookies[key] ? { value: cookies[key] } : undefined;
      },
    },
  };
}

test("domain entity contracts define canonical stores without duplicating people or document schemas", () => {
  assert.ok(DOMAIN_ENTITY_CONTRACTS.some((entity) => entity.name === "people_contact"));
  assert.equal(getDomainEntityContract("people_contact")?.canonicalStore, "contacts/contact_links/contact_invitations");
  assert.match(getDomainEntityContract("document")?.notes ?? "", /AttachmentGallery/);
  assert.equal(getDomainEntityContract("audit_event")?.governanceRequired, true);
  assert.equal(getDomainEntityContract("licence")?.visibility, "admin_operational");
});

test("typed API contracts keep consent, export, billing, and audit boundaries explicit", () => {
  assert.ok(PLATFORM_API_CONTRACTS.length >= 5);
  assert.equal(getApiContract("enterprise.reports")?.governance.consentRequired, true);
  assert.equal(getApiContract("enterprise.reports")?.governance.bandedOnly, true);
  assert.equal(getApiContract("billing.portal")?.futureAdapter, "stripe_server");
  assert.equal(getApiContract("audit.record")?.authMode, "system_internal");
  assert.ok(listApiContractsForCapability("enterprise_reports").some((contract) => contract.id === "enterprise.reports"));
});

test("persistence abstraction keeps canonical adapters ahead of legacy compatibility tables", () => {
  assert.equal(getPersistenceAdapter("people_contact")?.mode, "supabase_client");
  assert.match(getPersistenceAdapter("people_contact")?.notes ?? "", /compatibility projections/);
  assert.equal(getPersistenceAdapter("audit_event")?.mode, "disabled");
  assert.ok(PERSISTENCE_ADAPTERS.some((adapter) => adapter.entity === "document" && /AttachmentGallery/.test(adapter.notes)));
});

test("audit pipeline is queue-ready but preview-only until a persistence adapter exists", async () => {
  assert.equal(auditPipelineReadiness.currentMode, "preview_only");
  assert.equal(auditPipelineReadiness.queueReady, true);

  const context = {
    requestId: "req-1",
    principal: null,
    route: "/internal/admin/prototype/reports",
    environment: "test",
  };
  const preview = await createAuditPipeline().record({
    category: "report_export_attempt",
    action: "Export blocked",
    result: "disabled",
    resource: { type: "report", id: null, label: "Reports" },
    context,
  });
  assert.equal(preview.stored, false);
  assert.equal(preview.event.governance?.prototypeOnly, true);

  const restricted = await buildRestrictedActionAuditPreview(context, "Campaign send blocked");
  assert.equal(restricted.event.category, "restricted_action_blocked");
  assert.equal(restricted.event.governance?.exportEnabled, false);
});

test("environment separation disables live providers outside production-like readiness", () => {
  const readiness = getEnvironmentReadiness("development");
  assert.equal(readiness.environment, "development");
  assert.ok(readiness.enabled.includes("mock_personas"));
  assert.ok(readiness.disabled.includes("live_billing"));
  assert.equal(shouldExposeTestPersonaRoutes("development"), true);
});

test("session lifecycle parses roles and requires trusted claims for production admin access", () => {
  assert.deepEqual(parsePlatformRoles("enterprise_admin,not-a-role,super-admin"), ["enterprise_admin", "super_admin"]);
  assert.match(sessionLifecycleReadiness.trustedClaimRequirement, /trusted provider role claims/);

  const untrusted = resolveRequestSessionContext(requestFor(
    "/internal/admin/prototype/enterprise",
    { "x-lf-platform-roles": "enterprise_admin" },
  ));
  assert.equal(untrusted.state, "authenticated_untrusted_roles");
  assert.equal(untrusted.principal?.trustedRoleClaims, false);

  const trusted = resolveRequestSessionContext(requestFor(
    "/internal/admin/prototype/enterprise",
    { "x-lf-platform-roles": "enterprise_admin", "x-lf-trusted-role-claims": "true" },
  ));
  assert.equal(trusted.state, "authenticated_trusted_roles");

  const prototypeQuery = resolveRequestSessionContext(requestFor(
    "/internal/admin/prototype/enterprise?role=super_admin&admin=true&prototype=true",
  ));
  assert.deepEqual(prototypeQuery.principal?.roles, ["super_admin"]);
  assert.equal(prototypeQuery.source, "prototype_query");
  assert.equal(fs.existsSync(path.join(root, "public/apple-touch-icon.png")), true);
  assert.equal(fs.existsSync(path.join(root, "public/apple-touch-icon-precomposed.png")), true);
});

test("role middleware blocks consumer-only internal access without leaking page content", () => {
  assert.match(roleMiddlewareReadiness.restrictedStateRule, /Denied internal routes/);
  assert.deepEqual(decideRouteAccess(requestFor("/dashboard")), { allowed: true, reason: "public_route" });
  assert.equal(decideRouteAccess(requestFor("/internal/admin/prototype/enterprise")).allowed, false);
  assert.deepEqual(decideRouteAccess(requestFor(
    "/internal/admin/prototype/enterprise?role=super_admin&admin=true&prototype=true",
  )), { allowed: false, status: 403, reason: "admin_role_required" });
  assert.equal(decideRouteAccess(requestFor(
    "/internal/admin/prototype/enterprise",
    { "x-lf-platform-roles": "enterprise_admin", "x-lf-trusted-role-claims": "true" },
  )).allowed, false);

  const previousEnvironment = process.env.LEGACY_FORTRESS_ENV;
  process.env.LEGACY_FORTRESS_ENV = "production";
  try {
    const productionDecision = decideRouteAccess(requestFor(
      "/internal/admin/prototype/enterprise?role=super_admin&admin=true&prototype=true",
    ));
    assert.equal(productionDecision.allowed, false);
    assert.equal(productionDecision.reason, "admin_role_required");
  } finally {
    if (previousEnvironment === undefined) {
      delete process.env.LEGACY_FORTRESS_ENV;
    } else {
      process.env.LEGACY_FORTRESS_ENV = previousEnvironment;
    }
  }
});

test("canonical storage, queue, and Stripe readiness stay disabled/provider-safe", async () => {
  assert.equal(CANONICAL_STORAGE_BOUNDARY.presentationSurface, "AttachmentGallery");
  assert.match(CANONICAL_STORAGE_BOUNDARY.rule, /must not create page-level attachment systems/);
  assert.ok(QUEUE_READINESS_CONTRACT.allowedPrototypeJobs.includes("campaign_send_blocked"));
  assert.match(STRIPE_INTEGRATION_READINESS.boundary, /server-side billing service/);
  assert.equal(getStripeProviderReadiness({}).mode, "not_configured");

  const job = await createDisabledBackgroundJobAdapter({
    requestId: "job-1",
    principal: null,
    route: "/internal/admin/prototype/campaigns",
    environment: "test",
  }).enqueue({
    type: "campaign_send_blocked",
    payload: { audience: "consented-only-preview" },
  });
  assert.equal(job.status, "blocked");
});

test("platform foundation report provides architecture diagram summary and migration blockers", () => {
  const report = getPlatformFoundationReport();
  assert.match(report.architecture.flow, /UI -> API contract -> service\/repository/);
  assert.ok(report.entities.some((entity) => entity.name === "people_contact"));
  assert.ok(report.apiContracts.some((contract) => contract.id === "contacts.list"));
  assert.ok(report.migrationBlockers.some((blocker) => /trusted provider claims/.test(blocker)));
});

test("proxy middleware and foundations preserve canonical AttachmentGallery and avoid page-level persistence regressions", () => {
  const middleware = fs.readFileSync(path.join(root, "proxy.ts"), "utf8");
  const storage = fs.readFileSync(path.join(root, "lib/storage/canonicalStorage.ts"), "utf8");
  const foundation = fs.readFileSync(path.join(root, "lib/backend/platformFoundation.ts"), "utf8");

  assert.equal(fs.existsSync(path.join(root, "middleware.ts")), false);
  assert.match(middleware, /export function proxy/);
  assert.match(middleware, /applyRoleBasedAccessMiddleware/);
  assert.match(middleware, /startsWith\("\/internal\/test-login"\)/);
  assert.match(middleware, /startsWith\("\/internal\/admin"\)/);
  assert.match(middleware, /startsWith\("\/application\/admin"\)/);
  assert.match(middleware, /startsWith\("\/application\/enterprise"\)/);
  assert.match(middleware, /ENABLE_INTERNAL_ADMIN_EDGE_GUARD/);
  assert.match(middleware, /x-lf-trusted-role-claims/);
  assert.doesNotMatch(middleware, /searchParams\.get\("prototype"\)/);
  assert.match(storage, /AttachmentGallery/);
  assert.match(foundation, /PLATFORM_FOUNDATION_ARCHITECTURE/);
  assert.doesNotMatch(foundation, /from\("section_entries"\)/);
});
