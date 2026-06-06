#!/usr/bin/env node

import assert from "node:assert/strict";
import { chromium, devices, request } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const MAX_ROUTE_LOAD_MS = Number(process.env.SMOKE_AUTHENTICATED_MAX_ROUTE_LOAD_MS || 12000);

const browser = await chromium.launch({ headless: true });

try {
  const desktopDemo = await prepareDemoActionLink();

  const desktopContext = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 1000 },
  });
  const desktopPage = await desktopContext.newPage();
  const desktopErrors = captureConsoleErrors(desktopPage);
  desktopPage.setDefaultTimeout(30000);
  desktopPage.setDefaultNavigationTimeout(45000);

  const signIn = await measureNavigation(desktopPage, desktopDemo.actionLink, /\/(?:app\/)?dashboard|\/account\/terms|\/profile/);
  if (!/\/(?:app\/)?dashboard/.test(desktopPage.url())) {
    await desktopPage.goto("/dashboard", { waitUntil: "networkidle" });
  }
  await desktopPage.getByText(/Demo account|Bill Smith|Overview/i).first().waitFor();
  const firstAvatar = await verifyAvatarSurface(desktopPage, "desktop initial dashboard");

  const journeys = [];
  for (const path of ["/personal/contacts", "/finances/bank", "/dashboard"]) {
    journeys.push(await measureNavigation(desktopPage, path, null));
    await verifyAvatarSurface(desktopPage, `desktop ${path}`);
  }

  await desktopPage.waitForTimeout(1600);
  const finalAvatar = await verifyAvatarSurface(desktopPage, "desktop delayed dashboard");
  assert.equal(
    firstAvatar.topbar.ready && !finalAvatar.topbar.ready,
    false,
    "topbar avatar must not switch from ready image to fallback after hydration",
  );
  assert.equal(desktopErrors.length, 0, `desktop authenticated journey logged console errors: ${desktopErrors.join(" | ")}`);

  await desktopContext.close();

  const mobileContext = await browser.newContext({
    ...devices["iPhone 13"],
    baseURL: BASE_URL,
  });
  const mobilePage = await mobileContext.newPage();
  const mobileErrors = captureConsoleErrors(mobilePage);
  mobilePage.setDefaultTimeout(30000);
  mobilePage.setDefaultNavigationTimeout(45000);

  const mobileDemo = await prepareDemoActionLink();
  await mobilePage.goto(mobileDemo.actionLink, { waitUntil: "networkidle" });
  await mobilePage.waitForURL(/\/(?:app\/)?dashboard|\/account\/terms|\/profile/, { timeout: 45000 });
  if (!/\/(?:app\/)?dashboard/.test(mobilePage.url())) {
    await mobilePage.goto("/dashboard", { waitUntil: "networkidle" });
  }
  await mobilePage.getByRole("button", { name: /toggle navigation menu/i }).click();
  const mobileAvatar = await verifyAvatarSurface(mobilePage, "mobile drawer dashboard");
  const mobileOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(mobileOverflow, false, "authenticated mobile dashboard must not horizontally overflow");
  assert.equal(mobileErrors.length, 0, `mobile authenticated journey logged console errors: ${mobileErrors.join(" | ")}`);

  await mobileContext.close();

  console.log(JSON.stringify({
    baseUrl: BASE_URL,
    authenticatedUx: {
      demoReviewer: desktopDemo.reviewerEmail,
      signIn,
      journeys,
      desktopAvatar: finalAvatar,
      mobileAvatar,
      consoleErrors: {
        desktop: desktopErrors.length,
        mobile: mobileErrors.length,
      },
    },
  }, null, 2));
} finally {
  await browser.close();
}

async function prepareDemoActionLink() {
  const api = await request.newContext({ baseURL: BASE_URL });
  try {
    const demoResponse = await api.post("/api/demo/session");
    assert.equal(demoResponse.status(), 200, "demo session endpoint should be available");
    const demoJson = await demoResponse.json();
    assert.equal(demoJson.ok, true, "demo session endpoint should report ok");
    assert.ok(demoJson.demo?.actionLink, "demo session should return an action link");
    return demoJson.demo;
  } finally {
    await api.dispose();
  }
}

