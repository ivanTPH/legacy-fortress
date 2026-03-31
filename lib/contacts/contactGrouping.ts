export type ContactGroupKey = "executors" | "family" | "advisors" | "beneficiaries" | "trusted_contacts";

export function normalizeContactGroupKey(value: unknown): ContactGroupKey | null {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (!normalized) return null;
  if (normalized === "executors" || normalized === "executor") return "executors";
  if (normalized === "family" || normalized === "next-of-kin" || normalized === "next-of-kin-contacts") return "family";
  if (normalized === "advisors" || normalized === "advisor" || normalized === "advisers" || normalized === "adviser") return "advisors";
  if (normalized === "beneficiaries" || normalized === "beneficiary") return "beneficiaries";
  if (normalized === "trusted-contacts" || normalized === "trusted-contact" || normalized === "trusted") return "trusted_contacts";
  return null;
}

type ContactContextLike = {
  role?: string | null;
  label?: string | null;
  category_key?: string | null;
  section_key?: string | null;
};

type ContactLike = {
  contact_role?: string | null;
  relationship?: string | null;
  source_type?: string | null;
  linked_context?: ContactContextLike[] | null;
};

export function resolveContactGroupKey(contact: ContactLike): ContactGroupKey {
  const directRole = normalizeContactTerms(contact.contact_role, contact.relationship);
  const contextTerms = normalizeContactTerms(
    ...(contact.linked_context ?? []).flatMap((item) => [item.role, item.label, item.category_key, item.section_key]),
  );
  const combined = `${directRole} ${contextTerms}`.trim();

  if (hasExecutorSignal(combined)) return "executors";
  if (hasBeneficiarySignal(combined)) return "beneficiaries";
  if (hasAdvisorSignal(combined)) return "advisors";
  if (
    contact.source_type === "next_of_kin"
    || combined.includes("next of kin")
    || combined.includes("family")
    || combined.includes("spouse")
    || combined.includes("child")
    || combined.includes("parent")
    || combined.includes("sibling")
  ) {
    return "family";
  }
  return "trusted_contacts";
}

function hasExecutorSignal(value: string) {
  return (
    value.includes("executor")
    || value.includes("co executor")
    || value.includes("guardian")
    || value.includes("power of attorney")
    || value.includes("power_of_attorney")
  );
}

function hasAdvisorSignal(value: string) {
  return (
    value.includes("advisor")
    || value.includes("adviser")
    || value.includes("solicitor")
    || value.includes("lawyer")
    || value.includes("accountant")
    || value.includes("financial advisor")
    || value.includes("financial adviser")
    || value.includes("professional")
  );
}

function hasBeneficiarySignal(value: string) {
  return (
    value.includes("beneficiary")
    || value.includes("heir")
    || value.includes("inherit")
  );
}

function normalizeContactTerms(...values: Array<unknown>) {
  return values
    .map((value) => String(value ?? "").trim().toLowerCase().replace(/[_-]+/g, " "))
    .filter(Boolean)
    .join(" ");
}
