export type LinkedDocumentContextLike = {
  source_kind?: string | null;
  source_id?: string | null;
};

export type LinkedDocumentSourceItem = {
  id: string;
  sourceKind: "asset" | "record";
  sourceId: string;
  fileName: string;
  mimeType: string;
  storageBucket: string;
  storagePath: string;
  createdAt: string;
};

export function buildLinkedDocumentLookupKey(context: LinkedDocumentContextLike) {
  const sourceKind = String(context.source_kind ?? "").trim().toLowerCase();
  const sourceId = String(context.source_id ?? "").trim();
  if (!sourceId) return "";
  if (sourceKind !== "asset" && sourceKind !== "record") return "";
  return `${sourceKind}:${sourceId}`;
}

export function groupLinkedDocumentSources(items: LinkedDocumentSourceItem[]) {
  const grouped = new Map<string, LinkedDocumentSourceItem[]>();
  for (const item of items) {
    const key = buildLinkedDocumentLookupKey({
      source_kind: item.sourceKind,
      source_id: item.sourceId,
    });
    if (!key) continue;
    const bucket = grouped.get(key) ?? [];
    bucket.push(item);
    grouped.set(key, bucket);
  }

  for (const [key, value] of grouped.entries()) {
    grouped.set(
      key,
      [...value].sort((left, right) => String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? ""))),
    );
  }

  return grouped;
}

export function resolveLinkedPreviewTargets(
  context: LinkedDocumentContextLike,
  grouped: Map<string, LinkedDocumentSourceItem[]>,
) {
  const key = buildLinkedDocumentLookupKey(context);
  if (!key) return [];
  return grouped.get(key) ?? [];
}
