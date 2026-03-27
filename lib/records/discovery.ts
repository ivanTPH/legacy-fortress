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
  title?: string | null;
  fileName?: string | null;
  parentLabel?: string | null;
  sectionKey?: string | null;
  categoryKey?: string | null;
  documentKind?: string | null;
};

export type DiscoveryAttachmentRow = {
  id: string;
  fileName?: string | null;
  parentLabel?: string | null;
  sectionKey?: string | null;
  categoryKey?: string | null;
  mimeType?: string | null;
  metaLabel?: string | null;
};

export type DiscoveryContactRow = {
  id: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  contactRole?: string | null;
  relationship?: string | null;
  linkedContext?: Array<{
    label?: string | null;
    role?: string | null;
    section_key?: string | null;
    category_key?: string | null;
  }> | null;
};

export type DashboardDiscoveryResult = {
  id: string;
  kind: "asset" | "document" | "attachment" | "contact" | "navigation";
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

export function buildDashboardSearchHref(query: string | null | undefined) {
  const normalizedQuery = normalizeDiscoveryQuery(query);
  return normalizedQuery ? `/dashboard?search=${encodeURIComponent(normalizedQuery)}` : "/dashboard";
}

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
  TContact extends DiscoveryContactRow,
  TDocument extends DiscoveryDocumentRow,
  TAttachment extends DiscoveryAttachmentRow,
>({
  query,
  assets,
  contacts,
  documents,
  attachments,
  assetHref,
  assetIcon,
  contactHref,
  documentHref,
  attachmentHref,
  extraLinks = [],
}: {
  query: string;
  assets: TAsset[];
  contacts: TContact[];
  documents: TDocument[];
  attachments: TAttachment[];
  assetHref: (asset: TAsset) => string;
  assetIcon: (asset: TAsset) => string;
  contactHref: (contact: TContact) => string;
  documentHref: (document: TDocument) => string;
  attachmentHref: (attachment: TAttachment) => string;
  extraLinks?: DashboardDiscoveryLink[];
}) {
  const normalizedQuery = normalizeDiscoveryQuery(query);
  if (!normalizedQuery) return [] as DashboardDiscoveryResult[];

  const contactResults = contacts
    .filter((contact) => buildSafeContactSearchText(contact).includes(normalizedQuery))
    .map((contact) => ({
      id: `contact-${contact.id}`,
      kind: "contact" as const,
      label: String(contact.fullName ?? "").trim() || "Contact",
      description: [
        stringValue(contact.relationship),
        stringValue(contact.contactRole),
        stringValue(contact.email),
        stringValue(contact.phone),
        ...(contact.linkedContext ?? []).map((context) => stringValue(context.label || context.role || context.section_key || context.category_key)),
      ]
        .filter(Boolean)
        .join(" · "),
      href: contactHref(contact),
      icon: "contacts",
    }));

  const assetResults = filterDiscoveryRecords(assets, { query: normalizedQuery })
    .map((asset) => ({
    id: `asset-${asset.id}`,
    kind: "asset" as const,
    label: getDiscoveryAssetLabel(asset),
    description: [formatDiscoverySectionLabel(asset.section_key), formatDiscoveryCategoryLabel(asset.category_key), stringValue(asset.summary)]
      .filter(Boolean)
      .join(" · "),
    href: assetHref(asset),
    icon: assetIcon(asset),
    }));

  const documentResults = filterDiscoveryDocuments(documents, { query: normalizedQuery }).map((document) => ({
    id: `document-${document.id}`,
    kind: "document" as const,
    label: String(document.title ?? document.fileName ?? "").trim() || "Document",
    description: [
      "Linked document",
      stringValue(document.fileName),
      stringValue(document.parentLabel),
      formatDiscoverySectionLabel(document.sectionKey),
      formatDiscoveryCategoryLabel(document.categoryKey),
    ]
      .filter(Boolean)
      .join(" · "),
    href: documentHref(document),
    icon: normalizeDiscoveryToken(document.documentKind) === "photo" ? "photo_camera" : "description",
  }));

  const attachmentResults = attachments
    .filter((attachment) => buildSafeAttachmentSearchText(attachment).includes(normalizedQuery))
    .map((attachment) => ({
      id: `attachment-${attachment.id}`,
      kind: "attachment" as const,
      label: String(attachment.fileName ?? "").trim() || "Attachment",
      description: [
        "Attachment",
        stringValue(attachment.parentLabel),
        formatDiscoverySectionLabel(attachment.sectionKey),
        formatDiscoveryCategoryLabel(attachment.categoryKey),
        stringValue(attachment.metaLabel),
      ]
        .filter(Boolean)
        .join(" · "),
      href: attachmentHref(attachment),
      icon: normalizeDiscoveryToken(attachment.mimeType).startsWith("image") ? "attach_file" : "description",
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

  return [...assetResults, ...documentResults, ...attachmentResults, ...contactResults, ...navigationResults].slice(0, 20);
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
      flattenDiscoveryMetadata(row.metadata).join(" "),
      ...safeTaskLabels,
    ].join(" "),
  );
}

function buildSafeDocumentSearchText(row: DiscoveryDocumentRow) {
  return normalizeDiscoveryQuery(
    [
      row.title,
      row.fileName,
      row.parentLabel,
      formatDiscoverySectionLabel(row.sectionKey),
      formatDiscoveryCategoryLabel(row.categoryKey),
      row.documentKind,
    ].join(" "),
  );
}

function buildSafeAttachmentSearchText(row: DiscoveryAttachmentRow) {
  return normalizeDiscoveryQuery(
    [
      row.fileName,
      row.parentLabel,
      row.metaLabel,
      row.mimeType,
      formatDiscoverySectionLabel(row.sectionKey),
      formatDiscoveryCategoryLabel(row.categoryKey),
    ].join(" "),
  );
}

function buildSafeContactSearchText(row: DiscoveryContactRow) {
  return normalizeDiscoveryQuery(
    [
      row.fullName,
      row.email,
      row.phone,
      row.contactRole,
      row.relationship,
      ...(row.linkedContext ?? []).map((context) =>
        [
          context.label,
          context.role,
          context.section_key,
          context.category_key,
        ].filter(Boolean).join(" "),
      ),
    ].join(" "),
  );
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getDiscoveryAssetLabel(row: DiscoveryRecordRow) {
  const metadataLabel = pickDiscoveryMetadataLabel(row.metadata);
  return (
    stringValue(row.title)
    || stringValue(row.provider_name)
    || metadataLabel
    || formatDiscoveryCategoryLabel(row.category_key)
  );
}

function flattenDiscoveryMetadata(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];

  const results: string[] = [];
  const stack: unknown[] = [value];

  while (stack.length > 0) {
    const current = stack.pop();
    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }
    if (!current || typeof current !== "object") {
      if (typeof current === "string") results.push(current.trim());
      else if (typeof current === "number" || typeof current === "boolean") results.push(String(current));
      continue;
    }

    for (const [key, nestedValue] of Object.entries(current as Record<string, unknown>)) {
      results.push(key.replace(/[_-]+/g, " "));
      if (typeof nestedValue === "string") {
        results.push(nestedValue.trim());
      } else if (typeof nestedValue === "number" || typeof nestedValue === "boolean") {
        results.push(String(nestedValue));
      } else if (nestedValue && typeof nestedValue === "object") {
        stack.push(nestedValue);
      }
    }
  }

  return results.filter(Boolean);
}

function pickDiscoveryMetadataLabel(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const metadata = value as Record<string, unknown>;
  const preferredKeys = [
    "provider_name",
    "institution_name",
    "account_name",
    "account_holder_name",
    "platform",
    "platform_name",
    "title",
    "name",
    "document_title",
  ];

  for (const key of preferredKeys) {
    const candidate = stringValue(metadata[key]);
    if (candidate) return candidate;
  }

  return Object.values(metadata).map(stringValue).find(Boolean) ?? "";
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
