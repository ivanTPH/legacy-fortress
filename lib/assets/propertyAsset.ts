type PropertyAssetSource = {
  title?: string | null;
  provider_name?: string | null;
  provider_key?: string | null;
  currency_code?: string | null;
  value_minor?: number | null;
  metadata?: Record<string, unknown> | null;
  metadata_json?: Record<string, unknown> | null;
};

export type CanonicalPropertyAsset = {
  title: string;
  property_type: string;
  ownership_type: string;
  property_address: string;
  property_country: string;
  occupancy_status: string;
  tenant_name: string;
  tenancy_type: string;
  managing_agent: string;
  managing_agent_contact: string;
  monthly_rent_major: number;
  tenancy_end_date: string;
  deposit_scheme_reference: string;
  lease_or_tenant_summary: string;
  currency_code: string;
  estimated_value_major: number;
  valuation_date: string;
  mortgage_status: string;
  mortgage_lender: string;
  mortgage_balance_major: number;
  notes: string;
  property_summary: string;
};

export type CanonicalPropertyEditSeed = {
  title: string;
  property_type: string;
  property_type_other: string;
  ownership_type: string;
  ownership_type_other: string;
  property_address: string;
  property_country: string;
  property_country_other: string;
  occupancy_status: string;
  occupancy_status_other: string;
  tenant_name: string;
  tenancy_type: string;
  tenancy_type_other: string;
  managing_agent: string;
  managing_agent_contact: string;
  monthly_rent_major: string;
  tenancy_end_date: string;
  deposit_scheme_reference: string;
  lease_or_tenant_summary: string;
  currency_code: string;
  currency_other: string;
  estimated_value_major: string;
  valuation_date: string;
  mortgage_status: string;
  mortgage_status_other: string;
  mortgage_lender: string;
  mortgage_balance_major: string;
  notes: string;
};

export function readCanonicalPropertyAsset(source: PropertyAssetSource): CanonicalPropertyAsset {
  const metadata = source.metadata_json ?? source.metadata ?? {};
  const title = readString(source.title, metadata["property_name"], metadata["title"]) || "Untitled property";
  const rawPropertyType = readString(metadata["property_type"], metadata["property_type_other"]);
  const ownershipType = readString(metadata["ownership_type"], metadata["ownership_type_other"]);
  const propertyAddress = readString(metadata["property_address"], metadata["address"]);
  const propertyCountry = readString(metadata["property_country"], metadata["country"], metadata["country_code"]).toUpperCase();
  const rawOccupancyStatus = readString(metadata["occupancy_status"], metadata["occupancy_status_other"]);
  const occupancyStatus = rawOccupancyStatus || (rawPropertyType === "rental" ? "rental_property" : "");
  const propertyType = rawPropertyType === "rental" ? "residential" : rawPropertyType;
  const tenantName = readString(metadata["tenant_name"]);
  const tenancyType = readString(metadata["tenancy_type"], metadata["tenancy_type_other"]);
  const managingAgent = readString(metadata["managing_agent"]);
  const managingAgentContact = readString(metadata["managing_agent_contact"]);
  const tenancyEndDate = readString(metadata["tenancy_end_date"]);
  const depositSchemeReference = readString(metadata["deposit_scheme_reference"]);
  const leaseOrTenantSummary = readString(metadata["lease_or_tenant_summary"]);
  const currencyCode = readString(metadata["currency_code"], metadata["currency"], source.currency_code).toUpperCase();
  const valuationDate = readString(metadata["valuation_date"]);
  const mortgageStatus = readString(metadata["mortgage_status"], metadata["has_mortgage"]);
  const mortgageLender = readString(metadata["mortgage_lender"]);
  const notes = readString(metadata["notes"]);

  return {
    title,
    property_type: propertyType,
    ownership_type: ownershipType,
    property_address: propertyAddress,
    property_country: propertyCountry,
    occupancy_status: occupancyStatus,
    tenant_name: tenantName,
    tenancy_type: tenancyType,
    managing_agent: managingAgent,
    managing_agent_contact: managingAgentContact,
    monthly_rent_major: readNumber(metadata["monthly_rent"], metadata["monthly_rent_major"]),
    tenancy_end_date: tenancyEndDate,
    deposit_scheme_reference: depositSchemeReference,
    lease_or_tenant_summary: leaseOrTenantSummary,
    currency_code: currencyCode || "GBP",
    estimated_value_major: readNumber(metadata["estimated_value"], metadata["value_major"], source.value_minor != null ? source.value_minor / 100 : null),
    valuation_date: valuationDate,
    mortgage_status: mortgageStatus,
    mortgage_lender: mortgageLender,
    mortgage_balance_major: readNumber(metadata["mortgage_balance"], metadata["mortgage_balance_major"]),
    notes,
    property_summary: [propertyType, ownershipType].filter(Boolean).join(" · "),
  };
}

