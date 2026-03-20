type BeneficiaryAssetSource = {
  title?: string | null;
  provider_name?: string | null;
  provider_key?: string | null;
  currency_code?: string | null;
  value_minor?: number | null;
  metadata?: Record<string, unknown> | null;
  metadata_json?: Record<string, unknown> | null;
};

export type CanonicalBeneficiaryAsset = {
  title: string;
  preferred_name: string;
  relationship_to_user: string;
  date_of_birth: string;
  contact_email: string;
  contact_phone: string;
  beneficiary_address: string;
  country_code: string;
  beneficiary_type: string;
  beneficiary_status: string;
  share_percentage: number;
  identification_reference: string;
  notes: string;
  beneficiary_summary: string;
};

export type CanonicalBeneficiaryEditSeed = {
  title: string;
  preferred_name: string;
  relationship_to_user: string;
  relationship_to_user_other: string;
  date_of_birth: string;
  contact_email: string;
  contact_phone: string;
  beneficiary_address: string;
  country_code: string;
  country_code_other: string;
  beneficiary_type: string;
  beneficiary_type_other: string;
  beneficiary_status: string;
  beneficiary_status_other: string;
  share_percentage: string;
  identification_reference: string;
  notes: string;
};

export function readCanonicalBeneficiaryAsset(source: BeneficiaryAssetSource): CanonicalBeneficiaryAsset {
  const metadata = source.metadata_json ?? source.metadata ?? {};
  const title = readString(source.title, metadata["full_name"], metadata["beneficiary_name"], metadata["title"]) || "Untitled beneficiary";
  const preferredName = readString(metadata["preferred_name"], metadata["nickname"]);
  const relationshipToUser = readString(metadata["relationship_to_user"], metadata["relationship"], metadata["relationship_other"]);
  const dateOfBirth = readString(metadata["date_of_birth"], metadata["dob"]);
  const contactEmail = readString(metadata["contact_email"], metadata["email"]);
  const contactPhone = readString(metadata["contact_phone"], metadata["phone"], metadata["telephone"]);
  const beneficiaryAddress = readString(metadata["beneficiary_address"], metadata["address"]);
  const countryCode = readString(metadata["country_code"], metadata["country"]).toUpperCase();
  const beneficiaryType = readString(metadata["beneficiary_type"], metadata["type"], metadata["beneficiary_type_other"]);
  const beneficiaryStatus = readString(metadata["beneficiary_status"], metadata["status"], metadata["beneficiary_status_other"]);
  const sharePercentage = readNumber(metadata["share_percentage"], metadata["beneficiary_share_percentage"]);
  const identificationReference = readString(metadata["identification_reference"], metadata["reference"]);
  const notes = readString(metadata["notes"]);

  return {
    title,
    preferred_name: preferredName,
    relationship_to_user: relationshipToUser,
    date_of_birth: dateOfBirth,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    beneficiary_address: beneficiaryAddress,
    country_code: countryCode,
    beneficiary_type: beneficiaryType,
    beneficiary_status: beneficiaryStatus,
    share_percentage: sharePercentage,
    identification_reference: identificationReference,
    notes,
    beneficiary_summary: [beneficiaryType, relationshipToUser, sharePercentage ? `${sharePercentage}% share` : ""].filter(Boolean).join(" · "),
  };
}

export function normalizeCanonicalBeneficiaryMetadata(metadata: Record<string, unknown>) {
  const canonical = readCanonicalBeneficiaryAsset({ metadata });

  return {
    ...metadata,
    full_name: canonical.title || null,
    beneficiary_name: canonical.title || null,
    preferred_name: canonical.preferred_name || null,
    relationship_to_user: canonical.relationship_to_user || null,
    date_of_birth: canonical.date_of_birth || null,
    contact_email: canonical.contact_email || null,
    contact_phone: canonical.contact_phone || null,
    beneficiary_address: canonical.beneficiary_address || null,
    country_code: canonical.country_code || null,
    beneficiary_type: canonical.beneficiary_type || null,
    beneficiary_status: canonical.beneficiary_status || null,
    share_percentage: canonical.share_percentage || 0,
    identification_reference: canonical.identification_reference || null,
    notes: canonical.notes || null,
  };
}

export function buildCanonicalBeneficiaryEditSeed(source: BeneficiaryAssetSource): CanonicalBeneficiaryEditSeed {
  const canonical = readCanonicalBeneficiaryAsset(source);

  return {
    title: canonical.title,
    preferred_name: canonical.preferred_name,
    relationship_to_user: toKnownOrOther(canonical.relationship_to_user, RELATIONSHIP_VALUES).selected,
    relationship_to_user_other: toKnownOrOther(canonical.relationship_to_user, RELATIONSHIP_VALUES).other,
    date_of_birth: canonical.date_of_birth,
    contact_email: canonical.contact_email,
    contact_phone: canonical.contact_phone,
    beneficiary_address: canonical.beneficiary_address,
    country_code: toKnownOrOther(canonical.country_code, COUNTRY_VALUES).selected,
    country_code_other: toKnownOrOther(canonical.country_code, COUNTRY_VALUES).other,
    beneficiary_type: toKnownOrOther(canonical.beneficiary_type, BENEFICIARY_TYPE_VALUES).selected,
    beneficiary_type_other: toKnownOrOther(canonical.beneficiary_type, BENEFICIARY_TYPE_VALUES).other,
    beneficiary_status: toKnownOrOther(canonical.beneficiary_status, BENEFICIARY_STATUS_VALUES).selected,
    beneficiary_status_other: toKnownOrOther(canonical.beneficiary_status, BENEFICIARY_STATUS_VALUES).other,
    share_percentage: canonical.share_percentage ? String(canonical.share_percentage) : "",
    identification_reference: canonical.identification_reference,
    notes: canonical.notes,
  };
}

const RELATIONSHIP_VALUES = ["spouse_partner", "child", "grandchild", "sibling", "parent", "friend", "charity", "trust"];
const BENEFICIARY_TYPE_VALUES = ["individual", "charity", "trust", "organisation", "estate"];
const BENEFICIARY_STATUS_VALUES = ["primary", "contingent", "minor", "deceased", "revoked"];
const COUNTRY_VALUES = ["UK", "US", "IE", "DE", "FR", "ES", "IT", "NL", "CA", "AU"];

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
