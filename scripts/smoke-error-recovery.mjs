#!/usr/bin/env node

import assert from "node:assert/strict";
import { chromium, request } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  page.setDefaultNavigationTimeout(35000);

  await page.goto("/invite/accept?invitation=missing&token=missing", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /accept invitation/i }).waitFor();
  await page.getByRole("region", { name: /invitation recovery options/i }).waitFor();
  await page.getByText(/resend the invitation from Contacts/i).waitFor();
  await page.getByRole("link", { name: /go to sign in/i }).waitFor();
  await page.getByRole("link", { name: /contact support/i }).waitFor();

  await page.goto("/reset-password?token_hash=invalid&type=recovery", { waitUntil: "networkidle" });
  await page.getByText(/invalid or expired|request a new password reset email/i).waitFor();
  await page.getByRole("link", { name: /request password reset/i }).waitFor();

  await page.goto("/forgot-password", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /forgot password/i }).waitFor();
  await page.getByRole("link", { name: /sign in/i }).click();
  await page.waitForURL(/\/sign-in/);

  const api = await request.newContext({ baseURL: BASE_URL });
  const billing = await api.post("/api/billing/portal");
  assert.equal(billing.status(), 503);
  const payload = await billing.json();
  assert.match(String(payload.error ?? ""), /Billing portal is not configured/i);
  assert.equal(payload.readiness?.provider, "stripe");
  assert.equal(Array.isArray(payload.readiness?.missingSecrets), true);
  await api.dispose();

  console.log(JSON.stringify({
    errorRecovery: {
      invalidInvitationHasRecoveryActions: true,
      invalidPasswordResetHasRecoveryLink: true,
      forgotPasswordReturnsToCanonicalSignIn: true,
      billingPortalUnavailableIsStructured: true,
    },
  }, null, 2));
} finally {
  await browser.close();
}
