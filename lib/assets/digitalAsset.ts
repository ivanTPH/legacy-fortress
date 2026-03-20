type DigitalAssetSource = {
  title?: string | null;
  provider_name?: string | null;
  provider_key?: string | null;
  currency_code?: string | null;
  value_minor?: number | null;
  metadata?: Record<string, unknown> | null;
  metadata_json?: Record<string, unknown> | null;
};

export type CanonicalDigitalAsset = {
  title: string;
  digital_asset_type: string;
  platform_provider: string;
  wallet_reference: string;
  jurisdiction: string;
  currency_code: string;
  estimated_value_major: number;
  valuation_date: string;
  access_contact: string;
  digital_status: string;
  notes: string;
  digital_summary: string;
};

export type CanonicalDigitalEditSeed = {
  title: string;
  digital_asset_type: string;
  digital_asset_type_other: string;
  platform_provider: string;
  wallet_reference: string;
  jurisdiction: string;
  jurisdiction_other: string;
  currency_code: string;
  currency_other: string;
  estimated_value_major: string;
  valuation_date: string;
  access_contact: string;
  digital_status: string;
  digital_status_other: string;
  notes: string;
};

export function readCanonicalDigitalAsset(source: DigitalAssetSource): CanonicalDigitalAsset {
  const metadata = source.metadata_json ?? source.metadata ?? {};
  const title = readString(source.title, metadata["asset_name"], metadata["service_name"], metadata["title"]) || "Untitled digital asset";
  const digitalAssetType = readString(metadata["digital_asset_type"], metadata["category"], metadata["digital_asset_type_other"], metadata["custom_category"]);
  const platformProvider = readString(metadata["platform_provider"], metadata["provider_name"], metadata["service_name"]);
  const walletReference = readString(metadata["wallet_reference"], metadata["username_or_email"], metadata["account_reference"]);
  const jurisdiction = readString(metadata["jurisdiction"], metadata["country"], metadata["country_code"]).toUpperCase();
  const currencyCode = readString(metadata["currency_code"], metadata["currency"], source.currency_code).toUpperCase();
  const valuationDate = readString(metadata["valuation_date"]);
  const accessContact = readString(metadata["access_contact"], metadata["custodian_contact"], metadata["recovery_method"]);
  const digitalStatus = readString(metadata["digital_status"], metadata["status"]);
  const notes = readString(metadata["notes"], metadata["executor_instructions"]);

  return {
    title,
    digital_asset_type: digitalAssetType,
    platform_provider: platformProvider,
    wallet_reference: walletReference,
    jurisdiction,
    currency_code: currencyCode || "GBP",
    estimated_value_major: readNumber(metadata["estimated_value"], metadata["value_major"], source.value_minor != null ? source.value_minor / 100 : null),
    valuation_date: valuationDate,
    access_contact: accessContact,
    digital_status: digitalStatus,
    notes,
    digital_summary: [digitalAssetType, platformProvider].filter(Boolean).join(" · "),
  };
}

export function normalizeCanonicalDigitalMetadata(
  metadata: Record<string, unknown>,
  context?: {
    currency_code?: string | null;
    value_major?: number | string | null;
    value_minor?: number | null;
  },
) {
  const source: DigitalAssetSource = {
    currency_code: context?.currency_code ?? null,
    value_minor: context?.value_minor ?? null,
    metadata: {
      ...metadata,
      value_major: context?.value_major ?? metadata["value_major"] ?? metadata["estimated_value"] ?? null,
      currency_code: context?.currency_code ?? metadata["currency_code"] ?? metadata["currency"] ?? null,
    },
  };
  const canonical = readCanonicalDigitalAsset(source);

  return {
    ...metadata,
    asset_name: canonical.title || null,
    provider_name: canonical.platform_provider || canonical.title || null,
    digital_asset_type: canonical.digital_asset_type || null,
    platform_provider: canonical.platform_provider || null,
    wallet_reference: canonical.wallet_reference || null,
    jurisdiction: canonical.jurisdiction || null,
    currency_code: canonical.currency_code || null,
    estimated_value: canonical.estimated_value_major || 0,
    valuation_date: canonical.valuation_date || null,
    access_contact: canonical.access_contact || null,
    digital_status: canonical.digital_status || null,
    notes: canonical.notes || null,
  };
}

export function buildCanonicalDigitalEditSeed(source: DigitalAssetSource): CanonicalDigitalEditSeed {
  const canonical = readCanonicalDigitalAsset(source);

  return {
    title: canonical.title,
    digital_asset_type: toKnownOrOther(canonical.digital_asset_type, DIGITAL_ASSET_TYPE_VALUES).selected,
    digital_asset_type_other: toKnownOrOther(canonical.digital_asset_type, DIGITAL_ASSET_TYPE_VALUES).other,
    platform_provider: canonical.platform_provider,
    wallet_reference: canonical.wallet_reference,
    jurisdiction: toKnownOrOther(canonical.jurisdiction, COUNTRY_VALUES).selected,
    jurisdiction_other: toKnownOrOther(canonical.jurisdiction, COUNTRY_VALUES).other,
    currency_code: toKnownOrOther(canonical.currency_code, CURRENCY_VALUES).selected,
    currency_other: toKnownOrOther(canonical.currency_code, CURRENCY_VALUES).other,
    estimated_value_major: canonical.estimated_value_major ? String(canonical.estimated_value_major) : "",
    valuation_date: canonical.valuation_date,
    access_contact: canonical.access_contact,
    digital_status: toKnownOrOther(canonical.digital_status, DIGITAL_STATUS_VALUES).selected,
    digital_status_other: toKnownOrOther(canonical.digital_status, DIGITAL_STATUS_VALUES).other,
    notes: canonical.notes,
  };
}

const DIGITAL_ASSET_TYPE_VALUES = ["exchange_account", "custodial_wallet", "self_custody_wallet", "domain_name", "creator_account", "cloud_storage"];
const DIGITAL_STATUS_VALUES = ["active", "inactive", "locked", "closed", "unknown"];
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
