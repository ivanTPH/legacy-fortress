/**
 * Cards (owner, 27 Nov 2026): a Finances category of its own ("cards") for credit cards, debit cards (each linked to
 * one of the owner's bank accounts), loyalty and reward schemes, discount memberships and gift cards.
 *
 * Never stored: the full card number, the security code (CVV) or the PIN. Only the last four digits and the expiry
 * month and year, which is enough to recognise a card. Membership numbers are masked like other references.
 *
 * Totals: a credit card's balance is money owed (taken off, as debts are); gift card balances and the guide value of
 * points are money the person has; debit cards and discount memberships carry no value.
 */
import { findProviderBrand } from "../assets/providerBrands.mjs";
import { findDigitalBrand } from "../assets/digitalBrands.mjs";

export const CARDS_CATEGORY = "cards";
export const CARDS_HREF = "/finances/cards";

export const CARD_TYPE_OPTIONS = [
  { value: "credit_card", label: "Credit card" },
  { value: "debit_card", label: "Debit card" },
  { value: "loyalty", label: "Loyalty or rewards" },
  { value: "discount", label: "Discount membership" },
  { value: "gift_card", label: "Gift card or voucher" },
  { value: "other", label: "Other card" },
];

export const CARD_AFTER_DEATH_OPTIONS = [
  { value: "cancel", label: "Cancel it" },
  { value: "pay_off", label: "Pay off the balance, then close it" },
  { value: "claim_points", label: "Claim or transfer the points" },
  { value: "use_balance", label: "Use or pass on the balance" },
  { value: "not_sure", label: "Not sure yet" },
];

export const POINTS_HINT = "Rules differ between schemes: some let points pass to family, many close the account. Your executors should contact the scheme early.";

export function cardTypeLabel(value: unknown): string | null {
  return CARD_TYPE_OPTIONS.find((option) => option.value === String(value ?? ""))?.label ?? null;
}

export function cardAfterDeathLabel(value: unknown): string | null {
  return CARD_AFTER_DEATH_OPTIONS.find((option) => option.value === String(value ?? ""))?.label ?? null;
}

/** Credit cards saved in Debts before 27 Nov 2026 show in Cards; editing one there moves it to Cards. */
export function isLegacyCreditCard(row: { category_key?: unknown; metadata?: Record<string, unknown> | null }) {
  return row.category_key === "debts" && /credit/i.test(String(row.metadata?.debt_type ?? ""));
}

/** The card's type, reading legacy credit-card debts as credit cards. */
export function resolveCardType(row: { category_key?: unknown; metadata?: Record<string, unknown> | null }) {
  if (isLegacyCreditCard(row)) return "credit_card";
  return String(row.metadata?.card_type ?? "");
}

/** Exactly four digits, nothing more: a full card number is never kept. */
export function cleanLast4(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 4 ? digits : "";
}

/** "MM/YY" or empty. */
export function cleanExpiry(value: unknown) {
  const match = /^\s*(0[1-9]|1[0-2])\s*\/\s*(\d{2}|\d{4})\s*$/.exec(String(value ?? ""));
  return match ? `${match[1]}/${match[2].slice(-2)}` : "";
}

/** True when text looks like a whole card number (13 to 19 digits), which is refused. */
export function looksLikeFullCardNumber(value: unknown) {
  const digits = String(value ?? "").replace(/[\s-]/g, "");
  return /^\d{13,19}$/.test(digits);
}

/** What a card adds to the estimated value: credit balances taken off, gift balances and points value added. */
export function cardEstateSign(cardType: string) {
  if (cardType === "credit_card") return -1;
  if (cardType === "gift_card" || cardType === "loyalty") return 1;
  return 0;
}

/** The card's icon: banks and card issuers first (Amex, Barclaycard), then loyalty and everyday schemes (Nectar). */
export function findCardBrand(name: unknown): { key: string; name: string; logo?: string | null; type?: string } | null {
  const text = String(name ?? "").trim();
  if (!text) return null;
  return findProviderBrand(text) ?? findDigitalBrand(text) ?? null;
}
