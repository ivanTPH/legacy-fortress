import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260820120000_phase1_verified_access_policy_foundation.sql"),
  "utf8",
);
const viewerAccess = fs.readFileSync(path.join(root, "lib/access-control/viewerAccess.ts"), "utf8");
const roles = fs.readFileSync(path.join(root, "lib/access-control/roles.ts"), "utf8");
const documentsWorkspace = fs.readFileSync(path.join(root, "components/documents/DocumentsWorkspace.tsx"), "utf8");
const recordsWorkspace = fs.readFileSync(path.join(root, "components/records/UniversalRecordWorkspace.tsx"), "utf8");
const sectionsWorkspace = fs.readFileSync(path.join(root, "components/sections/SectionWorkspace.tsx"), "utf8");

function functionBody(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return migration.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${escaped}[\\s\\S]*?\\n\\$\\$;`))?.[0] ?? "";
}

test("Phase 1 migration persists canonical identity assurance and vault lifecycle states", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.identity_assurance_states/);
  assert.match(migration, /identity_level integer NOT NULL DEFAULT 1/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS vault_lifecycle_state text NOT NULL DEFAULT 'OWNER_ACTIVE'/);
  assert.match(migration, /'DEATH_REPORTED'[\s\S]*'PROTECTIVE_LOCK'[\s\S]*'ESTATE_LOCKED'[\s\S]*'DEATH_STATUS_DISPUTED'[\s\S]*'OWNER_RECOVERY'/);
});

test("Phase 1 migration blocks accepted-but-unverified direct RLS and storage access", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.lf_linked_grant_satisfies_identity/);
  assert.match(migration, /p_grant\.linked_user_id = auth\.uid\(\)/);
  assert.match(migration, /p_grant\.activation_status = ANY\(ARRAY\['verified','active'\]\)/);
  assert.match(migration, /public\.lf_identity_assurance_level\(p_grant\.linked_user_id\) >= COALESCE\(p_grant\.required_identity_level, 2\)/);
  assert.doesNotMatch(migration, /activation_status = ANY\(ARRAY\['accepted','verified','active'\]\)/);
  assert.match(migration, /CREATE POLICY vault_docs_linked_select ON storage\.objects/);
  assert.match(migration, /public\.linked_grant_allows_storage_object\(bucket_id, name\)/);
});

test("Phase 1 ordinary linked access requires the live owner vault state to be OWNER_ACTIVE", () => {
  const predicate = functionBody("lf_linked_grant_satisfies_identity");
  assert.match(predicate, /p_grant\.linked_user_id = auth\.uid\(\)/);
  assert.match(predicate, /p_grant\.activation_status = ANY\(ARRAY\['verified','active'\]\)/);
  assert.match(predicate, /public\.lf_identity_assurance_level\(p_grant\.linked_user_id\) >= COALESCE\(p_grant\.required_identity_level, 2\)/);
  assert.match(predicate, /public\.lf_vault_lifecycle_state\(p_grant\.owner_user_id\) = 'OWNER_ACTIVE'/);
  assert.doesNotMatch(predicate, /p_grant\.vault_lifecycle_state/);

  for (const deniedState of [
    "DEATH_REPORTED",
    "PROTECTIVE_LOCK",
    "ESTATE_LOCKED",
    "DEATH_STATUS_DISPUTED",
    "OWNER_RECOVERY",
  ]) {
    assert.doesNotMatch(predicate, new RegExp(`= '${deniedState}'|IN \\([^)]+${deniedState}`));
  }
});

test("Phase 1 ordinary linked read paths inherit the canonical live vault-state predicate", () => {
  for (const helper of [
    "has_linked_account_access",
    "linked_grant_allows_asset",
    "linked_grant_allows_record",
    "linked_grant_allows_section_entry",
  ]) {
    assert.match(functionBody(helper), /public\.lf_linked_grant_satisfies_identity\(g\)/, `${helper} must use the canonical linked predicate`);
  }

  assert.match(functionBody("linked_grant_allows_document"), /public\.linked_grant_allows_asset\(p_owner_user_id, p_asset_id\)/);
  assert.match(functionBody("linked_grant_allows_storage_object"), /public\.linked_grant_allows_document\(d\.owner_user_id, d\.id, d\.asset_id, d\.storage_bucket, d\.storage_path\)/);
  assert.match(functionBody("linked_grant_allows_storage_object"), /public\.linked_grant_allows_record\(a\.owner_user_id, a\.record_id\)/);
  assert.match(migration, /CREATE POLICY organisations_linked_select[\s\S]*public\.linked_grant_allows_asset/);
  assert.match(migration, /CREATE POLICY wallets_linked_select[\s\S]*public\.linked_grant_allows_asset/);
  assert.match(migration, /CREATE POLICY contacts_linked_select[\s\S]*public\.lf_linked_grant_satisfies_identity\(g\)/);
  assert.match(migration, /CREATE POLICY contact_links_linked_select[\s\S]*public\.lf_linked_grant_satisfies_identity\(g\)/);
  assert.match(migration, /CREATE POLICY section_entries_linked_select[\s\S]*public\.linked_grant_allows_section_entry/);
  assert.match(migration, /CREATE POLICY user_profiles_linked_select[\s\S]*public\.has_linked_account_access/);
});

test("Phase 1 linked scope remains resource-specific after vault-state approval", () => {
  assert.match(functionBody("linked_grant_allows_asset"), /permissions_override -> 'asset_ids'[\s\S]*p_asset_id::text/);
  assert.match(functionBody("linked_grant_allows_asset"), /contact_links cl[\s\S]*cl\.source_kind = 'asset'[\s\S]*cl\.source_id = p_asset_id/);
  assert.match(functionBody("linked_grant_allows_record"), /permissions_override -> 'record_ids'[\s\S]*p_record_id::text/);
  assert.match(functionBody("linked_grant_allows_record"), /record_contacts rc[\s\S]*rc\.record_id = p_record_id/);
  assert.match(functionBody("linked_grant_allows_section_entry"), /permissions_override -> 'section_entry_ids'[\s\S]*p_entry_id::text/);
});

test("Phase 1 probate evidence access is separate from ordinary OWNER_ACTIVE linked access", () => {
  const probatePredicate = functionBody("lf_probate_evidence_grant_satisfies_identity");
  assert.match(probatePredicate, /p_grant\.linked_user_id = auth\.uid\(\)/);
  assert.match(probatePredicate, /p_grant\.activation_status = ANY\(ARRAY\['verified','active'\]\)/);
  assert.match(probatePredicate, /public\.lf_identity_assurance_level\(p_grant\.linked_user_id\) >= COALESCE\(p_grant\.required_identity_level, 2\)/);
  assert.doesNotMatch(probatePredicate, /lf_vault_lifecycle_state/);

  const documentHelper = functionBody("linked_grant_allows_document");
  const storageHelper = functionBody("linked_grant_allows_storage_object");
  assert.match(documentHelper, /probate_case\.status = 'approved'[\s\S]*public\.lf_probate_evidence_grant_satisfies_identity\(g\)/);
  assert.match(storageHelper, /probate_case\.status = 'approved'[\s\S]*public\.lf_probate_evidence_grant_satisfies_identity\(g\)/);
  assert.doesNotMatch(documentHelper, /probate_case\.status = 'approved'[\s\S]*public\.lf_linked_grant_satisfies_identity\(g\)/);
  assert.doesNotMatch(storageHelper, /probate_case\.status = 'approved'[\s\S]*public\.lf_linked_grant_satisfies_identity\(g\)/);
});

test("Phase 1 migration makes invitation tokens expiring and single-use", () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS expires_at timestamptz/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS token_consumed_at timestamptz/);
  assert.match(migration, /ci\.token_consumed_at IS NULL/);
  assert.match(migration, /ci\.invitation_status IN \('pending', 'sent'\)/);
  assert.match(migration, /v_invitation\.token_consumed_at IS NOT NULL OR v_invitation\.invitation_status NOT IN \('pending', 'sent'\)/);
  assert.match(migration, /token_consumed_at = timezone\('utc', now\(\)\)/);
});

test("Phase 1 migration enforces independent vault-state mutation gates", () => {
  const mutationPredicate = functionBody("lf_vault_allows_owner_mutation");
  assert.match(mutationPredicate, /IN \('OWNER_ACTIVE', 'OWNER_RECOVERY'\)/);
  assert.doesNotMatch(mutationPredicate, /'PROTECTIVE_LOCK'/);
  assert.doesNotMatch(mutationPredicate, /'ESTATE_LOCKED'/);
  assert.match(migration, /CREATE POLICY assets_owner_update[\s\S]*public\.lf_vault_allows_owner_mutation\(owner_user_id\)/);
  assert.match(migration, /CREATE POLICY documents_owner_delete[\s\S]*public\.lf_vault_allows_owner_mutation\(owner_user_id\)/);
  assert.match(migration, /CREATE POLICY vault_docs_owner_delete[\s\S]*public\.lf_vault_allows_owner_mutation\(auth\.uid\(\)\)/);
});

test("Phase 1 SECURITY DEFINER grants keep ordinary linked helpers authenticated-only", () => {
  for (const signature of [
    "public.lf_linked_grant_satisfies_identity(public.account_access_grants)",
    "public.has_linked_account_access(uuid, text[])",
    "public.linked_grant_allows_asset(uuid, uuid)",
    "public.linked_grant_allows_record(uuid, uuid)",
    "public.linked_grant_allows_section_entry(uuid, uuid, text)",
    "public.linked_grant_allows_document(uuid, uuid, uuid, text, text)",
    "public.linked_grant_allows_storage_object(text, text)",
    "public.can_read_linked_vault_object(text)",
  ]) {
    assert.match(migration, new RegExp(`GRANT EXECUTE ON FUNCTION ${signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} TO authenticated;`));
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION ${signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} FROM anon;`));
    assert.doesNotMatch(migration, new RegExp(`GRANT EXECUTE ON FUNCTION ${signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} TO authenticated, anon;`));
  }

  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.get_public_contact_invitation\(uuid, text\) TO authenticated, anon;/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.accept_contact_invitation\(uuid, text\) TO authenticated;/);
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.accept_contact_invitation\(uuid, text\) TO authenticated, anon;/);
});

test("application policy does not treat accepted grants as protected linked access", () => {
  assert.match(viewerAccess, /ACTIVE_PROTECTED_GRANT_STATUSES/);
  assert.match(viewerAccess, /includePreVerificationGrants/);
  assert.match(viewerAccess, /pathname\.startsWith\("\/contact-wallet"\)/);
  assert.match(viewerAccess, /!isProtectedGrantActive\(viewer\.activationStatus\)\) return false/);
  assert.match(roles, /role !== "owner"[\s\S]*\["view_detail", "download", "contribute_document", "manage_access", "high_risk_access_change"\]/);
});

test("third-party document overwrite and delete paths are blocked in UI handlers", () => {
  assert.match(documentsWorkspace, /Linked users cannot remove owner documents/);
  assert.match(documentsWorkspace, /Linked users cannot replace owner documents/);
  assert.match(documentsWorkspace, /canContributeDocumentForViewer/);
  assert.match(recordsWorkspace, /Linked users cannot remove owner attachments/);
  assert.match(recordsWorkspace, /Linked users cannot replace owner attachments/);
  assert.match(sectionsWorkspace, /Linked users cannot remove owner attachments/);
  assert.match(sectionsWorkspace, /Linked users cannot replace owner attachments/);
});
