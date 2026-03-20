type ExecutorAssetSource = {
  title?: string | null;
  metadata?: Record<string, unknown> | null;
  metadata_json?: Record<string, unknown> | null;
};

export type CanonicalExecutorAsset = {
  title: string;
  executor_type: string;
  relationship_to_user: string;
  contact_email: string;
  contact_phone: string;
  authority_level: string;
  jurisdiction: string;
  executor_status: string;
  appointed_on: string;
  executor_address: string;
  identity_reference: string;
  beneficiary_reference: string;
  instruction_reference: string;
  notes: string;
  executor_summary: string;
};

export type CanonicalExecutorEditSeed = {
  title: string;
  executor_type: string;
  executor_type_other: string;
  relationship_to_user: string;
  relationship_to_user_other: string;
  contact_email: string;
  contact_phone: string;
  authority_level: string;
  authority_level_other: string;
  jurisdiction: string;
  jurisdiction_other: string;
  executor_status: string;
  executor_status_other: string;
  appointed_on: string;
  executor_address: string;
  identity_reference: string;
  beneficiary_reference: string;
  instruction_reference: string;
  notes: string;
};

export function readCanonicalExecutorAsset(source: ExecutorAssetSource): CanonicalExecutorAsset {
  const metadata = source.metadata_json ?? source.metadata ?? {};
  const title = readString(source.title, metadata["full_name"], metadata["executor_name"], metadata["title"]) || "Untitled trusted contact";
  const executorType = readString(metadata["executor_type"], metadata["role_type"], metadata["executor_type_other"]);
  const relationshipToUser = readString(metadata["relationship_to_user"], metadata["relationship"], metadata["relationship_to_user_other"]);
  const contactEmail = readString(metadata["contact_email"], metadata["email"]);
  const contactPhone = readString(metadata["contact_phone"], metadata["phone"], metadata["telephone"]);
  const authorityLevel = readString(metadata["authority_level"], metadata["authority"], metadata["authority_level_other"]);
  const jurisdiction = readString(metadata["jurisdiction"], metadata["country"], metadata["country_code"]).toUpperCase();
  const executorStatus = readString(metadata["executor_status"], metadata["status"], metadata["executor_status_other"]);
  const appointedOn = readString(metadata["appointed_on"], metadata["appointment_date"]);
  const executorAddress = readString(metadata["executor_address"], metadata["address"]);
  const identityReference = readString(metadata["identity_reference"], metadata["reference"]);
  const beneficiaryReference = readString(metadata["beneficiary_reference"], metadata["linked_beneficiary"]);
  const instructionReference = readString(metadata["instruction_reference"], metadata["linked_instruction"]);
  const notes = readString(metadata["notes"]);

  return {
    title,
    executor_type: executorType,
    relationship_to_user: relationshipToUser,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    authority_level: authorityLevel,
    jurisdiction,
    executor_status: executorStatus,
    appointed_on: appointedOn,
    executor_address: executorAddress,
    identity_reference: identityReference,
    beneficiary_reference: beneficiaryReference,
    instruction_reference: instructionReference,
    notes,
    executor_summary: [executorType, authorityLevel, relationshipToUser].filter(Boolean).join(" · "),
  };
}

export function normalizeCanonicalExecutorMetadata(metadata: Record<string, unknown>) {
  const canonical = readCanonicalExecutorAsset({ metadata });

  return {
    ...metadata,
    full_name: canonical.title || null,
    executor_name: canonical.title || null,
    executor_type: canonical.executor_type || null,
    relationship_to_user: canonical.relationship_to_user || null,
    contact_email: canonical.contact_email || null,
    contact_phone: canonical.contact_phone || null,
    authority_level: canonical.authority_level || null,
    jurisdiction: canonical.jurisdiction || null,
    executor_status: canonical.executor_status || null,
    appointed_on: canonical.appointed_on || null,
    executor_address: canonical.executor_address || null,
    identity_reference: canonical.identity_reference || null,
    beneficiary_reference: canonical.beneficiary_reference || null,
    instruction_reference: canonical.instruction_reference || null,
    notes: canonical.notes || null,
  };
}

export function buildCanonicalExecutorEditSeed(source: ExecutorAssetSource): CanonicalExecutorEditSeed {
  const canonical = readCanonicalExecutorAsset(source);

  return {
    title: canonical.title,
    executor_type: toKnownOrOther(canonical.executor_type, EXECUTOR_TYPE_VALUES).selected,
    executor_type_other: toKnownOrOther(canonical.executor_type, EXECUTOR_TYPE_VALUES).other,
    relationship_to_user: toKnownOrOther(canonical.relationship_to_user, RELATIONSHIP_VALUES).selected,
    relationship_to_user_other: toKnownOrOther(canonical.relationship_to_user, RELATIONSHIP_VALUES).other,
    contact_email: canonical.contact_email,
    contact_phone: canonical.contact_phone,
    authority_level: toKnownOrOther(canonical.authority_level, AUTHORITY_LEVEL_VALUES).selected,
    authority_level_other: toKnownOrOther(canonical.authority_level, AUTHORITY_LEVEL_VALUES).other,
    jurisdiction: toKnownOrOther(canonical.jurisdiction, COUNTRY_VALUES).selected,
    jurisdiction_other: toKnownOrOther(canonical.jurisdiction, COUNTRY_VALUES).other,
    executor_status: toKnownOrOther(canonical.executor_status, EXECUTOR_STATUS_VALUES).selected,
    executor_status_other: toKnownOrOther(canonical.executor_status, EXECUTOR_STATUS_VALUES).other,
    appointed_on: canonical.appointed_on,
    executor_address: canonical.executor_address,
    identity_reference: canonical.identity_reference,
    beneficiary_reference: canonical.beneficiary_reference,
    instruction_reference: canonical.instruction_reference,
    notes: canonical.notes,
  };
}

const EXECUTOR_TYPE_VALUES = ["executor", "co_executor", "solicitor", "professional_adviser", "guardian", "trusted_contact"];
const RELATIONSHIP_VALUES = ["spouse_partner", "child", "sibling", "parent", "friend", "adviser", "solicitor", "other_family"];
const AUTHORITY_LEVEL_VALUES = ["primary", "joint", "backup", "limited", "informational"];
const EXECUTOR_STATUS_VALUES = ["active", "pending", "declined", "retired", "deceased"];
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
