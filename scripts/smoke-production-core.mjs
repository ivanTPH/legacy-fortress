#!/usr/bin/env node

import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { chromium, devices, request } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const MAX_ROUTE_LOAD_MS = Number(process.env.SMOKE_MAX_ROUTE_LOAD_MS || 12000);
const PERFORMANCE_BUDGET_MULTIPLIER = Number(process.env.SMOKE_PERFORMANCE_BUDGET_MULTIPLIER || 1);
const PERFORMANCE_BUDGET_STRICT = process.env.SMOKE_PERFORMANCE_BUDGET_STRICT === "true";

const publicRoutePerformanceBudgets = new Map([
  ["/", 4000],
  ["/sign-in", 3500],
  ["/sign-up", 3500],
  ["/forgot-password", 3000],
  ["/support", 3500],
]);

const publicRoutes = [
  { path: "/", name: "home", patterns: [/Legacy Fortress/i] },
  { path: "/sign-in", name: "sign-in", patterns: [/Sign in/i] },
  { path: "/sign-up", name: "sign-up", patterns: [/Create account/i] },
  { path: "/forgot-password", name: "forgot-password", patterns: [/Forgot password/i] },
  { path: "/support", name: "support", patterns: [/Support|Sign in/i] },
];

const protectedRoutes = [
  "/dashboard",
  "/contacts",
  "/finances/bank",
  "/account/security",
  "/internal/admin",
];

const browser = await chromium.launch({ headless: true });

try {
  const api = await request.newContext({ baseURL: BASE_URL });
  const apiChecks = await verifyApiHealth(api);
  await api.dispose();

  const desktopContext = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 1000 },
  });
  const desktopPage = await desktopContext.newPage();
  desktopPage.setDefaultTimeout(25000);
  desktopPage.setDefaultNavigationTimeout(40000);

  const publicChecks = [];
  for (const route of publicRoutes) {
    publicChecks.push(await verifyPublicRoute(desktopPage, route));
  }
  const performanceBudget = evaluatePerformanceBudget(publicChecks);
  if (performanceBudget.warnings.length) {
    console.warn(`[smoke-production-core] Performance budget warnings: ${performanceBudget.warnings.map((warning) => warning.message).join(" | ")}`);
  }
  if (PERFORMANCE_BUDGET_STRICT) {
    assert.equal(performanceBudget.warnings.length, 0, "Public route performance budget warnings found");
  }
  const recoveryChecks = await verifyRecoveryRoutes(desktopPage);
  const protectedChecks = [];
  for (const path of protectedRoutes) {
    protectedChecks.push(await verifyProtectedRoute(desktopPage, path));
  }
  await desktopContext.close();

  const mobileContext = await browser.newContext({
    ...devices["iPhone 13"],
    baseURL: BASE_URL,
  });
  const mobilePage = await mobileContext.newPage();
  mobilePage.setDefaultTimeout(25000);
  mobilePage.setDefaultNavigationTimeout(40000);
  const mobileChecks = [];
  for (const route of publicRoutes.slice(0, 4)) {
    mobileChecks.push(await verifyMobileRoute(mobilePage, route));
  }
  await mobileContext.close();

  console.log(JSON.stringify({
    baseUrl: BASE_URL,
    productionCore: {
      api: apiChecks,
      publicRoutes: publicChecks,
      performanceBudget,
      protectedRoutes: protectedChecks,
      recovery: recoveryChecks,
      mobile: mobileChecks,
    },
  }, null, 2));
} finally {
  await browser.close();
}

function evaluatePerformanceBudget(publicChecks) {
  const routes = publicChecks.map((check) => {
    const baseBudgetMs = publicRoutePerformanceBudgets.get(check.path) ?? MAX_ROUTE_LOAD_MS;
    const budgetMs = Math.round(baseBudgetMs * PERFORMANCE_BUDGET_MULTIPLIER);
    const overBudget = check.loadMs > budgetMs;
    return {
      path: check.path,
      loadMs: check.loadMs,
      budgetMs,
      overBudget,
    };
  });
  const warnings = routes
    .filter((route) => route.overBudget)
    .map((route) => ({
      path: route.path,
      loadMs: route.loadMs,
      budgetMs: route.budgetMs,
      message: `${route.path} loaded in ${route.loadMs}ms, above soft budget ${route.budgetMs}ms`,
    }));
  return {
    strict: PERFORMANCE_BUDGET_STRICT,
    multiplier: PERFORMANCE_BUDGET_MULTIPLIER,
    routes,
    warnings,
  };
}

