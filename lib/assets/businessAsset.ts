type BusinessAssetSource = {
  title?: string | null;
  provider_name?: string | null;
  provider_key?: string | null;
  currency_code?: string | null;
  value_minor?: number | null;
  metadata?: Record<string, unknown> | null;
  metadata_json?: Record<string, unknown> | null;
};

export type CanonicalBusinessAsset = {
  title: string;
  business_type: string;
  registration_number: string;
  jurisdiction: string;
  ownership_percentage: number;
  currency_code: string;
  estimated_value_major: number;
  valuation_date: string;
  role_title: string;
  business_status: string;
  notes: string;
  business_summary: string;
};

export type CanonicalBusinessEditSeed = {
  title: string;
  business_type: string;
  business_type_other: string;
  registration_number: string;
  jurisdiction: string;
  jurisdiction_other: string;
  ownership_percentage: string;
  currency_code: string;
  currency_other: string;
  estimated_value_major: string;
  valuation_date: string;
  role_title: string;
  business_status: string;
  business_status_other: string;
  notes: string;
};

export function readCanonicalBusinessAsset(source: BusinessAssetSource): CanonicalBusinessAsset {
  const metadata = source.metadata_json ?? source.metadata ?? {};
  const title = readString(source.title, metadata["business_name"], metadata["entity_name"], metadata["title"]) || "Untitled business interest";
  const businessType = readString(metadata["business_type"], metadata["entity_type"], metadata["business_type_other"], metadata["custom_entity_type"]);
  const registrationNumber = readString(metadata["registration_number"]);
  const jurisdiction = readString(metadata["jurisdiction"], metadata["country"], metadata["country_code"]).toUpperCase();
  const ownershipPercentage = readNumber(metadata["ownership_percentage"], metadata["ownership_percent"]);
  const currencyCode = readString(metadata["currency_code"], metadata["currency"], source.currency_code).toUpperCase();
  const valuationDate = readString(metadata["valuation_date"]);
  const roleTitle = readString(metadata["role_title"]);
  const businessStatus = readString(metadata["business_status"], metadata["status"]);
  const notes = readString(metadata["notes"]);

  return {
    title,
    business_type: businessType,
    registration_number: registrationNumber,
    jurisdiction,
    ownership_percentage: ownershipPercentage,
    currency_code: currencyCode || "GBP",
    estimated_value_major: readNumber(metadata["estimated_value"], metadata["value_major"], source.value_minor != null ? source.value_minor / 100 : null),
    valuation_date: valuationDate,
    role_title: roleTitle,
    business_status: businessStatus,
    notes,
    business_summary: [businessType, roleTitle, ownershipPercentage ? `${ownershipPercentage}% owned` : ""].filter(Boolean).join(" · "),
  };
}

export function normalizeCanonicalBusinessMetadata(
  metadata: Record<string, unknown>,
  context?: {
    currency_code?: string | null;
    value_major?: number | string | null;
    value_minor?: number | null;
  },
) {
  const source: BusinessAssetSource = {
    currency_code: context?.currency_code ?? null,
    value_minor: context?.value_minor ?? null,
    metadata: {
      ...metadata,
      value_major: context?.value_major ?? metadata["value_major"] ?? metadata["estimated_value"] ?? null,
      currency_code: context?.currency_code ?? metadata["currency_code"] ?? metadata["currency"] ?? null,
    },
  };
  const canonical = readCanonicalBusinessAsset(source);

  return {
    ...metadata,
    business_name: canonical.title || null,
    provider_name: canonical.title || null,
    business_type: canonical.business_type || null,
    registration_number: canonical.registration_number || null,
    jurisdiction: canonical.jurisdiction || null,
    ownership_percentage: canonical.ownership_percentage || 0,
    currency_code: canonical.currency_code || null,
    estimated_value: canonical.estimated_value_major || 0,
    valuation_date: canonical.valuation_date || null,
    role_title: canonical.role_title || null,
    business_status: canonical.business_status || null,
    notes: canonical.notes || null,
  };
}

export function buildCanonicalBusinessEditSeed(source: BusinessAssetSource): CanonicalBusinessEditSeed {
  const canonical = readCanonicalBusinessAsset(source);

  return {
    title: canonical.title,
    business_type: toKnownOrOther(canonical.business_type, BUSINESS_TYPE_VALUES).selected,
    business_type_other: toKnownOrOther(canonical.business_type, BUSINESS_TYPE_VALUES).other,
    registration_number: canonical.registration_number,
    jurisdiction: toKnownOrOther(canonical.jurisdiction, COUNTRY_VALUES).selected,
    jurisdiction_other: toKnownOrOther(canonical.jurisdiction, COUNTRY_VALUES).other,
    ownership_percentage: canonical.ownership_percentage ? String(canonical.ownership_percentage) : "",
    currency_code: toKnownOrOther(canonical.currency_code, CURRENCY_VALUES).selected,
    currency_other: toKnownOrOther(canonical.currency_code, CURRENCY_VALUES).other,
    estimated_value_major: canonical.estimated_value_major ? String(canonical.estimated_value_major) : "",
    valuation_date: canonical.valuation_date,
    role_title: canonical.role_title,
    business_status: toKnownOrOther(canonical.business_status, BUSINESS_STATUS_VALUES).selected,
    business_status_other: toKnownOrOther(canonical.business_status, BUSINESS_STATUS_VALUES).other,
    notes: canonical.notes,
  };
}

const BUSINESS_TYPE_VALUES = ["limited_company", "partnership", "sole_trader", "llp", "holding_company", "trust"];
const BUSINESS_STATUS_VALUES = ["active", "dormant", "sold", "winding_down", "exited"];
const COUNTRY_VALUES = ["UK", "US", "IE", "DE", "FR", "ES", "IT", "NL", "CA", "AU"];
const CURRENCY_VALUES = ["GBP", "USD", "EUR", "CAD", "AUD", "JPY", "CHF", "SGD"];

function toKnownOrOther(value: string, knownValues: string[]) {
  const normalized = value.trim();
  if (!normalized) return { selected: "", other: "" };
  if (knownValues.includes(normalized)) return { selected: normalized, other: "" };
  return { selected: "__other", other: normalized };
}

function readString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function readNumber(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}
