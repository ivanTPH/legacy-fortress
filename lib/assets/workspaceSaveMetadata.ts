export function mergeWorkspaceSaveMetadata({
  baseMetadata,
  financeMetadata,
  canonicalMetadata,
  usesCanonicalAssets,
}: {
  baseMetadata: Record<string, unknown>;
  financeMetadata: Record<string, unknown>;
  canonicalMetadata: Record<string, unknown> | null | undefined;
  usesCanonicalAssets: boolean;
}) {
  return {
    ...baseMetadata,
    ...(usesCanonicalAssets ? (canonicalMetadata ?? {}) : financeMetadata),
  };
}
