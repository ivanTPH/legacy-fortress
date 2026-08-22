import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const migration = read("supabase/migrations/20260822120000_phase4_estate_administration_control_plane.sql");
const service = read("lib/estate-administration/service.ts");
const capabilities = read("lib/admin/capabilities.ts");
const docs = read("docs/ESTATE_ADMINISTRATION_PHASE4.md");

test("Phase 4 migration creates estate administration working model", () => {
  for (const table of [
    "estate_cases",
    "estate_participants",
    "estate_tasks",
    "estate_valuations",
    "estate_liabilities",
    "estate_beneficiary_records",
    "estate_distributions",
    "sensitive_action_requests",
    "sensitive_action_approvals",
    "vault_recovery_material",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
  }
});

test("Estate permissions are explicit and role is not blanket access", () => {
  assert.match(migration, /lf_estate_participant_has_permission/);
  assert.match(migration, /participant\.status = 'active'/);
  assert.match(migration, /participant\.permissions -> 'capabilities'/);
  assert.match(service, /estate_permission_required:/);
  assert.doesNotMatch(service, /participant_role[\s\S]{0,300}edit_everything/);
});

test("Historic vault boundaries and estate storage remain separate", () => {
  assert.match(migration, /estate-administration-evidence/);
  assert.match(service, /prior_version_cross_case_denied/);
  assert.match(service, /Estate valuation recorded separately from historic asset value/);
  assert.doesNotMatch(migration, /UPDATE public\.assets[\s\S]*valuation_amount_minor/);
  assert.doesNotMatch(migration, /vault-docs[\s\S]*estate_participants[\s\S]*CREATE POLICY/);
});

test("Suspension, revocation and signed URL checks require active estate permission", () => {
  assert.match(migration, /claim\.status = 'active'/);
  assert.match(migration, /participant\.status = 'active'/);
  assert.match(migration, /download_estate_documents/);
  assert.doesNotMatch(migration, /auth\.uid\(\) = uploaded_by_user_id/);
});

test("Sensitive actions enforce dual-control and Level 3 presence", () => {
  assert.match(migration, /sensitive_action_self_approval_denied/);
  assert.match(migration, /approver_user_id <> request\.requester_user_id/);
  assert.match(migration, /required_approvals/);
  assert.match(service, /level_3_required_for_sensitive_action/);
  assert.match(service, /level_3_required_for_sensitive_action_approval/);
});

test("Recovery material model forbids plaintext key fields", () => {
  assert.match(migration, /vault_recovery_material/);
  assert.match(migration, /wrapped_material_reference/);
  assert.match(migration, /kms_key_reference/);
  assert.match(migration, /plaintext_key/);
  assert.match(migration, /recovery_access_requests_no_plaintext/);
});

test("Admin capabilities are estate-specific", () => {
  for (const capability of [
    "estate_case_review",
    "estate_access_manage",
    "estate_security_suspend",
    "estate_recovery_request",
    "estate_recovery_approve",
    "estate_recovery_execute",
  ]) {
    assert.match(capabilities, new RegExp(`"${capability}"`));
  }
});

test("Phase 4 documentation states implemented limitations and boundaries", () => {
  assert.match(docs, /Historic deceased vault/i);
  assert.match(docs, /requester cannot approve their own request/i);
  assert.match(docs, /No plaintext DEK, KEK or master key material/i);
  assert.match(docs, /Real notification delivery and production KMS-backed recovery execution.*not enabled/i);
});
