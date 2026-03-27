export type SensitivePayloadHydrationResult = {
  payloads: Map<string, Record<string, unknown>>;
  decryptSupportAvailable: boolean;
  fallbackMode: boolean;
  warning: string | null;
  skippedFields: string[];
  hydratedAssetCount: number;
};

export function isSensitivePayloadHydrationCapabilityError(message: string | null | undefined) {
  const normalized = String(message ?? "").toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes("pgp_sym_decrypt") ||
    normalized.includes("get_assets_sensitive_payloads") ||
    normalized.includes("asset_encrypted_payloads") ||
    normalized.includes("schema cache") ||
    normalized.includes("does not exist")
  );
}

export function buildSensitivePayloadFallbackResult(skippedFields: readonly string[]): SensitivePayloadHydrationResult {
  return {
    payloads: new Map(),
    decryptSupportAvailable: false,
    fallbackMode: true,
    warning: "Encrypted fields are unavailable for this environment, so only non-sensitive record details are being shown.",
    skippedFields: [...skippedFields],
    hydratedAssetCount: 0,
  };
}

export function buildSensitivePayloadSuccessResult(
  payloads: Map<string, Record<string, unknown>>,
): SensitivePayloadHydrationResult {
  return {
    payloads,
    decryptSupportAvailable: true,
    fallbackMode: false,
    warning: null,
    skippedFields: [],
    hydratedAssetCount: payloads.size,
  };
}