async function verifyApiHealth(api) {
  const health = await api.get("/api/health");
  assert.equal(health.status(), 200, "/api/health should return 200");
  const healthJson = await health.json();
  assert.equal(healthJson.ok, true, "/api/health should report ok=true");

  const version = await api.get("/api/version");
  assert.equal(version.status(), 200, "/api/version should return 200");
  const versionJson = await version.json();
  assert.equal(versionJson.name, "legacy-fortress-web");

  const schema = await api.get("/api/health/schema");
  assert.ok([200, 503].includes(schema.status()), "/api/health/schema should return a structured status");
  const schemaJson = await schema.json();
  assert.equal(typeof schemaJson.ok, "boolean", "/api/health/schema should include ok");
  assert.equal(Array.isArray(schemaJson.checks), true, "/api/health/schema should include checks");

  return {
    healthOk: true,
    versionOk: true,
    schemaStatus: schema.status(),
    schemaOk: schemaJson.ok,
  };
}

async function verifyPublicRoute(page, route) {
  const started = performance.now();
  const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => null);
  const loadMs = Math.round(performance.now() - started);
  assert.ok(response, `${route.path} should return a response`);
  assert.ok(response.status() < 400, `${route.path} returned ${response.status()}`);
  assert.ok(loadMs <= MAX_ROUTE_LOAD_MS, `${route.path} loaded slowly: ${loadMs}ms`);

  for (const pattern of route.patterns) {
    await waitForBodyText(page, pattern, route.path);
  }
  await assertHealthyDocument(page, route.path);

  return {
    path: route.path,
    status: response.status(),
    loadMs,
  };
}

async function verifyProtectedRoute(page, path) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => null);
  assert.ok(response, `${path} should return a response`);
  assert.ok(response.status() < 500, `${path} should not server-error`);
  await assertHealthyDocument(page, path);

  await page.waitForFunction(() => {
    const text = document.body?.innerText ?? "";
    return /sign in|secure access|internal admin|admin operations/i.test(text);
  }, null, { timeout: 10000 }).catch(() => null);

  const url = page.url();
  const bodyText = await page.locator("body").innerText();
  const gated = /\/sign-in|\/signin|\/account\/terms|\/onboarding/.test(url) || /sign in|secure access|private estate record vault/i.test(bodyText);
  const intentionallyPublicPrototype = path === "/internal/admin" && /Internal admin|Admin operations|Sign in/i.test(bodyText);
  assert.equal(gated || intentionallyPublicPrototype, true, `${path} did not show an expected access gate`);

  return {
    path,
    status: response.status(),
    gated: Boolean(gated),
    finalPath: new URL(url).pathname,
  };
}

async function verifyRecoveryRoutes(page) {
  await page.goto("/invite/accept?invitation=missing&token=missing", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => null);
  await page.getByRole("heading", { name: /accept invitation/i }).waitFor();
  await page.getByRole("region", { name: /invitation recovery options/i }).waitFor();
  await page.getByRole("link", { name: /go to sign in/i }).waitFor();
  await page.getByRole("link", { name: /contact support/i }).waitFor();

  await page.goto("/reset-password?token_hash=invalid&type=recovery", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => null);
  await page.getByRole("link", { name: /request password reset/i }).waitFor();

  return {
    invalidInvitationRecovery: true,
    invalidResetRecovery: true,
  };
}

async function verifyMobileRoute(page, route) {
  const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => null);
  assert.ok(response, `${route.path} mobile should return a response`);
  assert.ok(response.status() < 400, `${route.path} mobile returned ${response.status()}`);
  for (const pattern of route.patterns) {
    await waitForBodyText(page, pattern, route.path);
  }
  const metrics = await assertHealthyDocument(page, route.path);
  assert.equal(metrics.hasHorizontalOverflow, false, `${route.path} has mobile horizontal overflow`);
  return {
    path: route.path,
    status: response.status(),
    overflowFree: !metrics.hasHorizontalOverflow,
  };
}

async function waitForBodyText(page, pattern, path) {
  try {
    await page.waitForFunction(({ source, flags }) => {
      const text = document.body?.innerText ?? "";
      return new RegExp(source, flags).test(text);
    }, { source: pattern.source, flags: pattern.flags });
  } catch (error) {
    const bodyText = await page.locator("body").innerText().catch(() => "");
    throw new Error(`${path} did not render expected text ${pattern}. Body snippet: ${bodyText.slice(0, 500)}`, {
      cause: error,
    });
  }
}

async function assertHealthyDocument(page, path) {
  const metrics = await page.evaluate(() => {
    const text = document.body?.innerText ?? "";
    const main = document.querySelector("main");
    return {
      title: document.title,
      bodyLength: text.trim().length,
      hasNextError: /Application error|Unhandled Runtime Error|This page could not be found/i.test(text),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      mainScrollWidth: main instanceof HTMLElement ? main.scrollWidth : 0,
      mainClientWidth: main instanceof HTMLElement ? main.clientWidth : 0,
    };
  });

  assert.ok(metrics.bodyLength > 20, `${path} rendered an unexpectedly empty page`);
  assert.equal(metrics.hasNextError, false, `${path} rendered an application error`);
  return metrics;
}
