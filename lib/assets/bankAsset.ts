type BankAssetSource = {
  title?: string | null;
  provider_name?: string | null;
  provider_key?: string | null;
  currency_code?: string | null;
  value_minor?: number | null;
  metadata?: Record<string, unknown> | null;
  metadata_json?: Record<string, unknown> | null;
};

export type CanonicalBankAsset = {
  title: string;
  institution_name: string;
  provider_name: string;
  provider_key: string;
  account_type: string;
  account_number: string;
  masked_account_number: string;
  sort_code: string;
  masked_sort_code: string;
  country_code: string;
  currency_code: string;
  value_major: number;
  last_updated_on: string;
  notes: string;
  logo_src: string;
};

export type CanonicalBankEditSeed = {
  title: string;
  institution_name: string;
  provider_name: string;
  provider_key: string;
  account_type: string;
  account_number: string;
  sort_code: string;
  country_code: string;
  currency_code: string;
  value_major: string;
  last_updated_on: string;
  notes: string;
};

export function readCanonicalBankAsset(source: BankAssetSource): CanonicalBankAsset {
  const metadata = source.metadata_json ?? source.metadata ?? {};
  const institutionName = readString(
    metadata["institution_name"],
    metadata["provider_name"],
    source.provider_name,
    metadata["bank_name"],
  );
  const providerName = readString(
    metadata["provider_name"],
    source.provider_name,
    institutionName,
    metadata["bank_name"],
  );
  const providerKey = readString(metadata["provider_key"], source.provider_key).toLowerCase();
  const accountType = readString(metadata["account_type"], metadata["bank_account_type"]);
  const accountNumber = readString(metadata["account_number"]);
  const sortCode = readString(metadata["sort_code"]);
  const countryCode = readString(metadata["country_code"], metadata["country"]).toUpperCase();
  const currencyCode = readString(metadata["currency_code"], metadata["currency"], source.currency_code).toUpperCase();
  const title = readString(source.title, institutionName, providerName) || "Untitled bank account";
  const lastUpdatedOn = readString(metadata["last_updated_on"]);
  const notes = readString(metadata["notes"]);

  return {
    title,
    institution_name: institutionName,
    provider_name: providerName,
    provider_key: providerKey,
    account_type: accountType,
    account_number: accountNumber,
    masked_account_number: maskSensitiveValue(accountNumber),
    sort_code: sortCode,
    masked_sort_code: maskSensitiveValue(sortCode),
    country_code: countryCode,
    currency_code: currencyCode || "GBP",
    value_major: readNumber(metadata["value_major"], metadata["estimated_value"], source.value_minor != null ? source.value_minor / 100 : null),
    last_updated_on: lastUpdatedOn,
    notes,
    logo_src: providerKey ? `/bank-logos/${providerKey}.png` : "",
  };
}

export function normalizeCanonicalBankMetadata(
  metadata: Record<string, unknown>,
  context?: {
    provider_name?: string | null;
    provider_key?: string | null;
    currency_code?: string | null;
    value_major?: number | string | null;
    value_minor?: number | null;
  },
) {
  const source: BankAssetSource = {
    provider_name: context?.provider_name ?? null,
    provider_key: context?.provider_key ?? null,
    currency_code: context?.currency_code ?? null,
    value_minor: context?.value_minor ?? null,
    metadata: {
      ...metadata,
      value_major: context?.value_major ?? metadata["value_major"] ?? metadata["estimated_value"] ?? null,
      provider_name: context?.provider_name ?? metadata["provider_name"] ?? null,
      provider_key: context?.provider_key ?? metadata["provider_key"] ?? null,
      currency_code: context?.currency_code ?? metadata["currency_code"] ?? metadata["currency"] ?? null,
    },
  };
  const canonical = readCanonicalBankAsset(source);

  return {
    ...metadata,
    institution_name: canonical.institution_name || null,
    provider_name: canonical.provider_name || null,
    provider_key: canonical.provider_key || null,
    account_type: canonical.account_type || null,
    account_number: canonical.account_number || null,
    sort_code: canonical.sort_code || null,
    country_code: canonical.country_code || null,
    currency_code: canonical.currency_code || null,
    value_major: canonical.value_major || 0,
    last_updated_on: canonical.last_updated_on || null,
    notes: canonical.notes || null,
  };
}

export function buildCanonicalBankEditSeed(source: BankAssetSource): CanonicalBankEditSeed {
  const canonical = readCanonicalBankAsset(source);

  return {
    title: canonical.title,
    institution_name: canonical.institution_name,
    provider_name: canonical.provider_name,
    provider_key: canonical.provider_key,
    account_type: canonical.account_type,
    account_number: canonical.account_number,
    sort_code: canonical.sort_code,
    country_code: canonical.country_code,
    currency_code: canonical.currency_code,
    value_major: canonical.value_major ? String(canonical.value_major) : "",
    last_updated_on: canonical.last_updated_on,
    notes: canonical.notes,
  };
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

function maskSensitiveValue(value: string, preserveLast = 4) {
  const compact = value.replace(/\s+/g, "");
  if (!compact) return "";
  if (compact.length <= preserveLast) return "•".repeat(compact.length);
  return `${"•".repeat(compact.length - preserveLast)}${compact.slice(-preserveLast)}`;
}
