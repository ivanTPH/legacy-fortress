import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const SCRIPT = "scripts/validate-uat-environment.mjs";

function runWithEnv(env) {
  return spawnSync(process.execPath, [SCRIPT], {
    env: { PATH: process.env.PATH, ...env },
    encoding: "utf8",
  });
}

test("UAT environment validation passes for separated UAT categories", () => {
  const result = runWithEnv({
    APP_ENV: "uat",
    NEXT_PUBLIC_SUPABASE_URL: "https://uat-project.supabase.co",
    PRODUCTION_SUPABASE_URL: "https://production-project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "redacted-anon",
    SUPABASE_SERVICE_ROLE_KEY: "redacted-service",
    SUPABASE_DB_URL: "postgres://uat.example",
    PRODUCTION_SUPABASE_DB_URL: "postgres://production.example",
    NEXT_PUBLIC_APP_URL: "https://uat.legacyfortress.co.uk",
    PRODUCTION_APP_URL: "https://legacyfortress.co.uk",
    SUPABASE_STORAGE_BUCKET: "uat-documents",
    PRODUCTION_SUPABASE_STORAGE_BUCKET: "production-documents",
    STRIPE_SECRET_KEY: "sk_test_redacted",
    UAT_EMAIL_MODE: "sandbox",
    UAT_NOINDEX_REQUIRED: "true",
    UAT_NOINDEX_ENABLED: "true",
    UAT_BANNER_REQUIRED: "true",
    UAT_BANNER_ENABLED: "true",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /validation passed/i);
});

test("UAT environment validation fails when UAT points at production categories", () => {
  const result = runWithEnv({
    APP_ENV: "uat",
    NEXT_PUBLIC_SUPABASE_URL: "https://same.supabase.co",
    PRODUCTION_SUPABASE_URL: "https://same.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "redacted-anon",
    SUPABASE_SERVICE_ROLE_KEY: "redacted-service",
    NEXT_PUBLIC_APP_URL: "https://legacyfortress.co.uk",
    PRODUCTION_APP_URL: "https://legacyfortress.co.uk",
    STRIPE_SECRET_KEY: "sk_live_redacted",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Supabase URL matches/i);
  assert.match(result.stderr, /live Stripe/i);
  assert.doesNotMatch(result.stderr, /redacted-service|redacted-anon/);
});

test("UAT environment validation fails on shared database identity", () => {
  const result = runWithEnv({
    APP_ENV: "uat",
    NEXT_PUBLIC_SUPABASE_URL: "https://uat-project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "redacted-anon",
    SUPABASE_SERVICE_ROLE_KEY: "redacted-service",
    NEXT_PUBLIC_APP_URL: "https://uat.legacyfortress.co.uk",
    SUPABASE_DB_URL: "postgres://same.example",
    PRODUCTION_SUPABASE_DB_URL: "postgres://same.example",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /database URL matches/i);
});

test("UAT environment validation fails on shared storage bucket", () => {
  const result = runWithEnv({
    APP_ENV: "uat",
    NEXT_PUBLIC_SUPABASE_URL: "https://uat-project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "redacted-anon",
    SUPABASE_SERVICE_ROLE_KEY: "redacted-service",
    NEXT_PUBLIC_APP_URL: "https://uat.legacyfortress.co.uk",
    SUPABASE_STORAGE_BUCKET: "shared-documents",
    PRODUCTION_SUPABASE_STORAGE_BUCKET: "shared-documents",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /storage bucket matches/i);
});

test("UAT environment validation fails on live Stripe mode or shared webhook secret", () => {
  const result = runWithEnv({
    APP_ENV: "uat",
    NEXT_PUBLIC_SUPABASE_URL: "https://uat-project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "redacted-anon",
    SUPABASE_SERVICE_ROLE_KEY: "redacted-service",
    NEXT_PUBLIC_APP_URL: "https://uat.legacyfortress.co.uk",
    STRIPE_SECRET_KEY: "sk_live_redacted",
    STRIPE_WEBHOOK_SECRET: "same-webhook-fingerprint",
    PRODUCTION_STRIPE_WEBHOOK_SECRET: "same-webhook-fingerprint",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /live Stripe/i);
  assert.match(result.stderr, /webhook secret matches/i);
  assert.doesNotMatch(result.stderr, /same-webhook-fingerprint/);
});

test("UAT environment validation fails on production app URL", () => {
  const result = runWithEnv({
    APP_ENV: "uat",
    NEXT_PUBLIC_SUPABASE_URL: "https://uat-project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "redacted-anon",
    SUPABASE_SERVICE_ROLE_KEY: "redacted-service",
    NEXT_PUBLIC_APP_URL: "https://legacyfortress.co.uk",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /production hostname/i);
});

test("UAT environment validation fails without explicit UAT mode", () => {
  const result = runWithEnv({
    NEXT_PUBLIC_SUPABASE_URL: "https://uat-project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "redacted-anon",
    SUPABASE_SERVICE_ROLE_KEY: "redacted-service",
    NEXT_PUBLIC_APP_URL: "https://uat.legacyfortress.co.uk",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /explicitly identify/i);
});

test("UAT environment validation fails when production role harness is enabled", () => {
  const result = runWithEnv({
    APP_ENV: "uat",
    NODE_ENV: "production",
    ENABLE_LOCAL_ADMIN_ROLE_HARNESS: "true",
    NEXT_PUBLIC_SUPABASE_URL: "https://uat-project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "redacted-anon",
    SUPABASE_SERVICE_ROLE_KEY: "redacted-service",
    NEXT_PUBLIC_APP_URL: "https://uat.legacyfortress.co.uk",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /role harness/i);
});

test("UAT environment validation fails when required presentation controls are disabled", () => {
  const result = runWithEnv({
    APP_ENV: "uat",
    NEXT_PUBLIC_SUPABASE_URL: "https://uat-project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "redacted-anon",
    SUPABASE_SERVICE_ROLE_KEY: "redacted-service",
    NEXT_PUBLIC_APP_URL: "https://uat.legacyfortress.co.uk",
    UAT_NOINDEX_REQUIRED: "true",
    UAT_NOINDEX_ENABLED: "false",
    UAT_BANNER_REQUIRED: "true",
    UAT_BANNER_ENABLED: "false",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /noindex/i);
  assert.match(result.stderr, /banner/i);
});
