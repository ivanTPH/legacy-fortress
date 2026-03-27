import test from "node:test";
import assert from "node:assert/strict";
import { mergeWorkspaceAttachments } from "../lib/assets/mergeWorkspaceAttachments.ts";

test("mergeWorkspaceAttachments prefers canonical documents when the legacy backfill preserves the same id", () => {
  const merged = mergeWorkspaceAttachments({
    documents: [{ id: "attachment-1", source_table: "documents", file_name: "will.pdf" }],
    legacyAttachments: [{ id: "attachment-1", source_table: "attachments", file_name: "will.pdf" }],
  });

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.source_table, "documents");
  assert.equal(merged.filter((item) => item.id === "attachment-1").length, 1);
});

test("mergeWorkspaceAttachments preserves distinct rows when ids differ", () => {
  const merged = mergeWorkspaceAttachments({
    documents: [{ id: "document-1", source_table: "documents", storage_path: "vault-docs/documents/shared.pdf" }],
    legacyAttachments: [{ id: "legacy-1", source_table: "attachments", storage_path: "vault-docs/documents/shared.pdf" }],
  });

  assert.equal(merged.length, 2);
  assert.deepEqual(
    merged.map((item) => item.id),
    ["document-1", "legacy-1"],
  );
});
