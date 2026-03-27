type BankAssetSource = {
  title?: string | null;
  provider_name?: string | null;
  provider_key?: string | null;
  currency_code?: string | null;
  value_minor?: number | null;
  estimated_value_minor?: number | null;
  metadata?: Record<string, unknown> | null;
  metadata_json?: Record<string, unknown> | null;
};

export type CanonicalBankAsset = {
  title: string;
  provider_name: string;
  provider_key: string;
  account_type: string;
  account_holder: string;
  account_number: string;
  masked_account_number: string;
  sort_code: string;
  masked_sort_code: string;
  iban: string;
  masked_iban: string;
  current_balance: number;
  valuation_date: string;
  country: string;
  currency: string;
  notes: string;
  logo_src: string;
};

export type CanonicalBankEditSeed = {
  title: string;
  institution_name: string;
  provider_name: string;
  provider_key: string;
  account_type: string;
  account_holder: string;
  account_number: string;
  sort_code: string;
  iban: string;
  country_code: string;
  currency_code: string;
  value_major: string;
  last_updated_on: string;
  notes: string;
};

export function normalizeBankAssetRow(source: BankAssetSource): CanonicalBankAsset {
  const metadata = source.metadata_json ?? source.metadata ?? {};
  const providerName = readString(
    metadata["provider_name"],
    source.provider_name,
    metadata["institution_name"],
    metadata["provider"],
    metadata["bank_name"],
  );
  const providerKey = readString(metadata["provider_key"], source.provider_key).toLowerCase();
  const accountType = readString(metadata["account_type"], metadata["bank_account_type"]);
  const accountHolder = readString(metadata["account_holder"], metadata["account_holder_name"]);
  const accountNumber = readString(metadata["account_number"]);
  const sortCode = readString(metadata["sort_code"]);
  const iban = readString(metadata["iban"]);
  const currentBalance = readNumber(
    metadata["current_balance"],
    metadata["balance"],
    metadata["value_major"],
    metadata["estimated_value"],
    source.value_minor != null ? source.value_minor / 100 : null,
    source.estimated_value_minor != null ? source.estimated_value_minor / 100 : null,
  );
  const valuationDate = readString(metadata["valuation_date"], metadata["last_updated_on"]);
  const country = readString(metadata["country"], metadata["country_code"]).toUpperCase();
  const currency = readString(metadata["currency"], metadata["currency_code"], source.currency_code).toUpperCase();
  const title = readString(source.title, providerName) || "Untitled bank account";
  const notes = readString(metadata["notes"]);

  return {
    title,
    provider_name: providerName,
    provider_key: providerKey,
    account_type: accountType,
    account_holder: accountHolder,
    account_number: accountNumber,
    masked_account_number: maskSensitiveValue(accountNumber),
    sort_code: sortCode,
    masked_sort_code: maskSensitiveValue(sortCode),
    iban,
    masked_iban: maskSensitiveValue(iban, 6),
    current_balance: currentBalance,
    valuation_date: valuationDate,
    country,
    currency: currency || "GBP",
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
  return {
    provider_name:
      readString(metadata["provider_name"], metadata["institution_name"], metadata["bank_name"], context?.provider_name) || null,
    provider_key: readString(metadata["provider_key"], context?.provider_key).toLowerCase() || null,
    account_type: readString(metadata["account_type"], metadata["bank_account_type"]) || null,
    account_holder: readString(metadata["account_holder"], metadata["account_holder_name"]) || null,
    sort_code: readString(metadata["sort_code"]) || null,
    account_number: readString(metadata["account_number"]) || null,
    iban: readString(metadata["iban"]) || null,
    current_balance: readNumber(
      metadata["current_balance"],
      metadata["balance"],
      metadata["value_major"],
      metadata["estimated_value"],
      context?.value_major,
      context?.value_minor != null ? context.value_minor / 100 : null,
    ),
    valuation_date: readString(metadata["valuation_date"], metadata["last_updated_on"]) || null,
    country: readString(metadata["country"], metadata["country_code"]) || null,
    currency: readString(metadata["currency"], metadata["currency_code"], context?.currency_code).toUpperCase() || null,
    notes: readString(metadata["notes"]) || null,
    swift_bic: readString(metadata["swift_bic"]) || null,
    branch_name: readString(metadata["branch_name"]) || null,
    branch_address: readString(metadata["branch_address"]) || null,
    bank_contact_phone: readString(metadata["bank_contact_phone"]) || null,
    bank_contact_email: readString(metadata["bank_contact_email"]) || null,
    online_banking_url: readString(metadata["online_banking_url"]) || null,
  };
}

export function buildCanonicalBankEditSeed(source: BankAssetSource): CanonicalBankEditSeed {
  const metadata = source.metadata_json ?? source.metadata ?? {};
  const canonical = normalizeBankAssetRow(source);
  const providerName = readString(
    metadata["provider_name"],
    source.provider_name,
    metadata["institution_name"],
    metadata["bank_name"],
  );
  const accountHolder = readString(metadata["account_holder"], metadata["account_holder_name"]);
  const iban = readString(metadata["iban"]);
  const valuationDate = readString(metadata["valuation_date"], metadata["last_updated_on"]);
  const countryCode = readString(metadata["country"], metadata["country_code"], canonical.country).toUpperCase();
  const currencyCode = readString(metadata["currency"], metadata["currency_code"], source.currency_code, canonical.currency).toUpperCase();

  return {
    title: canonical.title,
    institution_name: providerName || canonical.provider_name,
    provider_name: providerName || canonical.provider_name,
    provider_key: canonical.provider_key,
    account_type: canonical.account_type,
    account_holder: accountHolder,
    account_number: canonical.account_number,
    sort_code: canonical.sort_code,
    iban,
    country_code: countryCode,
    currency_code: currencyCode || "GBP",
    value_major: canonical.current_balance ? String(canonical.current_balance) : "",
    last_updated_on: valuationDate || canonical.valuation_date,
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
