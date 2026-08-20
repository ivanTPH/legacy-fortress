import type { SectionKey } from "../access-control/roles";
import type { ExplicitAccessPermission } from "../access-control/securityPolicy.ts";
import { roleCanReceiveDocumentContribution } from "../access-control/securityPolicy.ts";

export type ContactAccessMode = "view_only" | "view_edit";

export type ContactPermissionsOverride = {
  read_only: boolean;
  allowed_sections: SectionKey[];
  asset_ids: string[];
  record_ids: string[];
  editable_asset_ids: string[];
  editable_record_ids: string[];
  explicit_permissions: ExplicitAccessPermission[];
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
    explicit_permissions: normalizeExplicitPermissions(source["explicit_permissions"] ?? source["permissions"]),
    owner_notes: typeof source["owner_notes"] === "string" ? source["owner_notes"] : "",
  };
}

export function buildScopedPermissionPayload({
  allowedSections,
  assetIds,
  recordIds,
  ownerNotes,
  assignedRole,
  allowDocumentContribution = false,
}: {
  allowedSections: SectionKey[];
  assetIds: string[];
  recordIds: string[];
  editableAssetIds: string[];
  editableRecordIds: string[];
  ownerNotes: string;
  assignedRole?: string | null;
  allowDocumentContribution?: boolean;
}) {
  const uniqueAssetIds = uniqueStrings(assetIds);
  const uniqueRecordIds = uniqueStrings(recordIds);
  const explicitPermissions: ExplicitAccessPermission[] = ["view", "view_summary"];
  if (uniqueAssetIds.length > 0 || uniqueRecordIds.length > 0) {
    explicitPermissions.push("view_detail", "download");
  }
  if (allowDocumentContribution && roleCanReceiveDocumentContribution(assignedRole)) {
    explicitPermissions.push("contribute_document");
  }
  return {
    read_only: true,
    allowed_sections: uniqueStrings(allowedSections),
    asset_ids: uniqueAssetIds,
    record_ids: uniqueRecordIds,
    editable_asset_ids: [],
    editable_record_ids: [],
    explicit_permissions: Array.from(new Set(explicitPermissions)),
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

function normalizeExplicitPermissions(value: unknown): ExplicitAccessPermission[] {
  const allowed = new Set<ExplicitAccessPermission>([
    "view",
    "view_summary",
    "view_detail",
    "download",
    "contribute_document",
    "manage_access",
    "high_risk_access_change",
  ]);
  return normalizeStringArray(value).filter((item): item is ExplicitAccessPermission => allowed.has(item as ExplicitAccessPermission));
}
