import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLinkedDocumentLookupKey,
  groupLinkedDocumentSources,
  resolveLinkedPreviewTargets,
} from "../lib/contacts/linkedDocumentPreview.ts";

test("linked document preview only resolves for previewable asset or record targets", () => {
  const grouped = groupLinkedDocumentSources([
    {
      id: "doc-2",
      sourceKind: "asset",
      sourceId: "asset-1",
      fileName: "older.pdf",
      mimeType: "application/pdf",
      storageBucket: "vault-docs",
      storagePath: "users/1/assets/asset-1/documents/older.pdf",
      createdAt: "2026-03-30T08:00:00.000Z",
    },
    {
      id: "doc-1",
      sourceKind: "asset",
      sourceId: "asset-1",
      fileName: "latest.pdf",
      mimeType: "application/pdf",
      storageBucket: "vault-docs",
      storagePath: "users/1/assets/asset-1/documents/latest.pdf",
      createdAt: "2026-03-31T08:00:00.000Z",
    },
    {
      id: "att-1",
      sourceKind: "record",
      sourceId: "record-1",
      fileName: "evidence.jpg",
      mimeType: "image/jpeg",
      storageBucket: "vault-docs",
      storagePath: "users/1/records/record-1/evidence.jpg",
      createdAt: "2026-03-31T09:00:00.000Z",
    },
  ]);

  assert.equal(buildLinkedDocumentLookupKey({ source_kind: "asset", source_id: "asset-1" }), "asset:asset-1");
  assert.equal(buildLinkedDocumentLookupKey({ source_kind: "invitation", source_id: "invite-1" }), "");

  const assetTargets = resolveLinkedPreviewTargets({ source_kind: "asset", source_id: "asset-1" }, grouped);
  assert.equal(assetTargets.length, 2);
  assert.equal(assetTargets[0].fileName, "latest.pdf");

  const recordTargets = resolveLinkedPreviewTargets({ source_kind: "record", source_id: "record-1" }, grouped);
  assert.equal(recordTargets.length, 1);
  assert.equal(recordTargets[0].fileName, "evidence.jpg");

  const unresolvedTargets = resolveLinkedPreviewTargets({ source_kind: "invitation", source_id: "invite-1" }, grouped);
  assert.equal(unresolvedTargets.length, 0);
});
