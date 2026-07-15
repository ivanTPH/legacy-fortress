export type LegalCategorySlug =
  | "wills"
  | "trusts"
  | "power-of-attorney"
  | "funeral-wishes"
  | "marriage-divorce-documents"
  | "identity-documents"
  | "other-legal-documents";

type LegalCategoryMeta = {
  slug: LegalCategorySlug;
  label: string;
  description: string;
  documentType: string;
  matchTypes: string[];
};

export type LegalLinkedContactDefinition = {
  defaultRole: string;
  contactNameLabel: string;
  contactEmailLabel: string;
  contactRoleLabel: string;
  roleOptions: Array<{ value: string; label: string }>;
  description: string;
};

export const LEGAL_CATEGORIES: LegalCategoryMeta[] = [
  {
    slug: "wills",
    label: "Wills",
    description: "Store current and superseded will records with supporting files.",
    documentType: "will",
    matchTypes: ["will", "wills"],
  },
  {
    slug: "trusts",
    label: "Trusts",
    description: "Store trust deeds, trustees and supporting legal documents securely.",
    documentType: "trust",
    matchTypes: ["trust", "trusts"],
  },
  {
    slug: "power-of-attorney",
    label: "Power of Attorney",
    description: "Track LPA and power of attorney records and file versions.",
    documentType: "power_of_attorney",
    matchTypes: ["power_of_attorney", "lpa"],
  },
  {
    slug: "funeral-wishes",
    label: "Funeral Wishes",
    description: "Store funeral wishes, instructions, and related documents.",
    documentType: "funeral_wishes",
    matchTypes: ["funeral_wishes", "funeral"],
  },
  {
    slug: "marriage-divorce-documents",
    label: "Marriage / Divorce Documents",
    description: "Manage marriage and divorce certificates and related records.",
    documentType: "marriage_divorce",
    matchTypes: ["marriage_divorce", "marriage_divorce_documents"],
  },
  {
    slug: "identity-documents",
    label: "Identity Documents",
    description: "Keep key identity documents and supporting references.",
    documentType: "identity_document",
    matchTypes: ["identity", "identity_document", "identity_documents"],
  },
  {
    slug: "other-legal-documents",
    label: "Other Legal Documents",
    description: "Store legal records that do not fit another legal category.",
    documentType: "other",
    matchTypes: ["other"],
  },
];

export function getLegalCategoryBySlug(slug: string) {
  return LEGAL_CATEGORIES.find((category) => category.slug === slug);
}

export function usesCanonicalLegalAssetRead(slug: string) {
  return slug === "power-of-attorney" || slug === "identity-documents";
}

type AssetLikeForLegalMatch = {
  section_key?: unknown;
  category_key?: unknown;
  title?: unknown;
  metadata?: Record<string, unknown> | null;
  metadata_json?: Record<string, unknown> | null;
};

export function resolveLegalCategoryForAsset(row: AssetLikeForLegalMatch): LegalCategorySlug | null {
  const sectionKey = normalizeLegalValue(row.section_key);
  const categoryKey = normalizeLegalValue(row.category_key);
  const metadata = row.metadata_json ?? row.metadata ?? {};
  const title = normalizeLegalValue(row.title);
  const documentTitle = normalizeLegalValue(metadata["document_title"]);
  const instructionReference = normalizeLegalValue(metadata["instruction_reference"]);
  const executorType = normalizeLegalValue(metadata["executor_type"]);
  const poaType = normalizeLegalValue(metadata["poa_type"]);

  if (sectionKey === "legal" && LEGAL_CATEGORIES.some((category) => category.slug === categoryKey)) {
    return categoryKey as LegalCategorySlug;
  }

  const combined = [title, documentTitle, instructionReference, executorType, poaType, categoryKey, sectionKey]
    .filter(Boolean)
    .join(" ");

  if (
    combined.includes("power of attorney")
    || combined.includes("property and financial affairs lpa")
    || combined.includes(" lpa")
    || combined.includes("power_of_attorney")
  ) {
    return "power-of-attorney";
  }

  if (combined.includes("will")) {
    return "wills";
  }

  if (combined.includes("trust")) {
    return "trusts";
  }

  if (combined.includes("identity")) {
    return "identity-documents";
  }

  return null;
}

export function assetMatchesLegalCategory(row: AssetLikeForLegalMatch, slug: LegalCategorySlug) {
  return resolveLegalCategoryForAsset(row) === slug;
}

export function getLegalLinkedContactDefinition(slug: string): LegalLinkedContactDefinition | null {
  if (slug === "wills") {
    return {
      defaultRole: "executor",
      contactNameLabel: "Executor name",
      contactEmailLabel: "Executor email",
      contactRoleLabel: "Executor role",
      roleOptions: [
        { value: "executor", label: "Executor" },
        { value: "co_executor", label: "Co-executor" },
        { value: "reserve_executor", label: "Reserve executor" },
        { value: "professional_executor", label: "Professional executor" },
        { value: "legal_adviser", label: "Solicitor / legal adviser" },
        { value: "guardian", label: "Guardian" },
      ],
      description: "Link the executor or co-executor someone should contact when reviewing this will.",
    };
  }

  if (slug === "trusts") {
    return {
      defaultRole: "trustee",
      contactNameLabel: "Full name",
      contactEmailLabel: "Email",
      contactRoleLabel: "Role",
      roleOptions: [
        { value: "trustee", label: "Trustee" },
        { value: "settlor", label: "Settlor" },
        { value: "beneficiary", label: "Beneficiary" },
        { value: "protector", label: "Protector" },
        { value: "solicitor", label: "Solicitor" },
        { value: "adviser", label: "Adviser" },
        { value: "accountant", label: "Accountant" },
        { value: "other", label: "Other" },
      ],
      description: "Link trustees and related people attached to this trust record.",
    };
  }

  if (slug === "power-of-attorney") {
    return {
      defaultRole: "advocate",
      contactNameLabel: "Attorney / advocate name",
      contactEmailLabel: "Attorney / advocate email",
      contactRoleLabel: "Authority role",
      roleOptions: [
        { value: "attorney", label: "Attorney" },
        { value: "replacement_attorney", label: "Replacement attorney" },
        { value: "certificate_provider", label: "Certificate provider" },
        { value: "legal_adviser", label: "Solicitor / legal adviser" },
      ],
      description: "Link the attorney, advocate, or named representative attached to this power of attorney.",
    };
  }

  if (slug === "funeral-wishes") {
    return {
      defaultRole: "family_member",
      contactNameLabel: "Family contact name",
      contactEmailLabel: "Family contact email",
      contactRoleLabel: "Family role",
      roleOptions: [
        { value: "family_member", label: "Family member" },
        { value: "next_of_kin", label: "Next of kin" },
        { value: "funeral_director", label: "Funeral director" },
        { value: "celebrant", label: "Celebrant" },
        { value: "legal_adviser", label: "Solicitor / legal adviser" },
      ],
      description: "Link the family member or practical contact who should see these wishes first.",
    };
  }

  return null;
}

function normalizeLegalValue(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ");
}
