import test from "node:test";
import assert from "node:assert/strict";

import {
  buildScopedPermissionPayload,
  normalizeContactPermissionsOverride,
} from "../lib/contacts/contactPermissions.ts";

test("contact permissions normalize edit-scoped ids", () => {
  assert.deepEqual(
    normalizeContactPermissionsOverride({
      read_only: false,
      allowed_sections: ["financial"],
      asset_ids: ["asset-1"],
      record_ids: ["record-1"],
      editable_asset_ids: ["asset-1"],
      editable_record_ids: ["record-1"],
      owner_notes: "Important",
    }),
    {
      read_only: false,
      allowed_sections: ["financial"],
      asset_ids: ["asset-1"],
      record_ids: ["record-1"],
      editable_asset_ids: ["asset-1"],
      editable_record_ids: ["record-1"],
      owner_notes: "Important",
    },
  );
});

test("contact permissions payload keeps edit ids within assigned scope", () => {
  assert.deepEqual(
    buildScopedPermissionPayload({
      allowedSections: ["financial"],
      assetIds: ["asset-1"],
      recordIds: ["record-1"],
      editableAssetIds: ["asset-1", "asset-2"],
      editableRecordIds: ["record-1"],
      ownerNotes: "  Review only  ",
    }),
    {
      read_only: false,
      allowed_sections: ["financial"],
      asset_ids: ["asset-1"],
      record_ids: ["record-1"],
      editable_asset_ids: ["asset-1"],
      editable_record_ids: ["record-1"],
      owner_notes: "Review only",
    },
  );
});
