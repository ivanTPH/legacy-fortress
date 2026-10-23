import test from "node:test";
import assert from "node:assert/strict";

const { getPwaStartUrl } = await import("../lib/pwa/startUrl.ts");
const { getDefaultLandingForRoles } = await import("../lib/auth/platformRoles.ts");
const { resolveBootstrapDestination } = await import("../lib/auth/bootstrapRules.ts");
const { shouldOfferFounderSignInChoice } = await import("../lib/testLauncher/client.ts");

const testUrl = "https://supabase-test.mylegacyfortress.com";
const completed = { canBypassOnboarding: false, onboardingCompleted: true, termsAccepted: true };

test("only the TEST PWA opens a neutral destination chooser", () => {
  assert.equal(getPwaStartUrl({ publicSupabaseUrl: testUrl, environments: ["staging", "staging"] }), "/pwa-entry");
  assert.equal(getPwaStartUrl({ publicSupabaseUrl: testUrl, environments: [] }), "/pwa-entry");
  assert.equal(getPwaStartUrl({ publicSupabaseUrl: testUrl, environments: ["production"] }), "/");
  assert.equal(getPwaStartUrl({ publicSupabaseUrl: testUrl, environments: ["staging", "production"] }), "/");
  assert.equal(getPwaStartUrl({ publicSupabaseUrl: "https://supabase.mylegacyfortress.com", environments: ["staging"] }), "/");
  assert.equal(getPwaStartUrl({ publicSupabaseUrl: "not-a-url", environments: ["staging"] }), "/");
});

test("a fresh destination-free super-admin session reproduces the Admin landing", () => {
  const roles = ["super_admin"];
  const completedDestination = getDefaultLandingForRoles(roles);
  assert.equal(completedDestination, "/admin");
  assert.equal(shouldOfferFounderSignInChoice({ nextPath: null, pendingDestination: null, onboardingComplete: true, verifiedFounder: false }), false);
  assert.equal(resolveBootstrapDestination({ ...completed, roles, completedDestination }).destination, "/admin");
  assert.equal(shouldOfferFounderSignInChoice({ nextPath: null, pendingDestination: null, onboardingComplete: true, verifiedFounder: true }), true);
});

test("chosen PWA destinations remain explicit and permission checked", () => {
  const founderRoles = ["super_admin"];
  for (const nextPath of ["/dashboard", "/admin", "/enterprise"]) {
    assert.equal(resolveBootstrapDestination({ ...completed, nextPath, roles: founderRoles, completedDestination: "/admin" }).destination, nextPath);
    assert.equal(shouldOfferFounderSignInChoice({ nextPath, pendingDestination: null, onboardingComplete: true, verifiedFounder: true }), false);
  }
  assert.equal(resolveBootstrapDestination({ ...completed, nextPath: "/admin", roles: ["consumer_user"], completedDestination: "/dashboard" }).destination, "/dashboard");
  assert.equal(resolveBootstrapDestination({ ...completed, nextPath: "/enterprise", roles: ["consumer_user"], completedDestination: "/dashboard" }).destination, "/dashboard");
  assert.equal(resolveBootstrapDestination({ ...completed, nextPath: "/dashboard", roles: ["consumer_user"], completedDestination: "/dashboard" }).destination, "/dashboard");
  assert.equal(getDefaultLandingForRoles(["consumer_user"]), "/dashboard");
  assert.equal(getDefaultLandingForRoles(["enterprise_admin"]), "/enterprise");
});
