import type { CanonicalContactContext } from "./canonicalContacts";

export type ContactLinkValidationState = "matched" | "confirmed" | "warning";

export function buildContactLinkValidationKey(context: Pick<CanonicalContactContext, "source_kind" | "source_id">) {
  return `${context.source_kind}:${context.source_id}`;
}

export function flattenSearchableValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(flattenSearchableValue).filter(Boolean).join(" ");
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(flattenSearchableValue).filter(Boolean).join(" ");
  }
  return "";
}

export function evaluateContactLinkValidation({
  contactName,
  sourceText,
  manuallyConfirmed = false,
}: {
  contactName: string;
  sourceText?: string | null;
  manuallyConfirmed?: boolean;
}) {
  if (manuallyConfirmed) {
    return {
      state: "confirmed" as ContactLinkValidationState,
      label: "Confirmed",
      warning: "",
    };
  }

  const normalizedContact = normalizeSearchText(contactName);
  const normalizedSource = normalizeSearchText(sourceText);
  const significantTokens = normalizedContact
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

  if (!normalizedContact || significantTokens.length === 0 || !normalizedSource) {
    return {
      state: "warning" as ContactLinkValidationState,
      label: "Needs review",
      warning: "This linked record does not yet show enough matching evidence for the contact name.",
    };
  }

  if (normalizedSource.includes(normalizedContact) || significantTokens.every((token) => normalizedSource.includes(token))) {
    return {
      state: "matched" as ContactLinkValidationState,
      label: "Matched",
      warning: "",
    };
  }

  return {
    state: "warning" as ContactLinkValidationState,
    label: "Needs review",
    warning: "The linked record does not currently contain this contact name in its title, metadata, or file names.",
  };
}

function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
