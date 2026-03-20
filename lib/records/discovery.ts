export type DiscoveryRecordRow = {
  id: string;
  title?: string | null;
  provider_name?: string | null;
  provider_key?: string | null;
  summary?: string | null;
  section_key?: string | null;
  category_key?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type DiscoveryDocumentRow = {
  id: string;
  fileName?: string | null;
  parentLabel?: string | null;
  sectionKey?: string | null;
  categoryKey?: string | null;
  documentKind?: string | null;
};

export type DashboardDiscoveryResult = {
  id: string;
  kind: "asset" | "document" | "navigation";
  label: string;
  description: string;
  href: string;
  icon: string;
};

export type DashboardDiscoveryLink = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: string;
  keywords?: string[];
};

export function formatDiscoverySectionLabel(value: string | null | undefined) {
  const normalized = normalizeDiscoveryToken(value);
  if (normalized === "finances") return "Bank Accounts";
  if (normalized === "property") return "Property";
  if (normalized === "business") return "Business Interests";
  if (normalized === "digital") return "Digital Assets";
  if (normalized === "personal") return "Personal";
  return formatDiscoveryCategoryLabel(normalized || "assets");
}

export function formatDiscoveryCategoryLabel(value: string | null | undefined) {
  const normalized = normalizeDiscoveryToken(value);
  if (!normalized) return "Assets";
  return normalized
    .split("-")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

export function filterDiscoveryRecords<T extends DiscoveryRecordRow>(
  rows: T[],
  {
    query,
    statusFilter = "all",
    categoryFilter = "all",
    excludedCategories = [],
  }: {
    query?: string;
    statusFilter?: "all" | "active" | "archived";
    categoryFilter?: string;
    excludedCategories?: string[];
  },
) {
  const normalizedQuery = normalizeDiscoveryQuery(query);
  const excluded = new Set(excludedCategories.map((value) => normalizeDiscoveryToken(value)));

  return rows.filter((row) => {
    const categoryKey = normalizeDiscoveryToken(row.category_key);
    const possessionCategory = normalizeDiscoveryToken(stringValue(row.metadata?.category));
    const effectiveCategory = categoryKey || possessionCategory;

    if (excluded.size > 0 && excluded.has(effectiveCategory)) return false;
    if (statusFilter !== "all" && normalizeDiscoveryToken(row.status) !== statusFilter) return false;
    if (categoryFilter !== "all" && effectiveCategory !== normalizeDiscoveryToken(categoryFilter)) return false;
    if (!normalizedQuery) return true;
    return buildSafeRecordSearchText(row).includes(normalizedQuery);
  });
}

export function filterDiscoveryDocuments<T extends DiscoveryDocumentRow>(
  rows: T[],
  {
    query,
    kindFilter = "all",
    sectionFilter = "all",
  }: {
    query?: string;
    kindFilter?: "all" | "document" | "photo";
    sectionFilter?: string;
  },
) {
  const normalizedQuery = normalizeDiscoveryQuery(query);
  const normalizedSection = normalizeDiscoveryToken(sectionFilter);

  return rows.filter((row) => {
    if (kindFilter !== "all" && normalizeDiscoveryToken(row.documentKind) !== kindFilter) return false;
    if (normalizedSection && normalizedSection !== "all" && normalizeDiscoveryToken(row.sectionKey) !== normalizedSection) return false;
    if (!normalizedQuery) return true;
    return buildSafeDocumentSearchText(row).includes(normalizedQuery);
  });
}

export function buildDashboardDiscoveryResults<
  TAsset extends DiscoveryRecordRow,
  TDocument extends DiscoveryDocumentRow,
>({
  query,
  assets,
  documents,
  assetHref,
  assetIcon,
  documentHref,
  extraLinks = [],
}: {
  query: string;
  assets: TAsset[];
  documents: TDocument[];
  assetHref: (asset: TAsset) => string;
  assetIcon: (asset: TAsset) => string;
  documentHref: (document: TDocument) => string;
  extraLinks?: DashboardDiscoveryLink[];
}) {
  const normalizedQuery = normalizeDiscoveryQuery(query);
  if (!normalizedQuery) return [] as DashboardDiscoveryResult[];

  const assetResults = filterDiscoveryRecords(assets, { query: normalizedQuery }).map((asset) => ({
    id: `asset-${asset.id}`,
    kind: "asset" as const,
    label: String(asset.title ?? asset.provider_name ?? "").trim() || formatDiscoveryCategoryLabel(asset.category_key),
    description: [formatDiscoverySectionLabel(asset.section_key), formatDiscoveryCategoryLabel(asset.category_key), stringValue(asset.summary)]
      .filter(Boolean)
      .join(" · "),
    href: assetHref(asset),
    icon: assetIcon(asset),
  }));

  const documentResults = filterDiscoveryDocuments(documents, { query: normalizedQuery }).map((document) => ({
    id: `document-${document.id}`,
    kind: "document" as const,
    label: String(document.fileName ?? "").trim() || "Document",
    description: [
      "Linked document",
      stringValue(document.parentLabel),
      formatDiscoverySectionLabel(document.sectionKey),
      formatDiscoveryCategoryLabel(document.categoryKey),
    ]
      .filter(Boolean)
      .join(" · "),
    href: documentHref(document),
    icon: normalizeDiscoveryToken(document.documentKind) === "photo" ? "photo_camera" : "description",
  }));

  const navigationResults = extraLinks
    .filter((link) => {
      const keywords = [link.label, link.description, ...(link.keywords ?? [])].join(" ");
      return normalizeDiscoveryQuery(keywords).includes(normalizedQuery);
    })
    .map((link) => ({
      id: `navigation-${link.id}`,
      kind: "navigation" as const,
      label: link.label,
      description: link.description,
      href: link.href,
      icon: link.icon,
    }));

  return [...assetResults, ...documentResults, ...navigationResults].slice(0, 12);
}

function buildSafeRecordSearchText(row: DiscoveryRecordRow) {
  const categoryLabel = formatDiscoveryCategoryLabel(row.category_key || stringValue(row.metadata?.category));
  const sectionLabel = formatDiscoverySectionLabel(row.section_key);
  const safeTaskLabels =
    normalizeDiscoveryToken(row.category_key) === "tasks"
      ? [
          stringValue(row.metadata?.related_asset_label),
          stringValue(row.metadata?.assigned_executor_label),
          stringValue(row.metadata?.assigned_beneficiary_label),
        ]
      : [];

  return normalizeDiscoveryQuery(
    [
      row.title,
      row.provider_name,
      row.provider_key,
      row.summary,
      sectionLabel,
      categoryLabel,
      ...safeTaskLabels,
    ].join(" "),
  );
}

function buildSafeDocumentSearchText(row: DiscoveryDocumentRow) {
  return normalizeDiscoveryQuery(
    [
      row.fileName,
      row.parentLabel,
      formatDiscoverySectionLabel(row.sectionKey),
      formatDiscoveryCategoryLabel(row.categoryKey),
      row.documentKind,
    ].join(" "),
  );
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDiscoveryQuery(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ");
}

function normalizeDiscoveryToken(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
