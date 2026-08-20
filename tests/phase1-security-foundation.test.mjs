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

test("Phase 1 migration persists canonical identity assurance and vault lifecycle states", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.identity_assurance_states/);
  assert.match(migration, /identity_level integer NOT NULL DEFAULT 1/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS vault_lifecycle_state text NOT NULL DEFAULT 'OWNER_ACTIVE'/);
  assert.match(migration, /'DEATH_REPORTED'[\s\S]*'PROTECTIVE_LOCK'[\s\S]*'ESTATE_LOCKED'[\s\S]*'DEATH_STATUS_DISPUTED'[\s\S]*'OWNER_RECOVERY'/);
});

test("Phase 1 migration blocks accepted-but-unverified direct RLS and storage access", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.lf_linked_grant_satisfies_identity/);
  assert.match(migration, /p_grant\.activation_status = ANY\(ARRAY\['verified','active'\]\)/);
  assert.match(migration, /public\.lf_identity_assurance_level\(p_grant\.linked_user_id\) >= COALESCE\(p_grant\.required_identity_level, 2\)/);
  assert.doesNotMatch(migration, /activation_status = ANY\(ARRAY\['accepted','verified','active'\]\)/);
  assert.match(migration, /CREATE POLICY vault_docs_linked_select ON storage\.objects/);
  assert.match(migration, /public\.linked_grant_allows_storage_object\(bucket_id, name\)/);
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
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.lf_vault_allows_owner_mutation/);
  assert.match(migration, /IN \('OWNER_ACTIVE', 'OWNER_RECOVERY'\)/);
  assert.match(migration, /CREATE POLICY assets_owner_update[\s\S]*public\.lf_vault_allows_owner_mutation\(owner_user_id\)/);
  assert.match(migration, /CREATE POLICY documents_owner_delete[\s\S]*public\.lf_vault_allows_owner_mutation\(owner_user_id\)/);
  assert.match(migration, /CREATE POLICY vault_docs_owner_delete[\s\S]*public\.lf_vault_allows_owner_mutation\(auth\.uid\(\)\)/);
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
