import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const scripts = {
  A: "phase6-hosted-identity-assurance.mjs",
  B: "phase6-hosted-cross-user-isolation.mjs",
  C: "phase6-hosted-death-estate.mjs",
  D: "phase6-hosted-enterprise-isolation.mjs",
  E: "phase6-hosted-system-admin-isolation.mjs",
  F: "phase6-hosted-privacy-isolation.mjs",
};

for (const [batch, file] of Object.entries(scripts)) {
  test(`hosted Batch ${batch} script has staging guard, structured result and cleanup`, () => {
    const source = fs.readFileSync(path.join(root, "scripts", file), "utf8");
    assert.match(source, /from "\.\/phase6-hosted-fixtures\.mjs"/);
    assert.match(source, /clients\(\)/);
    assert.match(source, /finally/);
    assert.match(source, /cleanup\(/);
    assert.match(source, /finish\(/);
    assert.doesNotMatch(source, /SERVICE_ROLE_KEY\s*=/);
    assert.doesNotMatch(source, /password\s*:\s*["'`](?!\$\{)/i);
  });
}

test("parent runner registers canonical hosted Batch A-F scripts", () => {
  const source = fs.readFileSync(path.join(root, "scripts/phase6-hosted-acceptance.mjs"), "utf8");
  for (const file of Object.values(scripts)) assert.match(source, new RegExp(file.replaceAll(".", "\\.")));
  assert.doesNotMatch(source, /Batch A\/B/);
  assert.doesNotMatch(source, /E2E_USER_PASSWORD/);
});

test("hosted fixture helper rejects production and Supabase Cloud targets", () => {
  const source = fs.readFileSync(path.join(root, "scripts/phase6-hosted-fixtures.mjs"), "utf8");
  assert.match(source, /test\.mylegacyfortress\.com/);
  assert.match(source, /supabase-test\.mylegacyfortress\.com/);
  assert.match(source, /production|supabase\\\.co|legacy-fortress\\\.vercel\\\.app/);
});

test("Batch G browser preflight reports the exact staging remediation", () => {
  const source = fs.readFileSync(path.join(root, "scripts/phase6-hosted-playwright-preflight.mjs"), "utf8");
  assert.match(source, /Chromium executable does not exist/);
  assert.match(source, /npx playwright install --with-deps chromium/);
  assert.match(source, /TEST-ENVIRONMENT DEFECT/);
});

test("Batch F uses the canonical grant revocation state and checks persistence", () => {
  const source = fs.readFileSync(path.join(root, "scripts/phase6-hosted-privacy-isolation.mjs"), "utf8");
  assert.match(source, /update\(\{ activation_status: "revoked", updated_at:/);
  assert.match(source, /Revoked grant remains auditable/);
  assert.match(source, /Unrelated grant remains active/);
  assert.match(source, /Revoked recipient cannot regain linked access/);
  assert.doesNotMatch(source, /update\(\{[^}]*revoked_at:/s);
});

test("invitation smoke treats Supabase auth cooldowns as generated-link fallback", () => {
  const source = fs.readFileSync(path.join(root, "scripts/smoke-contacts-invitations.mjs"), "utf8");
  assert.match(source, /isAuthRateLimitError/);
  assert.match(source, /generated-link fallback/);
  assert.match(source, /for security purposes/);
  assert.match(source, /function logStep\(message\)/);
  assert.match(source, /if \(delivery\.error && !deliveryRateLimited\) throw/);
});

test("invitation smoke owns one marked recipient and refuses Auth-user collisions", () => {
  const source = fs.readFileSync(path.join(root, "scripts/smoke-contacts-invitations.mjs"), "utf8");
  assert.match(source, /createSyntheticRecipientUser\(\)/);
  assert.match(source, /synthetic_run_marker/);
  assert.match(source, /refusing to adopt an existing Auth user/);
  assert.match(source, /Synthetic recipient was not provisioned before invitation delivery/);
});

test("invitation smoke accepts the pending-verification destination and sanitizes diagnostics", () => {
  const source = fs.readFileSync(path.join(root, "scripts/smoke-contacts-invitations.mjs"), "utf8");
  assert.match(source, /identity\\\/verify/);
  assert.match(source, /contact-wallet/);
  assert.match(source, /requestfailed/);
  assert.match(source, /relevantResponses/);
  assert.match(source, /sanitizeUrl/);
  assert.match(source, /token_hash|access_token|refresh_token/);
});

test("Batch F calls linked-access RPC with explicit allowed statuses and valid assurance prerequisites", () => {
  const source = fs.readFileSync(path.join(root, "scripts/phase6-hosted-privacy-isolation.mjs"), "utf8");
  assert.match(source, /ownerContext\(admin, owner\.id/);
  assert.match(source, /identity_level: 2/);
  assert.match(source, /p_allowed_statuses: \["accepted", "verified", "active"\]/);
  assert.match(source, /Unrelated active grant remains effective/);
});
