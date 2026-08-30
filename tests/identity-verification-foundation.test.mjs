import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const service = read("lib/identity-verification/service.ts");
const types = read("lib/identity-verification/types.ts");
const provider = read("lib/identity-verification/internalExperimentalProvider.ts");
const migration = read("supabase/migrations/20260821150000_phase2_identity_verification.sql");
const foundation = read("docs/IDENTITY_VERIFICATION_FOUNDATION.md");

test("internal simulator is explicit and production fail-closed", () => {
  assert.match(service, /IDENTITY_VERIFICATION_PROVIDER/);
  assert.match(service, /configuredProvider === INTERNAL_EXPERIMENTAL_PROVIDER_KEY/);
  assert.match(service, /knownNonProductionTarget/);
  assert.match(service, /knownProductionTarget/);
  assert.match(service, /&& !knownProductionTarget/);
  assert.match(provider, /experimental = true/);
});

test("foundation exposes a central server-side assurance gate", () => {
  assert.match(service, /export async function requireIdentityAssurance/);
  assert.match(service, /lf_identity_presence_level/);
  assert.match(service, /identity_assurance_required/);
  assert.match(foundation, /IDV alone never grants vault access/);
});

test("document model includes supported national identity documents without raw evidence exposure", () => {
  assert.match(types, /national_identity_document/);
  assert.match(provider, /national_identity_document/);
  assert.match(migration, /identity-verification-evidence/);
  assert.match(migration, /CREATE POLICY identity_evidence_owner_select/);
  assert.match(migration, /split_part\(name, '\/', 2\) = auth\.uid\(\)::text/);
  assert.match(foundation, /Raw document images, MRZ\/NFC data, selfie video/);
});

test("foundation documents callback, retention, and authority boundaries", () => {
  assert.match(foundation, /validate signatures/);
  assert.match(foundation, /idempotency/);
  assert.match(foundation, /legal authority/);
  assert.match(foundation, /scheduled cleanup/);
});
