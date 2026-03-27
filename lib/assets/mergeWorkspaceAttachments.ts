export type WorkspaceAttachmentLike = {
  id: string;
};

export function mergeWorkspaceAttachments<T extends WorkspaceAttachmentLike>({
  documents,
  legacyAttachments,
}: {
  documents: T[];
  legacyAttachments: T[];
}): T[] {
  const merged: T[] = [];
  const seenIds = new Set<string>();

  for (const item of documents) {
    merged.push(item);
    if (item.id) seenIds.add(item.id);
  }

  for (const item of legacyAttachments) {
    if (item.id && seenIds.has(item.id)) continue;
    merged.push(item);
    if (item.id) seenIds.add(item.id);
  }

  return merged;
}
