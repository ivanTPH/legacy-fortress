/**
 * Direct debits and regular payments (owner, 26 Nov 2026). A Finances category of its own ("direct-debits"): each
 * payment says which of the owner's accounts it comes FROM (their bank accounts and credit cards), who it goes TO
 * (ideally linked to that provider's own record), how much and how often, and what should happen after a death.
 *
 * Amounts are outgoings, never assets: they are not added to any total or net worth. No bank account numbers here.
 */
import { findProviderBrand } from "../assets/providerBrands.mjs";
import { findDigitalBrand } from "../assets/digitalBrands.mjs";

export const DIRECT_DEBIT_CATEGORY = "direct-debits";
export const DIRECT_DEBIT_HREF = "/finances/direct-debits";

export const PAYMENT_METHOD_OPTIONS = [
  { value: "direct_debit", label: "Direct debit" },
  { value: "standing_order", label: "Standing order" },
  { value: "card", label: "Card payment (subscription)" },
  { value: "other", label: "Other" },
];

export const PAYMENT_FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Yearly" },
  { value: "other", label: "Other" },
];

/** What the owner wants done after their death. "Keep paying" matters: mortgages and buildings insurance often must continue. */
export const AFTER_DEATH_OPTIONS = [
  { value: "cancel", label: "Cancel it" },
  { value: "transfer", label: "Transfer it to someone else" },
  { value: "keep_paying", label: "Keep paying until the estate is sorted" },
  { value: "not_sure", label: "Not sure yet" },
];

export const KEEP_PAYING_HINT = "Mortgage, buildings insurance, council tax and utilities on an empty home often need to keep going until the estate is sorted.";

export function optionLabel(options: Array<{ value: string; label: string }>, value: unknown): string | null {
  return options.find((option) => option.value === String(value ?? ""))?.label ?? null;
}

/** Links point at a record or an asset in the owner's Vault: "record:<id>" or "asset:<id>". */
export function linkRef(kind: "record" | "asset", id: string) {
  return `${kind}:${id}`;
}

export function parseLinkRef(value: unknown): { kind: "record" | "asset"; id: string } | null {
  const match = /^(record|asset):([0-9a-f-]{8,})$/i.exec(String(value ?? "").trim());
  return match ? { kind: match[1].toLowerCase() as "record" | "asset", id: match[2] } : null;
}

/** The payee's icon: digital and everyday services first (Netflix, Octopus), then banks, lenders and insurers. */
export function findPayeeBrand(name: unknown): { key: string; name: string; logo?: string | null; type?: string } | null {
  const text = String(name ?? "").trim();
  if (!text) return null;
  return findDigitalBrand(text) ?? findProviderBrand(text) ?? null;
}

/**
 * Where to add the payee's own record when it isn't in the Vault yet: insurers to Insurance, banks and lenders to
 * Debts, everything else (streaming, broadband, energy, charities, gyms) to Subscriptions. The name is prefilled.
 */
export function payeeAddHref(name: string) {
  const text = String(name ?? "").trim();
  const brand = findPayeeBrand(text);
  const query = `add=1&name=${encodeURIComponent(text.slice(0, 80))}`;
  const type = String((brand as { type?: string } | null)?.type ?? "");
  if (type === "insurer") return `/finances/insurance?${query}`;
  if (type === "bank" || type === "card") return `/finances/debts?${query}`;
  return `/personal/subscriptions?${query}`;
}

const PER_MONTH: Record<string, number> = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, annually: 1 / 12 };

/** Roughly how much a payment costs per month, for the executor pack total. Unknown frequencies count as monthly. */
export function monthlyEquivalent(amount: unknown, frequency: unknown) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value * (PER_MONTH[String(frequency ?? "")] ?? 1);
}
