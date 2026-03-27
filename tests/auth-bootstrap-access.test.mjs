import test from "node:test";
import assert from "node:assert/strict";

const { resolveBootstrapDestination } = await import("../lib/auth/bootstrapRules.ts");

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