async function measureNavigation(page, urlOrPath, expectedUrlPattern) {
  const started = Date.now();
  const response = await page.goto(urlOrPath, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 9000 }).catch(() => null);
  if (expectedUrlPattern) {
    await page.waitForURL(expectedUrlPattern, { timeout: 45000 }).catch(() => null);
  }
  const loadMs = Date.now() - started;
  assert.ok(response, `${urlOrPath} should return a response`);
  assert.ok(response.status() < 500, `${urlOrPath} should not server-error`);
  assert.ok(loadMs <= MAX_ROUTE_LOAD_MS, `${urlOrPath} loaded slowly: ${loadMs}ms`);
  await assertHealthyDocument(page, urlOrPath);
  return {
    path: String(urlOrPath).startsWith("http") ? new URL(String(urlOrPath)).pathname : String(urlOrPath),
    status: response.status(),
    loadMs,
    finalPath: new URL(page.url()).pathname,
  };
}

async function verifyAvatarSurface(page, label) {
  const metrics = await page.evaluate(() => {
    function read(selector) {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) {
        return { present: false, visible: false, ready: false, width: 0, height: 0, text: "" };
      }
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return {
        present: true,
        visible: rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none",
        ready: element.getAttribute("data-avatar-ready") === "true",
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        text: element.textContent?.trim() ?? "",
      };
    }

    return {
      topbar: read(".lf-topbar-user-avatar"),
      sidebar: read(".lf-user-avatar"),
    };
  });

  assert.equal(metrics.topbar.present, true, `${label}: topbar avatar is missing`);
  assert.equal(metrics.topbar.visible, true, `${label}: topbar avatar is hidden`);
  assert.ok(metrics.topbar.width >= 36 && metrics.topbar.height >= 36, `${label}: topbar avatar is too small`);
  assert.ok(metrics.topbar.ready || metrics.topbar.text.length > 0, `${label}: topbar avatar has neither image nor fallback`);

  if (metrics.sidebar.present) {
    assert.equal(metrics.sidebar.visible, true, `${label}: sidebar/mobile avatar is hidden`);
    assert.ok(metrics.sidebar.width >= 36 && metrics.sidebar.height >= 36, `${label}: sidebar/mobile avatar is too small`);
    assert.ok(metrics.sidebar.ready || metrics.sidebar.text.length > 0, `${label}: sidebar/mobile avatar has neither image nor fallback`);
  }

  return metrics;
}

async function assertHealthyDocument(page, path) {
  const metrics = await page.evaluate(() => {
    const text = document.body?.innerText ?? "";
    const iconFontFailures = Array.from(document.querySelectorAll(".material-symbols-outlined, .material-symbols-rounded, [class*='material-symbols']"))
      .map((element) => {
        const style = window.getComputedStyle(element);
        return {
          text: element.textContent?.trim() ?? "",
          fontFamily: style.fontFamily,
        };
      })
      .filter((item) => item.text && !/Material Symbols/i.test(item.fontFamily));
    return {
      bodyLength: text.trim().length,
      hasRuntimeError: /Application error|Unhandled Runtime Error|This page could not be found/i.test(text),
      iconFontFailures,
    };
  });
  assert.ok(metrics.bodyLength > 100, `${path} rendered too little content`);
  assert.equal(metrics.hasRuntimeError, false, `${path} rendered a runtime error`);
  assert.deepEqual(metrics.iconFontFailures, [], `${path} has Material Symbols elements without the icon font`);
}

function captureConsoleErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !/^Failed to load resource:/i.test(text)) {
      errors.push(text.slice(0, 300));
    }
  });
  page.on("pageerror", (error) => {
    errors.push(error.message.slice(0, 300));
  });
  return errors;
}
