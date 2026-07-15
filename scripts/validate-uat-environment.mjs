#!/usr/bin/env node

const REQUIRED_UAT_NAMES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
];

const FAILURES = [];

function value(name) {
  return String(process.env[name] ?? "").trim();
}

function addFailure(message) {
  FAILURES.push(message);
}

function sameSecretSafe(leftName, rightName) {
  const left = value(leftName);
  const right = value(rightName);
  return Boolean(left && right && left === right);
}

function isProductionLike(input) {
  return /legacy-fortress\.vercel\.app|legacyfortress\.co\.uk$/i.test(input);
}

function isUatMode() {
  return ["uat", "local_uat", "local-uat", "staging", "preview"].includes(value("APP_ENV").toLowerCase())
    || ["uat", "local_uat", "local-uat", "staging", "preview"].includes(value("LEGACY_FORTRESS_ENV").toLowerCase());
}

for (const name of REQUIRED_UAT_NAMES) {
  if (!value(name)) addFailure(`${name} is required for UAT validation.`);
}

if (!isUatMode()) {
  addFailure("APP_ENV or LEGACY_FORTRESS_ENV must explicitly identify this as UAT/staging/local UAT.");
}

if (sameSecretSafe("NEXT_PUBLIC_SUPABASE_URL", "PRODUCTION_SUPABASE_URL")) {
  addFailure("UAT Supabase URL matches the configured production Supabase URL.");
}

if (sameSecretSafe("SUPABASE_DB_URL", "PRODUCTION_SUPABASE_DB_URL")) {
  addFailure("UAT database URL matches the configured production database URL.");
}

if (sameSecretSafe("NEXT_PUBLIC_APP_URL", "PRODUCTION_APP_URL")) {
  addFailure("UAT application URL matches the configured production application URL.");
}

if (sameSecretSafe("SUPABASE_STORAGE_BUCKET", "PRODUCTION_SUPABASE_STORAGE_BUCKET")) {
  addFailure("UAT storage bucket matches the configured production storage bucket.");
}

if (value("STRIPE_SECRET_KEY").startsWith("sk_live_")) {
  addFailure("UAT must not use a live Stripe secret key.");
}

if (value("STRIPE_WEBHOOK_SECRET") && value("STRIPE_MODE").toLowerCase() === "live") {
  addFailure("UAT Stripe webhook configuration appears to be live mode.");
}

if (sameSecretSafe("STRIPE_WEBHOOK_SECRET", "PRODUCTION_STRIPE_WEBHOOK_SECRET")) {
  addFailure("UAT Stripe webhook secret matches the configured production webhook secret.");
}

if (value("UAT_EMAIL_MODE").toLowerCase() === "production") {
  addFailure("UAT email mode must not be production.");
}

if (sameSecretSafe("UAT_EMAIL_CREDENTIAL_FINGERPRINT", "PRODUCTION_EMAIL_CREDENTIAL_FINGERPRINT")) {
  addFailure("UAT email credential fingerprint matches the configured production email credential fingerprint.");
}

if (isProductionLike(value("NEXT_PUBLIC_APP_URL")) && !/uat|staging|preview/i.test(value("NEXT_PUBLIC_APP_URL"))) {
  addFailure("UAT application URL appears to be a production hostname.");
}

if (value("COOKIE_DOMAIN") && sameSecretSafe("COOKIE_DOMAIN", "PRODUCTION_COOKIE_DOMAIN")) {
  addFailure("UAT cookie domain matches production cookie domain.");
}

if (value("ENABLE_LOCAL_ADMIN_ROLE_HARNESS") === "true" && value("NODE_ENV") === "production") {
  addFailure("Local admin role harness is enabled in production mode.");
}

if (value("UAT_NOINDEX_REQUIRED") === "true" && value("UAT_NOINDEX_ENABLED") !== "true") {
  addFailure("UAT noindex is required but not enabled.");
}

if (value("UAT_BANNER_REQUIRED") === "true" && value("UAT_BANNER_ENABLED") !== "true") {
  addFailure("UAT banner is required but not enabled.");
}

if (FAILURES.length > 0) {
  console.error("UAT environment validation failed:");
  for (const failure of FAILURES) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("UAT environment validation passed without printing secrets.");
