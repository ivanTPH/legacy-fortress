export type DashboardAssetRow = {
  id: string;
  section_key?: string | null;
  category_key?: string | null;
  status?: "active" | "archived" | null;
  archived_at?: string | null;
  deleted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DashboardDocumentRow = {
  id: string;
  asset_id?: string | null;
  wallet_id?: string | null;
  category_key?: string | null;
  document_type?: string | null;
  file_name?: string | null;
  document_kind?: string | null;
  created_at?: string | null;
};

export type DashboardAssetBucket = "finance" | "property" | "business" | "digital" | "tasks" | "other";
export type DashboardSummaryItem = {
  id: string;
  label: string;
  href: string;
  meta?: string;
};
export type DashboardBucketSummary = {
  addedAt: string | null;
  valueText: string;
  detailText: string;
  items: DashboardSummaryItem[];
};
export type DashboardRecentActivityItem = {
  id: string;
  kind: "asset" | "document";
  title: string;
  description: string;
  href: string;
  timestamp: string | null;
  icon: string;
};

const FINANCE_CATEGORY_KEYS = new Set(["bank", "investments", "insurance", "pensions", "debts", "loans-liabilities"]);
const PROPERTY_CATEGORY_KEYS = new Set(["property", "properties"]);
const BUSINESS_CATEGORY_KEYS = new Set(["business-interests", "business", "businesses"]);
const DIGITAL_CATEGORY_KEYS = new Set(["digital-assets", "digital", "digital-accounts"]);
const TASK_CATEGORY_KEYS = new Set(["tasks", "task", "action-tracking", "actions"]);

export function getLiveAssets<T extends DashboardAssetRow>(rows: T[]) {
  return rows.filter((row) => row.status !== "archived" && !row.archived_at && !row.deleted_at);
}

export function getDashboardAssetBucket(row: Pick<DashboardAssetRow, "section_key" | "category_key">): DashboardAssetBucket {
  const sectionKey = normalizeCategoryToken(String(row.section_key ?? ""));
  const categoryKey = normalizeCategoryToken(String(row.category_key ?? ""));

  if (sectionKey === "finances" || FINANCE_CATEGORY_KEYS.has(categoryKey)) return "finance";
  if (sectionKey === "property" || PROPERTY_CATEGORY_KEYS.has(categoryKey)) return "property";
  if (sectionKey === "business" || BUSINESS_CATEGORY_KEYS.has(categoryKey)) return "business";
  if (sectionKey === "digital" || DIGITAL_CATEGORY_KEYS.has(categoryKey)) return "digital";
  if (sectionKey === "personal" && TASK_CATEGORY_KEYS.has(categoryKey)) return "tasks";
  return "other";
}

export function getAssetsForBucket<T extends DashboardAssetRow>(rows: T[], bucket: DashboardAssetBucket) {
  return getLiveAssets(rows).filter((row) => getDashboardAssetBucket(row) === bucket);
}

export function countAssetsByBucket(rows: DashboardAssetRow[]) {
  const counts: Record<DashboardAssetBucket, number> = {
    finance: 0,
    property: 0,
    business: 0,
    digital: 0,
    tasks: 0,
    other: 0,
  };

  for (const row of getLiveAssets(rows)) {
    counts[getDashboardAssetBucket(row)] += 1;
  }

  return counts;
}

export function countCanonicalDocuments(rows: DashboardDocumentRow[]) {
  return rows.filter((row) => Boolean(String(row.asset_id ?? "").trim())).length;
}

export function getDocumentsForAssetBucket<T extends DashboardDocumentRow>(
  rows: T[],
  assets: DashboardAssetRow[],
  bucket: DashboardAssetBucket,
) {
  const assetIds = new Set(getAssetsForBucket(assets, bucket).map((row) => row.id));
  return rows.filter((row) => assetIds.has(String(row.asset_id ?? "")));
}

export function buildBucketSummary<T extends DashboardAssetRow>(
  rows: T[],
  {
    createdId,
    emptyValueText = "No records yet",
    emptyDetailText = "No records yet",
    detailLabel,
    itemLimit = 3,
    itemBuilder,
    valueTextBuilder,
  }: {
    createdId: string;
    emptyValueText?: string;
    emptyDetailText?: string;
    detailLabel: string;
    itemLimit?: number;
    itemBuilder: (row: T) => DashboardSummaryItem;
    valueTextBuilder?: (rows: T[]) => string;
  },
): DashboardBucketSummary {
  const prioritizedRows = prioritizeCreatedAsset(rows, createdId);
  return {
    addedAt: latestTimestamp(prioritizedRows.map((row) => row.updated_at ?? row.created_at)),
    valueText: prioritizedRows.length ? (valueTextBuilder ? valueTextBuilder(prioritizedRows) : `${prioritizedRows.length}`) : emptyValueText,
    detailText: prioritizedRows.length ? `${prioritizedRows.length} ${detailLabel}` : emptyDetailText,
    items: prioritizedRows.slice(0, itemLimit).map(itemBuilder),
  };
}

export function buildRecentCanonicalActivity({
  assets,
  documents,
  assetHrefForBucket,
  assetLabelForBucket,
}: {
  assets: DashboardAssetRow[];
  documents: DashboardDocumentRow[];
  assetHrefForBucket: (bucket: DashboardAssetBucket) => string;
  assetLabelForBucket: (bucket: DashboardAssetBucket) => string;
}) {
  const liveAssets = getLiveAssets(assets);
  const assetActivity: DashboardRecentActivityItem[] = liveAssets.map((row) => {
    const bucket = getDashboardAssetBucket(row);
    const title = String((row as { title?: string | null }).title ?? "").trim() || assetLabelForBucket(bucket);
    return {
      id: `asset-${row.id}`,
      kind: "asset",
      title,
      description: `${assetLabelForBucket(bucket)} updated`,
      href: assetHrefForBucket(bucket),
      timestamp: row.updated_at ?? row.created_at ?? null,
      icon: bucket === "finance" ? "account_balance" : bucket === "property" ? "home" : bucket === "business" ? "business_center" : bucket === "digital" ? "devices" : bucket === "tasks" ? "task" : "inventory_2",
    };
  });

  const documentActivity: DashboardRecentActivityItem[] = documents
    .filter((row) => Boolean(String(row.asset_id ?? "").trim()))
    .map((row) => {
      const assetId = String(row.asset_id ?? "").trim();
      const parentAsset = liveAssets.find((asset) => asset.id === assetId);
      const bucket = parentAsset ? getDashboardAssetBucket(parentAsset) : "other";
      const title = String(row.file_name ?? row.document_type ?? row.category_key ?? "Document").trim() || "Document";
      return {
        id: `document-${row.id}`,
        kind: "document",
        title,
        description: `Linked to ${assetLabelForBucket(bucket)}`,
        href: assetHrefForBucket(bucket),
        timestamp: row.created_at ?? null,
        icon: row.document_kind === "photo" ? "photo_camera" : "description",
      };
    });

  return [...assetActivity, ...documentActivity]
    .filter((item) => Boolean(item.timestamp))
    .sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime())
    .slice(0, 8);
}

export function prioritizeCreatedAsset<T extends { id: string }>(rows: T[], createdId: string) {
  if (!createdId) return rows;
  const created = rows.find((row) => row.id === createdId);
  if (!created) return rows;
  return [created, ...rows.filter((row) => row.id !== createdId)];
}

export function getLegalDocuments<T extends DashboardDocumentRow>(rows: T[]) {
  return rows.filter((row) => {
    const key = `${row.category_key || row.document_type || ""}`.toLowerCase();
    return key.includes("legal") || key.includes("will") || key.includes("trust");
  });
}

export function latestTimestamp(values: Array<string | null | undefined>) {
  const filtered = values.filter((value): value is string => Boolean(value));
  if (!filtered.length) return null;
  const max = filtered
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0];
  return Number.isFinite(max) ? new Date(max).toISOString() : null;
}

function normalizeCategoryToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
