import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const script = fs.readFileSync("scripts/smoke-production-core.mjs", "utf8");
const authenticatedUxScript = fs.readFileSync("scripts/smoke-authenticated-ux.mjs", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const healthRoute = fs.readFileSync("app/api/health/route.ts", "utf8");
const versionRoute = fs.readFileSync("app/api/version/route.ts", "utf8");
const clientEventsRoute = fs.readFileSync("app/api/observability/client-events/route.ts", "utf8");
const clientEvents = fs.readFileSync("lib/observability/clientEvents.ts", "utf8");
const homeEntry = fs.readFileSync("components/auth/PublicHomeEntry.tsx", "utf8");
const homePage = fs.readFileSync("app/page.tsx", "utf8");

test("production smoke checks public, protected, recovery, API, and mobile surfaces", () => {
  assert.match(script, /publicRoutes/);
  assert.match(script, /protectedRoutes/);
  assert.match(script, /verifyApiHealth/);
  assert.match(script, /verifyRecoveryRoutes/);
  assert.match(script, /verifyMobileRoute/);
  assert.match(script, /evaluatePerformanceBudget/);
  assert.match(script, /publicRoutePerformanceBudgets/);
  assert.match(script, /SMOKE_PERFORMANCE_BUDGET_STRICT/);
  assert.match(script, /\/api\/health\/schema/);
  assert.match(script, /\/invite\/accept\?invitation=missing&token=missing/);
  assert.match(healthRoute, /Cache-Control": "public, max-age=0, must-revalidate/);
  assert.match(healthRoute, /Vercel-CDN-Cache-Control": "max-age=30, stale-while-revalidate=120/);
  assert.match(versionRoute, /Cache-Control": "public, max-age=0, must-revalidate/);
  assert.match(versionRoute, /Vercel-CDN-Cache-Control": "max-age=300, stale-while-revalidate=3600/);
});

test("production smoke is available as an npm script", () => {
  assert.equal(packageJson.scripts["smoke:production:core"], "node scripts/smoke-production-core.mjs");
  assert.equal(packageJson.scripts["smoke:authenticated:ux"], "node scripts/smoke-authenticated-ux.mjs");
  assert.match(packageJson.scripts["smoke:production:strict"], /SMOKE_PERFORMANCE_BUDGET_STRICT=true/);
});

test("authenticated UX smoke protects demo session navigation and avatar stability", () => {
  assert.match(authenticatedUxScript, /\/api\/demo\/session/);
  assert.match(authenticatedUxScript, /verifyAvatarSurface/);
  assert.match(authenticatedUxScript, /topbar avatar must not switch from ready image to fallback/);
  assert.match(authenticatedUxScript, /authenticated mobile dashboard must not horizontally overflow/);
  assert.match(authenticatedUxScript, /iconFontFailures/);
});

test("client observability accepts only non-sensitive allowlisted events", () => {
  assert.match(clientEventsRoute, /ALLOWED_EVENT_PREFIXES/);
  assert.match(clientEventsRoute, /auth\.callback\./);
  assert.match(clientEventsRoute, /Cache-Control": "no-store"/);
  assert.match(clientEventsRoute, /normalizedKey\.includes\("email"\)/);
  assert.match(clientEventsRoute, /normalizedKey\.includes\("token"\)/);
  assert.match(clientEvents, /navigator\.sendBeacon/);
  assert.match(clientEvents, /shouldSendClientEvent/);
});

test("public home stays static and keeps query-aware auth handling out of the shell", () => {
  assert.doesNotMatch(homeEntry, /"use client"/);
  assert.doesNotMatch(homeEntry, /useSearchParams/);
  assert.doesNotMatch(homePage, /searchParams/);
  assert.match(homePage, /<PublicHomeEntry \/>/);
});
