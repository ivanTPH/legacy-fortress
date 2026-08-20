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
      explicit_permissions: ["view", "contribute_document"],
      owner_notes: "Important",
    }),
    {
      read_only: false,
      allowed_sections: ["financial"],
      asset_ids: ["asset-1"],
      record_ids: ["record-1"],
      editable_asset_ids: ["asset-1"],
      editable_record_ids: ["record-1"],
      explicit_permissions: ["view", "contribute_document"],
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
      assignedRole: "professional_advisor",
      allowDocumentContribution: true,
    }),
    {
      read_only: true,
      allowed_sections: ["financial"],
      asset_ids: ["asset-1"],
      record_ids: ["record-1"],
      editable_asset_ids: [],
      editable_record_ids: [],
      explicit_permissions: ["view", "view_summary", "view_detail", "download", "contribute_document"],
      owner_notes: "Review only",
    },
  );
});

test("contact permissions do not grant document contribution to non-adviser roles", () => {
  assert.deepEqual(
    buildScopedPermissionPayload({
      allowedSections: ["legal"],
      assetIds: ["asset-1"],
      recordIds: [],
      editableAssetIds: ["asset-1"],
      editableRecordIds: [],
      ownerNotes: "",
      assignedRole: "executor",
      allowDocumentContribution: true,
    }),
    {
      read_only: true,
      allowed_sections: ["legal"],
      asset_ids: ["asset-1"],
      record_ids: [],
      editable_asset_ids: [],
      editable_record_ids: [],
      explicit_permissions: ["view", "view_summary", "view_detail", "download"],
      owner_notes: null,
    },
  );
});
