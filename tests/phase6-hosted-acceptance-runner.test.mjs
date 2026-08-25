import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const runner = fs.readFileSync(path.join(root, "scripts/phase6-hosted-acceptance.mjs"), "utf8");

test("Phase 6 hosted runner accounts for each batch independently", () => {
  for (const batch of ["Batch A", "Batch B", "Batch C", "Batch D", "Batch E", "Batch F", "Batch G"]) {
    assert.match(runner, new RegExp(batch.replace(" ", "\\s+")));
  }
  assert.doesNotMatch(runner, /Batch A\/B|Batch A\/B/);
});

test("Phase 6 hosted runner is staging-only and never embeds production/cloud targets", () => {
  assert.match(runner, /https:\/\/test\.mylegacyfortress\.com/);
  assert.match(runner, /https:\/\/supabase-test\.mylegacyfortress\.com/);
  assert.match(runner, /\.supabase\\\.co/);
  assert.match(runner, /legacy-fortress\\\.vercel\\\.app/);
  assert.match(runner, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(runner, /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'`]/);
});

test("child failures are classified conservatively and child classifications are supported", () => {
  assert.match(runner, /UNCLASSIFIED FAILURE — INVESTIGATION REQUIRED/);
  assert.match(runner, /parseChildClassification/);
  assert.match(runner, /document fixture failed\|fixture .*failed/);
});

test("parent propagates the canonical Supabase URL to children", () => {
  assert.match(runner, /NEXT_PUBLIC_SUPABASE_URL:\s*SUPABASE_URL/);
  assert.doesNotMatch(runner, /\{\s*BASE_URL,\s*NEXT_PUBLIC_SUPABASE_URL\s*\}/);
});

test("remaining hosted batches are executable through repository-local hooks", () => {
  assert.match(runner, /process\.env\[`PHASE6_\$\{name\}_SCRIPT`\]/);
  assert.match(runner, /No hosted .* script configured/);
  assert.match(runner, /path\.sep/);
});

test("runner writes machine-readable and line-oriented evidence without passwords", () => {
  assert.match(runner, /PHASE6_EVIDENCE_JSON/);
  assert.match(runner, /PHASE6_EVIDENCE_LOG/);
  assert.match(runner, /fs\.writeFileSync\(evidencePath/);
  assert.match(runner, /fs\.appendFileSync\(logPath/);
  assert.doesNotMatch(runner, /E2E_USER_PASSWORD/);
});
