import test from "node:test";
import assert from "node:assert/strict";

const { resolveBootstrapDestination } = await import("../lib/auth/bootstrapRules.ts");
const {
  getMasterAdminRolesForEmail,
  mergePlatformRoles,
} = await import("../lib/auth/adminRoles.ts");
const {
  extractPlatformRolesFromMetadata,
  getDefaultLandingForRoles,
} = await import("../lib/auth/platformRoles.ts");
const { resolvePermissionedAdminDestination } = await import("../lib/auth/adminDestination.ts");

test("owners who have not completed onboarding are sent straight to onboarding", () => {
  const result = resolveBootstrapDestination({
    nextPath: "/dashboard",
    canBypassOnboarding: false,
    onboardingCompleted: false,
    termsAccepted: false,
  });

  assert.equal(result.onboardingComplete, false);
  assert.equal(result.destination, "/onboarding?required=1");
});

test("owners with onboarding done but no terms acceptance are sent straight to terms", () => {
  const result = resolveBootstrapDestination({
    nextPath: "/dashboard",
    canBypassOnboarding: false,
    onboardingCompleted: true,
    termsAccepted: false,
  });

  assert.equal(result.onboardingComplete, false);
  assert.equal(result.destination, "/account/terms?required=1");
});

test("linked or invited viewers bypass owner onboarding and terms gating", () => {
  const result = resolveBootstrapDestination({
    nextPath: "/finances/bank",
    canBypassOnboarding: true,
    onboardingCompleted: false,
    termsAccepted: false,
  });

  assert.equal(result.onboardingComplete, true);
  assert.equal(result.destination, "/finances/bank");
});

test("admin next paths are honoured only for matching trusted role claims", () => {
  const consumer = resolveBootstrapDestination({
    nextPath: "/internal/admin/prototype/enterprise",
    completedDestination: "/dashboard",
    canBypassOnboarding: false,
    onboardingCompleted: true,
    termsAccepted: true,
    roles: ["consumer_user"],
  });
  const enterprise = resolveBootstrapDestination({
    nextPath: "/internal/admin/prototype/enterprise",
    completedDestination: "/dashboard",
    canBypassOnboarding: false,
    onboardingCompleted: true,
    termsAccepted: true,
    roles: ["enterprise_admin"],
  });

  assert.equal(consumer.destination, "/dashboard");
  assert.equal(enterprise.destination, "/internal/admin/prototype/enterprise");
});

test("master owner email can keep internal admin destination during sign-in bootstrap", () => {
  const roles = mergePlatformRoles(
    extractPlatformRolesFromMetadata({ roles: ["consumer_user"] }),
    getMasterAdminRolesForEmail("ivanyardley@me.com"),
  );
  const result = resolveBootstrapDestination({
    nextPath: "/internal/admin/prototype/enterprise?role=enterprise_admin&admin=true&prototype=true",
    completedDestination: "/dashboard",
    canBypassOnboarding: false,
    onboardingCompleted: true,
    termsAccepted: true,
    roles,
  });

  assert.equal(
    result.destination,
    "/internal/admin/prototype/enterprise?role=enterprise_admin&admin=true&prototype=true",
  );
});

test("permissioned admin redirects do not depend on admin session API when roles already allow the route", async () => {
  const result = await resolvePermissionedAdminDestination(
    {
      auth: {
        getSession: async () => {
          throw new Error("admin session API should not be needed for owner role redirects");
        },
      },
    },
    {
      nextPath: "/internal/admin/prototype/users?role=super_admin&admin=true&prototype=true",
      fallbackDestination: "/dashboard",
      roles: ["super_admin"],
    },
  );

  assert.equal(result, "/internal/admin/prototype/users?role=super_admin&admin=true&prototype=true");
});

test("unified login role routing maps future auth roles to expected landing areas", () => {
  assert.deepEqual(extractPlatformRolesFromMetadata({ roles: ["consumer_user", "unknown"] }), ["consumer_user"]);
  assert.deepEqual(extractPlatformRolesFromMetadata({ role: "super-admin" }), ["super_admin"]);
  assert.equal(getDefaultLandingForRoles(["consumer_user"]), "/dashboard");
  assert.equal(getDefaultLandingForRoles(["executor"]), "/executors");
  assert.equal(getDefaultLandingForRoles(["probate_admin"]), "/internal/admin/probate");
  assert.equal(getDefaultLandingForRoles(["enterprise_admin"]), "/internal/admin/prototype/enterprise");
  assert.equal(getDefaultLandingForRoles(["super_admin"]), "/internal/admin/prototype/enterprise");
});
