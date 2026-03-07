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
    description: "Capture trust deeds, trustees, and supporting legal records.",
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
