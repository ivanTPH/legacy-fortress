const ASSET_PGCRYPTO_REPAIR_MIGRATION = "supabase/migrations/20260321123000_fix_asset_payload_pgcrypto_schema_qualification.sql";

export function normalizeSensitivePayloadPersistenceError(message: string) {
  const normalized = message.trim();

  if (
    normalized.includes("pgp_sym_encrypt(text, text) does not exist")
    || normalized.includes("function extensions.pgp_sym_encrypt")
    || normalized.includes("function pgp_sym_decrypt(bytea, text) does not exist")
  ) {
    return `Sensitive field encryption is unavailable in the active database. Apply ${ASSET_PGCRYPTO_REPAIR_MIGRATION} to the active project.`;
  }

  if (
    normalized.includes("asset_payload_encryption_key")
    || normalized.includes("Sensitive field encryption is not configured")
  ) {
    return "Sensitive field encryption is not configured.";
  }

  return normalized;
}
