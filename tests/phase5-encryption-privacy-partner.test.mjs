import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260822160000_phase5_privacy_encryption_partner_foundation.sql"), "utf8");
const encryption = fs.readFileSync(path.join(root, "lib/privacy-security/encryption.ts"), "utf8");
const privacy = fs.readFileSync(path.join(root, "lib/privacy-security/privacy.ts"), "utf8");
const partner = fs.readFileSync(path.join(root, "lib/privacy-security/partner.ts"), "utf8");
const docs = fs.readFileSync(path.join(root, "docs/PRIVACY_SECURITY_PHASE5.md"), "utf8");

test("Phase 5 migration creates separated privacy, encryption and partner domains", () => {
  for (const table of [
    "vault_key_envelopes",
    "vault_encrypted_payloads",
    "privacy_data_rights_cases",
    "privacy_data_exports",
    "retention_classifications",
    "legal_holds",
    "retention_items",
    "privacy_consents",
    "marketing_suppressions",
    "partner_cohort_requests",
    "partner_campaigns",
    "partner_campaign_audiences",
    "partner_aggregate_reports",
    "security_incidents",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
  }
  assert.match(migration, /privacy-data-exports/);
  assert.match(migration, /encrypted-vault-objects/);
});

test("Vault key envelopes persist wrapped material only and reject plaintext key markers", () => {
  assert.match(migration, /vault_key_envelopes_wrapped_only/);
  assert.match(migration, /wrapped_dek !~\*/);
  assert.match(migration, /recovery_wrapped_dek/);
  assert.match(encryption, /type VaultKeyManagementProvider/);
  assert.match(encryption, /InternalStagingVaultKeyProvider/);
  assert.match(encryption, /assurance = "staging_test_only"/);
  assert.match(encryption, /createCipheriv\("aes-256-gcm"/);
  assert.match(encryption, /randomBytes\(12\)/);
  assert.match(encryption, /setAuthTag/);
  assert.match(encryption, /plaintextDek\.fill\(0\)/);
  assert.match(encryption, /client_key_material_returned: false/);
  assert.doesNotMatch(encryption, /plaintext_key_returned_to_client/);
  assert.doesNotMatch(encryption, /process\.env\.[A-Z_]*(MASTER|DEK|KEK|KEY)/);
});

test("Structured encryption records nonce, tag, key version and authenticated context", () => {
  assert.match(migration, /vault_encrypted_payloads/);
  assert.match(migration, /nonce text NOT NULL/);
  assert.match(migration, /auth_tag text NOT NULL/);
  assert.match(migration, /key_envelope_id uuid NOT NULL/);
  assert.match(encryption, /aadContext/);
  assert.match(encryption, /canonicalJson/);
  assert.match(encryption, /decryptWithDek/);
});

test("Privacy data-rights workflow keeps cases, exports, legal holds and retention separate", () => {
  assert.match(privacy, /createPrivacyDataRightsCase/);
  assert.match(privacy, /createPrivacyExport/);
  assert.match(privacy, /createLegalHold/);
  assert.match(privacy, /createRetentionItem/);
  assert.match(privacy, /evaluateRetentionItem/);
  assert.match(migration, /retention_classifications/);
  assert.match(migration, /lf_retention_item_effective_state/);
  assert.match(migration, /lf_recovery_access_quorum_met/);
  assert.match(migration, /recovery_access_no_self_approval/);
  assert.match(privacy, /privacy_export_manifest_contains_internal_secret/);
});

test("Marketing objection is durable suppression and consent history is append-based", () => {
  assert.match(privacy, /recordMarketingObjection/);
  assert.match(privacy, /marketing_suppressions/);
  assert.match(privacy, /privacy_consents/);
  assert.match(migration, /suppression_survives_erasure/);
  assert.match(migration, /global_objection/);
  assert.match(migration, /partner_opt_out/);
  assert.doesNotMatch(privacy, /from\("marketing_suppressions"\)\.delete/);
});

test("Partner cohort model is closed-loop, aggregate-only and rejects vault-sensitive filters", () => {
  assert.match(partner, /ALLOWED_COHORT_FILTERS/);
  assert.match(partner, /PROHIBITED_COHORT_FILTER_PATTERN/);
  assert.match(partner, /asset_value/);
  assert.match(partner, /opaqueSubjectRef/);
  assert.match(migration, /partner_campaigns_aggregate_boundary/);
  assert.match(migration, /raw_audience_export_allowed boolean NOT NULL DEFAULT false/);
  assert.match(migration, /partner_campaign_audiences_opaque_check/);
  assert.match(migration, /lf_partner_campaign_user_marketing_eligible/);
});

test("Phase 5 API surfaces avoid exposing key material and raw audience lists", () => {
  const encryptionRoute = fs.readFileSync(path.join(root, "app/api/privacy/encryption/route.ts"), "utf8");
  const exportRoute = fs.readFileSync(path.join(root, "app/api/privacy/exports/route.ts"), "utf8");
  const exportDownloadRoute = fs.readFileSync(path.join(root, "app/api/privacy/exports/[exportId]/route.ts"), "utf8");
  const partnerRoute = fs.readFileSync(path.join(root, "app/api/internal/admin/partner-campaigns/route.ts"), "utf8");
  const privacyRoute = fs.readFileSync(path.join(root, "app/api/privacy/data-rights/route.ts"), "utf8");
  assert.match(encryptionRoute, /keyMaterialReturned: false/);
  assert.doesNotMatch(encryptionRoute, /wrapped_dek|recovery_wrapped_dek|plaintextDek/);
  assert.match(exportRoute, /key_material/);
  assert.doesNotMatch(exportRoute, /service_role|raw_keys/);
  assert.match(privacy, /storage[\s\S]*\.upload\(/);
  assert.match(exportDownloadRoute, /createSignedUrl/);
  assert.match(exportDownloadRoute, /subject_user_id !== access\.user\.id/);
  assert.match(partnerRoute, /Raw audience-list APIs are disabled/);
  assert.match(partnerRoute, /rawAudienceListReturned: false/);
  assert.match(privacyRoute, /requesterUserId: access\.user\.id/);
});

test("Admin capabilities include privacy and partner controls without blanket support access", () => {
  const capabilities = fs.readFileSync(path.join(root, "lib/admin/capabilities.ts"), "utf8");
  const access = fs.readFileSync(path.join(root, "lib/admin/access.ts"), "utf8");
  assert.match(capabilities, /"privacy\.case\.review"/);
  assert.match(capabilities, /"privacy\.retention\.manage"/);
  assert.match(capabilities, /"partner\.campaign\.manage"/);
  assert.match(capabilities, /"partner\.cohort\.evaluate"/);
  const organisationAdminBlock = access.match(/organisation_admin: \[([\s\S]*?)\n  \]/)?.[1] ?? "";
  assert.match(organisationAdminBlock, /"partner\.campaign\.manage"/);
  assert.match(organisationAdminBlock, /"partner\.cohort\.evaluate"/);
  const supportBlock = capabilities.match(/support_agent: \[([\s\S]*?)\n  \]/)?.[1] ?? "";
  assert.doesNotMatch(supportBlock, /privacy\.retention\.manage|partner\.campaign\.manage|estate_recovery_execute/);
});

test("Documentation avoids unsafe cryptographic and compliance claims", () => {
  assert.match(docs, /pseudonymous/i);
  assert.match(docs, /not anonymous/i);
  assert.match(docs, /Production KMS\/HSM requirement/i);
  assert.match(docs, /no routine staff access/i);
  assert.match(docs, /exceptional recovery/i);
  assert.doesNotMatch(docs, /never access your data/i);
  assert.doesNotMatch(docs, /\b(is|are)\s+fully GDPR compliant/i);
});
