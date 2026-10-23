import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const { getFounderTestLauncherEnvironmentFailure, isFounderTestLauncherEnvironment, isVerifiedFounder } = await import("../lib/testLauncher/access.ts");
const { hasFounderTestLauncherAccess, shouldOfferFounderSignInChoice } = await import("../lib/testLauncher/client.ts");
const { resolveBootstrapDestination } = await import("../lib/auth/bootstrapRules.ts");
const { canRoleAccessPath } = await import("../lib/accessModel.ts");
const { buildProtectedSignInRedirect } = await import("../lib/auth/session.ts");

const founderId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const activeFounderRow = { user_id: founderId, status: "active", is_master: true, role: "super_admin" };
const testEnvironment = { environment: "staging", appHost: "test.mylegacyfortress.com", supabaseUrl: "https://supabase-test.mylegacyfortress.com" };

test("founder TEST environment is restricted to the exact app and Supabase hosts", () => {
  assert.equal(isFounderTestLauncherEnvironment(testEnvironment), true);
  for (const change of [
    { environment: "production" },
    { environment: "preview" },
    { appHost: "legacy-fortress.vercel.app" },
    { supabaseUrl: "https://supabase.mylegacyfortress.com" },
  ]) assert.equal(isFounderTestLauncherEnvironment({ ...testEnvironment, ...change }), false);
});

test("trusted public TEST identity is independent of the internal Supabase service URL", () => {
  const formerServerUrl = process.env.SUPABASE_URL;
  try {
    process.env.SUPABASE_URL = "http://supabase-kong:8000";
    assert.equal(isFounderTestLauncherEnvironment(testEnvironment), true);
    assert.equal(getFounderTestLauncherEnvironmentFailure({ ...testEnvironment, environment: "production" }), "deployment_environment");
    assert.equal(getFounderTestLauncherEnvironmentFailure({ ...testEnvironment, appHost: "legacy-fortress.vercel.app" }), "app_host");
    assert.equal(getFounderTestLauncherEnvironmentFailure({ ...testEnvironment, supabaseUrl: "http://supabase-kong:8000" }), "public_supabase_host");
  } finally {
    if (formerServerUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = formerServerUrl;
  }
});

test("only configured immutable Auth ID plus active protected Admin assignment authorises launcher", () => {
  assert.equal(isVerifiedFounder({ user: { id: founderId }, configuredUserId: founderId, adminRow: activeFounderRow }), true);
  assert.equal(isVerifiedFounder({ user: { id: founderId }, adminRow: activeFounderRow }), false);
  assert.equal(isVerifiedFounder({ user: { id: otherId, user_metadata: { isFounder: true } }, configuredUserId: founderId, adminRow: activeFounderRow }), false);
  assert.equal(isVerifiedFounder({ user: { id: otherId }, configuredUserId: otherId, adminRow: { ...activeFounderRow, user_id: otherId, is_master: false } }), false);
  assert.equal(isVerifiedFounder({ user: { id: otherId }, configuredUserId: otherId, adminRow: { ...activeFounderRow, user_id: otherId, role: "organisation_admin" } }), false);
  assert.equal(isVerifiedFounder({ user: { id: founderId }, configuredUserId: founderId, adminRow: { ...activeFounderRow, status: "inactive" } }), false);
  assert.equal(isVerifiedFounder({ user: { id: founderId }, configuredUserId: founderId, adminRow: null }), false);
});

test("founder choice is offered only after a destination-free, completed sign-in and a positive server check", () => {
  const eligible = { nextPath: null, pendingDestination: null, onboardingComplete: true, verifiedFounder: true };
  assert.equal(shouldOfferFounderSignInChoice(eligible), true);
  assert.equal(shouldOfferFounderSignInChoice({ ...eligible, nextPath: "/dashboard" }), false);
  assert.equal(shouldOfferFounderSignInChoice({ ...eligible, nextPath: "/admin" }), false);
  assert.equal(shouldOfferFounderSignInChoice({ ...eligible, nextPath: "/enterprise" }), false);
  assert.equal(shouldOfferFounderSignInChoice({ ...eligible, pendingDestination: "/invite/accept/test" }), false);
  assert.equal(shouldOfferFounderSignInChoice({ ...eligible, onboardingComplete: false }), false);
  assert.equal(shouldOfferFounderSignInChoice({ ...eligible, verifiedFounder: false }), false);
});

test("launcher availability requires the authenticated server response and passes only a bearer token", async () => {
  const requests = [];
  const request = async (url, init) => {
    requests.push({ url, init });
    return { ok: true, json: async () => ({ available: true }) };
  };
  assert.equal(await hasFounderTestLauncherAccess(null, request), false);
  assert.equal(requests.length, 0);
  assert.equal(await hasFounderTestLauncherAccess("synthetic-token", request), true);
  assert.equal(requests[0].url, "/api/internal/test/environments");
  assert.deepEqual(requests[0].init, { headers: { authorization: "Bearer synthetic-token" }, cache: "no-store" });
  assert.equal(await hasFounderTestLauncherAccess("synthetic-token", async () => ({ ok: false })), false);
});

test("explicit Vault and Admin destinations remain independent during sign-in", () => {
  const input = { canBypassOnboarding: false, onboardingCompleted: true, termsAccepted: true };
  assert.equal(resolveBootstrapDestination({ ...input, nextPath: "/dashboard", roles: ["super_admin"] }).destination, "/dashboard");
  assert.equal(resolveBootstrapDestination({ ...input, nextPath: "/admin", roles: ["super_admin"] }).destination, "/admin");
  assert.equal(resolveBootstrapDestination({ ...input, nextPath: "/enterprise", roles: ["super_admin"] }).destination, "/enterprise");
  assert.equal(resolveBootstrapDestination({ ...input, nextPath: "/admin", roles: ["consumer_user"], completedDestination: "/dashboard" }).destination, "/dashboard");
  assert.equal(canRoleAccessPath(["consumer_user"], "/admin"), false);
  assert.equal(buildProtectedSignInRedirect("/dashboard"), "/sign-in?next=%2Fdashboard");
  assert.equal(buildProtectedSignInRedirect("/admin"), "/sign-in?next=%2Fadmin");
});

test("Dashboard session redirects retain the Vault return path", () => {
  const page = fs.readFileSync(new URL("../app/(app)/dashboard/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /router\.replace\(["']\/sign-in["']\)/);
  assert.match(page, /router\.replace\(buildProtectedSignInRedirect\("\/dashboard"\)\)/);
});

