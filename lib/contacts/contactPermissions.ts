import type { SectionKey } from "../access-control/roles";

export type ContactAccessMode = "view_only" | "view_edit";

export type ContactPermissionsOverride = {
  read_only: boolean;
  allowed_sections: SectionKey[];
  asset_ids: string[];
  record_ids: string[];
  editable_asset_ids: string[];
  editable_record_ids: string[];
  owner_notes: string;
};

export function normalizeContactPermissionsOverride(value: Record<string, unknown> | null | undefined): ContactPermissionsOverride {
  const source = value && typeof value === "object" ? value : {};
  return {
    read_only: source["read_only"] !== false,
    allowed_sections: normalizeStringArray(source["allowed_sections"]) as SectionKey[],
    asset_ids: normalizeStringArray(source["asset_ids"]),
    record_ids: normalizeStringArray(source["record_ids"]),
    editable_asset_ids: normalizeStringArray(source["editable_asset_ids"]),
    editable_record_ids: normalizeStringArray(source["editable_record_ids"]),
    owner_notes: typeof source["owner_notes"] === "string" ? source["owner_notes"] : "",
  };
}

export function buildScopedPermissionPayload({
  allowedSections,
  assetIds,
  recordIds,
  editableAssetIds,
  editableRecordIds,
  ownerNotes,
}: {
  allowedSections: SectionKey[];
  assetIds: string[];
  recordIds: string[];
  editableAssetIds: string[];
  editableRecordIds: string[];
  ownerNotes: string;
}) {
  const uniqueAssetIds = uniqueStrings(assetIds);
  const uniqueRecordIds = uniqueStrings(recordIds);
  const uniqueEditableAssetIds = uniqueStrings(editableAssetIds).filter((id) => uniqueAssetIds.includes(id));
  const uniqueEditableRecordIds = uniqueStrings(editableRecordIds).filter((id) => uniqueRecordIds.includes(id));
  return {
    read_only: uniqueEditableAssetIds.length === 0 && uniqueEditableRecordIds.length === 0,
    allowed_sections: uniqueStrings(allowedSections),
    asset_ids: uniqueAssetIds,
    record_ids: uniqueRecordIds,
    editable_asset_ids: uniqueEditableAssetIds,
    editable_record_ids: uniqueEditableRecordIds,
    owner_notes: ownerNotes.trim() || null,
  };
}

export function buildPermissionItemKey(sourceKind: "asset" | "record", sourceId: string) {
  return `${sourceKind}:${sourceId}`;
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
}

function uniqueStrings<T extends string>(values: T[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))) as T[];
}
