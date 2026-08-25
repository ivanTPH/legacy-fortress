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