export function normalizeCanonicalPropertyMetadata(
  metadata: Record<string, unknown>,
  context?: {
    currency_code?: string | null;
    value_major?: number | string | null;
    value_minor?: number | null;
  },
) {
  const source: PropertyAssetSource = {
    currency_code: context?.currency_code ?? null,
    value_minor: context?.value_minor ?? null,
    metadata: {
      ...metadata,
      value_major: context?.value_major ?? metadata["value_major"] ?? metadata["estimated_value"] ?? null,
      currency_code: context?.currency_code ?? metadata["currency_code"] ?? metadata["currency"] ?? null,
    },
  };
  const canonical = readCanonicalPropertyAsset(source);

  return {
    ...metadata,
    property_type: canonical.property_type || null,
    ownership_type: canonical.ownership_type || null,
    property_address: canonical.property_address || null,
    property_country: canonical.property_country || null,
    occupancy_status: canonical.occupancy_status || null,
    tenant_name: canonical.tenant_name || null,
    tenancy_type: canonical.tenancy_type || null,
    managing_agent: canonical.managing_agent || null,
    managing_agent_contact: canonical.managing_agent_contact || null,
    monthly_rent: canonical.monthly_rent_major || 0,
    tenancy_end_date: canonical.tenancy_end_date || null,
    deposit_scheme_reference: canonical.deposit_scheme_reference || null,
    lease_or_tenant_summary: canonical.lease_or_tenant_summary || null,
    currency_code: canonical.currency_code || null,
    estimated_value: canonical.estimated_value_major || 0,
    valuation_date: canonical.valuation_date || null,
    mortgage_status: canonical.mortgage_status || null,
    mortgage_lender: canonical.mortgage_lender || null,
    mortgage_balance: canonical.mortgage_balance_major || 0,
    notes: canonical.notes || null,
  };
}

export function buildCanonicalPropertyEditSeed(source: PropertyAssetSource): CanonicalPropertyEditSeed {
  const canonical = readCanonicalPropertyAsset(source);

  return {
    title: canonical.title,
    property_type: toKnownOrOther(canonical.property_type, PROPERTY_TYPE_VALUES).selected,
    property_type_other: toKnownOrOther(canonical.property_type, PROPERTY_TYPE_VALUES).other,
    ownership_type: toKnownOrOther(canonical.ownership_type, OWNERSHIP_TYPE_VALUES).selected,
    ownership_type_other: toKnownOrOther(canonical.ownership_type, OWNERSHIP_TYPE_VALUES).other,
    property_address: canonical.property_address,
    property_country: toKnownOrOther(canonical.property_country, COUNTRY_VALUES).selected,
    property_country_other: toKnownOrOther(canonical.property_country, COUNTRY_VALUES).other,
    occupancy_status: toKnownOrOther(canonical.occupancy_status, OCCUPANCY_STATUS_VALUES).selected,
    occupancy_status_other: toKnownOrOther(canonical.occupancy_status, OCCUPANCY_STATUS_VALUES).other,
    tenant_name: canonical.tenant_name,
    tenancy_type: toKnownOrOther(canonical.tenancy_type, TENANCY_TYPE_VALUES).selected,
    tenancy_type_other: toKnownOrOther(canonical.tenancy_type, TENANCY_TYPE_VALUES).other,
    managing_agent: canonical.managing_agent,
    managing_agent_contact: canonical.managing_agent_contact,
    monthly_rent_major: canonical.monthly_rent_major ? String(canonical.monthly_rent_major) : "",
    tenancy_end_date: canonical.tenancy_end_date,
    deposit_scheme_reference: canonical.deposit_scheme_reference,
    lease_or_tenant_summary: canonical.lease_or_tenant_summary,
    currency_code: toKnownOrOther(canonical.currency_code, CURRENCY_VALUES).selected,
    currency_other: toKnownOrOther(canonical.currency_code, CURRENCY_VALUES).other,
    estimated_value_major: canonical.estimated_value_major ? String(canonical.estimated_value_major) : "",
    valuation_date: canonical.valuation_date,
    mortgage_status: toKnownOrOther(canonical.mortgage_status, MORTGAGE_STATUS_VALUES).selected,
    mortgage_status_other: toKnownOrOther(canonical.mortgage_status, MORTGAGE_STATUS_VALUES).other,
    mortgage_lender: canonical.mortgage_lender,
    mortgage_balance_major: canonical.mortgage_balance_major ? String(canonical.mortgage_balance_major) : "",
    notes: canonical.notes,
  };
}

const PROPERTY_TYPE_VALUES = ["residential", "commercial", "land", "foreign_property"];
const OWNERSHIP_TYPE_VALUES = ["sole", "joint", "tenants_in_common", "trust", "company"];
const COUNTRY_VALUES = ["UK", "US", "IE", "DE", "FR", "ES", "IT", "NL", "CA", "AU"];
const OCCUPANCY_STATUS_VALUES = ["main_residence", "second_home", "rental_property", "vacant"];
const TENANCY_TYPE_VALUES = ["assured_shorthold_tenancy", "periodic_tenancy", "holiday_let", "private_arrangement"];
const CURRENCY_VALUES = ["GBP", "USD", "EUR", "CAD", "AUD", "JPY", "CHF", "SGD"];
const MORTGAGE_STATUS_VALUES = ["none", "repayment", "interest_only", "offset"];

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