test("launcher remains available from TEST menus and account menus without exposing a diagnostic reason", () => {
  const adminShell = fs.readFileSync(new URL("../components/admin/AdminWorkspaceShell.tsx", import.meta.url), "utf8");
  const vaultShell = fs.readFileSync(new URL("../app/(app)/layout.tsx", import.meta.url), "utf8");
  const launcher = fs.readFileSync(new URL("../components/navigation/FounderTestLauncher.tsx", import.meta.url), "utf8");
  const route = fs.readFileSync(new URL("../app/api/internal/test/environments/route.ts", import.meta.url), "utf8");
  assert.match(adminShell, /<FounderTestLauncher current=\{isPartner \? "partner" : "admin"\} available=\{founderLauncherAvailable\} accountMenuItem/);
  assert.match(vaultShell, /<FounderTestLauncher current="vault" available=\{founderLauncherAvailable\} accountMenuItem/);
  assert.match(launcher, /path: "\/dashboard"/);
  assert.match(launcher, /path: "\/admin"/);
  assert.match(launcher, /path: "\/enterprise"/);
  assert.doesNotMatch(launcher, /target: "_blank"/);
  assert.match(route, /console\.info\("founder_test_launcher_unavailable", \{ reason \}\)/);
  assert.match(route, /NextResponse\.json\(\{ available: false \}/);
  assert.doesNotMatch(route, /NextResponse\.json\(\{ available: false, reason/);
});
