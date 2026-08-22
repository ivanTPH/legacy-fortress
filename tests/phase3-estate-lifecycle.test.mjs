import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const migration = read("supabase/migrations/20260822100000_phase3_death_lock_estate_lifecycle.sql");
const rpcRestrictionMigration = read("supabase/migrations/20260822103000_phase3_restrict_vault_transition_rpc.sql");
const estateDocumentSuspensionMigration = read("supabase/migrations/20260822104500_phase3_estate_document_suspension_rls.sql");
const estateDocumentPolicyIdMigration = read("supabase/migrations/20260822110000_phase3_qualify_estate_document_policy_id.sql");
const service = read("lib/estate-lifecycle/service.ts");
const probate = read("lib/admin/probateCases.ts");
const deathApi = read("app/api/estate/death-reports/route.ts");
const adminDeathApi = read("app/api/internal/admin/estate-cases/death-reports/[reportId]/actions/route.ts");
const docs = read("docs/ESTATE_LIFECYCLE_PHASE3.md");

test("Phase 3 migration separates vault lifecycle from death reports and estate claims", () => {
  for (const table of [
    "death_reports",
    "death_report_evidence",
    "death_report_events",
    "estate_access_claims",
    "estate_access_decisions",
    "estate_administration_documents",
    "estate_security_actions",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
  }
  assert.match(migration, /'estate-administration-evidence'/);
  assert.match(migration, /claimant_identity_level/);
  assert.match(migration, /authority_evidence_status/);
});

test("Vault lifecycle transitions are explicit and audited", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.lf_valid_vault_lifecycle_transition/);
  assert.match(migration, /\('OWNER_ACTIVE', 'DEATH_REPORTED'\)/);
  assert.match(migration, /\('DEATH_REPORTED', 'PROTECTIVE_LOCK'\)/);
  assert.match(migration, /\('PROTECTIVE_LOCK', 'ESTATE_LOCKED'\)/);
  assert.match(migration, /\('DEATH_STATUS_DISPUTED', 'OWNER_RECOVERY'\)/);
  assert.match(migration, /\('OWNER_RECOVERY', 'OWNER_ACTIVE'\)/);
  assert.doesNotMatch(migration, /\('ESTATE_LOCKED', 'OWNER_ACTIVE'\)/);
  assert.match(migration, /invalid_vault_lifecycle_transition/);
  assert.match(migration, /INSERT INTO public\.estate_security_actions/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.lf_transition_vault_lifecycle\(uuid, text, uuid, text, uuid, jsonb\) FROM authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.lf_transition_vault_lifecycle[\s\S]*TO service_role/);
  assert.match(rpcRestrictionMigration, /REVOKE ALL ON FUNCTION public\.lf_transition_vault_lifecycle\(uuid, text, uuid, text, uuid, jsonb\) FROM authenticated/);
  assert.doesNotMatch(rpcRestrictionMigration, /TO authenticated/);
});

test("Death report submission requires Level 3 and does not grant access", () => {
  assert.match(service, /level_3_required_for_death_report/);
  assert.match(service, /createDeathReport/);
  assert.doesNotMatch(service, /createDeathReport[\s\S]{0,2400}activation_status: "active"/);
  assert.match(deathApi, /declarationAccepted/);
  assert.match(deathApi, /requireIdentityApiAccess/);
});

test("Estate claimant lifecycle is separate from death certificate evidence", () => {
  assert.match(service, /createEstateClaimFromReport/);
  assert.match(service, /authority_evidence_status: "required"/);
  assert.match(service, /level_2_required_for_estate_claim/);
  assert.match(service, /addEstateAdministrationDocument/);
  assert.match(service, /active_estate_claim_required_for_document/);
  assert.match(migration, /death_certificate[\s\S]*grant_of_probate[\s\S]*letters_of_administration/);
});

test("Estate administration document reads honor suspension and revocation", () => {
  const policy = migration.match(/CREATE POLICY estate_admin_documents_estate_claim_select[\s\S]*?\n  \);/)?.[0] ?? "";
  assert.match(policy, /auth\.uid\(\) = owner_user_id/);
  assert.match(policy, /claim\.status = 'active'/);
  assert.match(policy, /estate_administration_documents\.id::text/);
  assert.doesNotMatch(policy, /auth\.uid\(\) = uploaded_by_user_id/);
  assert.match(estateDocumentSuspensionMigration, /claim\.status = 'active'/);
  assert.doesNotMatch(estateDocumentSuspensionMigration, /auth\.uid\(\) = uploaded_by_user_id/);
  assert.match(estateDocumentPolicyIdMigration, /estate_administration_documents\.id::text/);
});

test("Ordinary vault and storage access remain state gated", () => {
  assert.match(migration, /lf_estate_claim_allows_storage_object/);
  assert.match(migration, /estate-administration-evidence/);
  assert.doesNotMatch(migration, /vault-docs[\s\S]*estate_access_claims[\s\S]*FOR SELECT/);
  assert.match(probate, /transitionProbateCaseToEstateLock/);
  assert.match(probate, /vault_unlock_performed: false/);
});

test("Owner recovery and emergency suspension are controlled actions", () => {
  assert.match(service, /owner_actor_required_for_recovery/);
  assert.match(service, /level_3_required_for_owner_recovery/);
  assert.match(service, /approve_owner_recovery/);
  assert.match(service, /estate_access_suspended/);
  assert.match(adminDeathApi, /verification:decide/);
  assert.match(adminDeathApi, /A reason is required for estate security actions/);
});

test("Phase 3 documentation states the security boundaries", () => {
  assert.match(docs, /Death certificate evidence does not grant access/i);
  assert.match(docs, /ordinary linked access remains OWNER_ACTIVE-only/i);
  assert.match(docs, /OWNER_RECOVERY is temporary/i);
  assert.match(docs, /Estate Administration/i);
});
