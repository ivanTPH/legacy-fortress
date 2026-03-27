export type SavedContactIdentityReference = {
  sourceId: string;
  contactId: string | null;
  createdAt?: string | null;
};

export function resolveLatestSavedContactIdentityReference<T extends SavedContactIdentityReference>(
  rows: T[],
  sourceId: string,
): T | null {
  const normalizedSourceId = String(sourceId ?? "").trim();
  if (!normalizedSourceId) return null;

  const matches = rows.filter((row) => String(row.sourceId ?? "").trim() === normalizedSourceId);
  if (matches.length === 0) return null;

  return [...matches].sort((left, right) => {
    const leftStamp = Date.parse(String(left.createdAt ?? ""));
    const rightStamp = Date.parse(String(right.createdAt ?? ""));
    return rightStamp - leftStamp;
  })[0] ?? null;
}

export function resolveSavedCanonicalContactIdForSource(
  rows: SavedContactIdentityReference[],
  sourceId: string,
) {
  const reference = resolveLatestSavedContactIdentityReference(rows, sourceId);
  const contactId = String(reference?.contactId ?? "").trim();
  return contactId || null;
}
