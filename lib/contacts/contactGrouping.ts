export type ContactGroupKey = "next_of_kin" | "executors" | "trustees" | "advisors" | "key_contacts";

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
  if (combined.includes("trustee")) return "trustees";
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
    return "next_of_kin";
  }
  return "key_contacts";
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

function normalizeContactTerms(...values: Array<unknown>) {
  return values
    .map((value) => String(value ?? "").trim().toLowerCase().replace(/[_-]+/g, " "))
    .filter(Boolean)
    .join(" ");
}
