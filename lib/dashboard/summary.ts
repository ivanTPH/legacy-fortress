import { normalizeBankAssetRow } from "../assets/bankAsset";
import { formatCurrency } from "../currency";

export type DashboardAssetRow = {
  id: string;
  section_key?: string | null;
  category_key?: string | null;
  status?: "active" | "archived" | null;
  archived_at?: string | null;
  deleted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  title?: string | null;
  provider_name?: string | null;
  provider_key?: string | null;
  value_minor?: number | null;
  estimated_value_minor?: number | null;
  currency_code?: string | null;
  metadata?: Record<string, unknown> | null;
  metadata_json?: Record<string, unknown> | null;
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
export type FinanceCategoryKey = "bank" | "investments" | "pensions" | "insurance" | "debts";
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
export type DashboardFinanceSummary = DashboardBucketSummary & {
  totalMajor: number;
  includedCount: number;
  categoryCount: number;
};
export type ScopedAssetTotals = {
  activeValueMajor: number;
  archivedValueMajor: number;
  activeCount: number;
  archivedCount: number;
  missingValueCount: number;
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

const FINANCE_CATEGORY_KEYS = new Set(["bank", "bank-account", "bank-accounts", "investments", "investment", "insurance", "pensions", "pension", "debts", "debt", "loans-liabilities"]);
const PROPERTY_CATEGORY_KEYS = new Set(["property", "properties"]);
const BUSINESS_CATEGORY_KEYS = new Set(["business-interests", "business", "businesses"]);
const DIGITAL_CATEGORY_KEYS = new Set(["digital-assets", "digital", "digital-accounts"]);
const TASK_CATEGORY_KEYS = new Set(["tasks", "task", "action-tracking", "actions"]);

export function getLiveAssets<T extends DashboardAssetRow>(rows: T[]) {
  return rows.filter((row) => row.status !== "archived" && !row.archived_at && !row.deleted_at);
}

export function getDashboardAssetBucket(row: Pick<DashboardAssetRow, "section_key" | "category_key">): DashboardAssetBucket {
  const sectionKey = normalizeCategoryToken(String(row.section_key ?? ""));
  const categoryKey = getNormalizedDashboardCategoryKey(row);

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

export function getAssetsForFinanceCategory<T extends DashboardAssetRow>(rows: T[], categoryKey: FinanceCategoryKey) {
  const liveRows = getAssetsForBucket(rows, "finance");
  return liveRows.filter((row) => {
    const normalizedCategory = getNormalizedDashboardCategoryKey(row);
    if (categoryKey === "debts") {
      return normalizedCategory === "debts" || normalizedCategory === "debt" || normalizedCategory === "loans-liabilities";
    }
    if (categoryKey === "bank") {
      return normalizedCategory === "bank" || normalizedCategory === "bank-account" || normalizedCategory === "bank-accounts";
    }
    return normalizedCategory === categoryKey;
  });
}

export function summarizeScopedAssetRows<T extends DashboardAssetRow>(rows: T[]): ScopedAssetTotals {
  let activeValueMajor = 0;
  let archivedValueMajor = 0;
  let activeCount = 0;
  let archivedCount = 0;
  let missingValueCount = 0;

  for (const row of rows) {
    if (row.deleted_at) continue;

    const valueMajor = getDashboardAssetValueMajor(row);
    const isArchived = row.status === "archived" || Boolean(row.archived_at);
    if (!valueMajor) missingValueCount += 1;

    if (isArchived) {
      archivedCount += 1;
      archivedValueMajor += valueMajor;
    } else {
      activeCount += 1;
      activeValueMajor += valueMajor;
    }
  }

  return { activeValueMajor, archivedValueMajor, activeCount, archivedCount, missingValueCount };
}

export function getDashboardAssetValueMajor(row: DashboardAssetRow) {
  if (isNormalizedBankCategory(getNormalizedDashboardCategoryKey(row))) {
    return normalizeBankAssetRow(row).current_balance;
  }

  if (typeof row.estimated_value_minor === "number") return row.estimated_value_minor / 100;
  if (typeof row.value_minor === "number") return row.value_minor / 100;

  const metadata = row.metadata_json ?? row.metadata ?? {};
  const candidateKeys = [
    "estimated_value_minor",
    "estimated_value_major",
    "current_balance_minor",
    "outstanding_balance_minor",
    "cover_amount_minor",
    "value_major",
    "estimated_value",
    "current_balance",
    "outstanding_balance",
    "cover_amount",
    "value",
  ];

  for (const key of candidateKeys) {
    const raw = metadata[key];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return key.endsWith("_minor") ? raw / 100 : raw;
    }
    if (typeof raw === "string") {
      const parsed = Number(raw.replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(parsed)) {
        return key.endsWith("_minor") ? parsed / 100 : parsed;
      }
    }
  }

  return 0;
}

export function buildFinanceSummary<T extends DashboardAssetRow>(
  rows: T[],
  {
    createdId,
    currency,
    getHref,
    itemLimit = 3,
  }: {
    createdId: string;
    currency: string;
    getHref: (categoryKey: string) => string;
    itemLimit?: number;
  },
): DashboardFinanceSummary {
  const canonicalFinanceRows = sortRowsByDescendingValue(prioritizeCreatedAsset(getAssetsForBucket(rows, "finance"), createdId));
  const totalMajor = canonicalFinanceRows.reduce((sum, row) => sum + getFinanceRowValueMajor(row), 0);
  const categoryCount = new Set(
    canonicalFinanceRows
      .map((row) => canonicalizeFinanceCategoryKey(getNormalizedDashboardCategoryKey(row)))
      .filter(Boolean),
  ).size;

  return {
    addedAt: latestTimestamp(canonicalFinanceRows.map((row) => row.updated_at ?? row.created_at)),
    valueText: canonicalFinanceRows.length ? formatCurrency(totalMajor, currency) : "No records yet",
    detailText: canonicalFinanceRows.length
      ? `${canonicalFinanceRows.length} finance record(s) across ${categoryCount || 1} categor${(categoryCount || 1) === 1 ? "y" : "ies"}`
      : "No records yet",
    items: canonicalFinanceRows.slice(0, itemLimit).map((row) => ({
      id: `asset-${row.id}`,
      label: getFinanceRowLabel(row),
      href: getHref(canonicalizeFinanceCategoryKey(getNormalizedDashboardCategoryKey(row))),
      meta: formatCurrency(getFinanceRowValueMajor(row), getFinanceRowCurrencyCode(row) || currency),
    })),
    totalMajor,
    includedCount: canonicalFinanceRows.length,
    categoryCount,
  };
}

export function buildFinanceCategorySummary<T extends DashboardAssetRow>(
  rows: T[],
  {
    categoryKey,
    currency,
    href,
    itemLimit = 3,
  }: {
    categoryKey: FinanceCategoryKey;
    currency: string;
    href: string;
    itemLimit?: number;
  },
): DashboardBucketSummary & { includedCount: number; totalMajor: number } {
  const scopedRows = sortRowsByDescendingValue(getAssetsForFinanceCategory(rows, categoryKey));
  const totals = summarizeScopedAssetRows(scopedRows);
  return {
    addedAt: latestTimestamp(scopedRows.map((row) => row.updated_at ?? row.created_at)),
    valueText: scopedRows.length ? formatCurrency(totals.activeValueMajor, currency) : "No records yet",
    detailText: scopedRows.length ? `${totals.activeCount} active record(s)` : "No records yet",
    items: scopedRows.slice(0, itemLimit).map((row) => ({
      id: `asset-${row.id}`,
      label: getFinanceRowLabel(row),
      href,
      meta: formatCurrency(getFinanceRowValueMajor(row), getFinanceRowCurrencyCode(row) || currency),
    })),
    includedCount: scopedRows.length,
    totalMajor: totals.activeValueMajor,
  };
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

function sortRowsByDescendingValue<T extends DashboardAssetRow>(rows: T[]) {
  return [...rows].sort((left, right) => {
    const valueDiff = getDashboardAssetValueMajor(right) - getDashboardAssetValueMajor(left);
    if (valueDiff !== 0) return valueDiff;
    const rightTime = new Date(right.updated_at ?? right.created_at ?? 0).getTime();
    const leftTime = new Date(left.updated_at ?? left.created_at ?? 0).getTime();
    return rightTime - leftTime;
  });
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

function getFinanceRowLabel(row: DashboardAssetRow) {
  const categoryKey = getNormalizedDashboardCategoryKey(row);
  const metadata = row.metadata_json ?? row.metadata ?? {};

  if (isNormalizedBankCategory(categoryKey)) {
    const bankAsset = normalizeBankAssetRow(row);
    return bankAsset.provider_name || bankAsset.title || row.provider_name || row.title || "Bank account";
  }

  return (
    readString(
      row.title,
      row.provider_name,
      metadata["investment_provider"],
      metadata["pension_provider"],
      metadata["insurer_name"],
      metadata["creditor_name"],
    ) || "Finance asset"
  );
}

function getFinanceRowValueMajor(row: DashboardAssetRow) {
  const categoryKey = getNormalizedDashboardCategoryKey(row);

  if (isNormalizedBankCategory(categoryKey)) {
    return normalizeBankAssetRow(row).current_balance;
  }

  return getDashboardAssetValueMajor(row);
}

function getFinanceRowCurrencyCode(row: DashboardAssetRow) {
  const categoryKey = getNormalizedDashboardCategoryKey(row);
  const metadata = row.metadata_json ?? row.metadata ?? {};

  if (isNormalizedBankCategory(categoryKey)) {
    return normalizeBankAssetRow(row).currency;
  }

  return readString(metadata["currency_code"], metadata["currency"], row.currency_code).toUpperCase();
}

function getNormalizedDashboardCategoryKey(row: Pick<DashboardAssetRow, "category_key" | "metadata" | "metadata_json">) {
  const metadata = row.metadata_json ?? row.metadata ?? {};
  return normalizeCategoryToken(
    String(
      row.category_key
        ?? metadata["asset_category_token"]
        ?? metadata["category_slug"]
        ?? "",
    ),
  );
}

function isNormalizedBankCategory(categoryKey: string) {
  return categoryKey === "bank" || categoryKey === "bank-account" || categoryKey === "bank-accounts";
}

function canonicalizeFinanceCategoryKey(categoryKey: string) {
  if (isNormalizedBankCategory(categoryKey)) return "bank";
  if (categoryKey === "investment") return "investments";
  if (categoryKey === "pension") return "pensions";
  if (categoryKey === "debt" || categoryKey === "loans-liabilities") return "debts";
  return categoryKey;
}

function readString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return "";
}
