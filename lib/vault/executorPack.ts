/**
 * Executor pack (stage 4, 20 Nov 2026): a printable summary the owner can save as a PDF and keep with their Will or
 * hand to their executors. It says WHAT exists and WHERE to look (the provider), never the keys to it: account,
 * policy, member and reference numbers, addresses, dates of birth and other sensitive fields are always left out, and
 * estimated values only appear if the owner ticks "Include estimated values". Owner-only: built in the browser from
 * the owner's own rows under their own row-level security. Nothing is stored or sent.
 */
import { brandChangeNote } from "../assets/providerBrands.mjs";
import { AFTER_DEATH_OPTIONS, DIRECT_DEBIT_CATEGORY, PAYMENT_FREQUENCY_OPTIONS, optionLabel } from "./directDebits.ts";
export type PackSourceRow = {
  id: string;
  section_key: string | null;
  category_key: string | null;
  title: string | null;
  status?: string | null;
  archived_at?: string | null;
  deleted_at?: string | null;
  metadata?: Record<string, unknown> | null;
  provider_name?: string | null;
  value_minor?: number | null;
  currency_code?: string | null;
};
export type PackPerson = { name: string; role: string | null; relationship?: string | null; joined?: boolean };
export type PackItem = { id: string; title: string; type: string | null; provider: string | null; documents: number; value: string | null; brandNote?: string | null };
export type PackSection = { key: string; heading: string; items: PackItem[] };
export type ExecutorPack = {
  ownerName: string;
  preparedOn: string;
  sections: PackSection[];
  executors: PackPerson[];
  attorneys: PackPerson[];
  willNote: string;
  totals: { records: number; documents: number };
};

const SECTION_ORDER: Array<[string, string]> = [
  ["legal", "Legal"], ["finances", "Money"], ["property", "Property"], ["business", "Business"],
  ["digital", "Digital"], ["personal", "Possessions"], ["possessions", "Possessions"],
  // Direct debits get their own list, with what the owner wants done to each (26 Nov 2026).
  ["payments", "Payments to cancel, transfer or keep paying"],
];
const EXCLUDED_CATEGORIES = new Set(["executors", "beneficiaries", "tasks", "next-of-kin", "help_requests", "help_replies"]);
const EXCLUDED_SECTIONS = new Set(["support", "vault"]);
/** Where to look, by the field each form uses for the organisation behind a record. */
const PROVIDER_KEYS = ["provider_name", "bank_name", "institution_name", "pension_provider", "insurer_name", "creditor_name", "mortgage_lender", "platform_provider", "solicitor_name", "firm_name", "provider"];
const TYPE_KEYS = ["account_type", "pension_type", "policy_type", "debt_type", "property_type", "business_type", "digital_asset_type", "identity_document_type", "document_type"];
/** Never printed, whatever the form calls them. */
export const NEVER_PRINTED = /(number|sort_code|iban|reference|address|date_of_birth|password|pin|secret|recovery|wallet|registration)/i;

function words(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "__other") return null;
  const text = raw.replace(/[_-]+/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function pick(meta: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (NEVER_PRINTED.test(key)) continue;
    const value = words(meta[key]);
    if (value) return value.slice(0, 80);
  }
  return null;
}

function money(value: unknown, currency: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const code = /^[A-Z]{3}$/.test(String(currency ?? "")) ? String(currency) : "GBP";
  try { return new Intl.NumberFormat("en-GB", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(amount); } catch { return `${Math.round(amount)}`; }
}

export function buildExecutorPack(input: {
  ownerName: string;
  rows: PackSourceRow[];
  documentCounts: Map<string, number>;
  people: PackPerson[];
  includeValues?: boolean;
  now?: Date;
}): ExecutorPack {
  const now = input.now ?? new Date();
  const live = input.rows.filter((row) => !row.deleted_at && !row.archived_at && row.status !== "archived"
    && !EXCLUDED_SECTIONS.has(String(row.section_key ?? "")) && !EXCLUDED_CATEGORIES.has(String(row.category_key ?? "")));
  const groups = new Map<string, PackItem[]>();
  for (const row of live) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const section = String(row.section_key ?? "other");
    const isPayment = row.category_key === DIRECT_DEBIT_CATEGORY;
    const key = isPayment ? "payments" : section === "possessions" ? "personal" : section;
    const item: PackItem = {
      id: row.id,
      title: String(row.title ?? "").trim().slice(0, 120) || words(row.category_key) || "Record",
      type: pick(meta, TYPE_KEYS) ?? words(row.category_key),
      provider: (String(row.provider_name ?? "").trim().slice(0, 80) || null) ?? pick(meta, PROVIDER_KEYS),
      documents: input.documentCounts.get(row.id) ?? 0,
      brandNote: null,
      value: input.includeValues ? money(row.value_minor ? Number(row.value_minor) / 100 : meta.estimated_value, row.currency_code ?? meta.currency) : null,
    };
    if (isPayment) {
      item.type = optionLabel(AFTER_DEATH_OPTIONS, meta.payment_after_death) ?? "Not decided yet";
      item.provider = null;
      const amount = money(meta.payment_amount, meta.currency ?? row.currency_code);
      const often = optionLabel(PAYMENT_FREQUENCY_OPTIONS, meta.payment_frequency)?.toLowerCase();
      item.value = input.includeValues && amount ? [amount, often].filter(Boolean).join(" ") : null;
    }
    item.brandNote = brandChangeNote(item.provider ?? item.title);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const known = new Map(SECTION_ORDER);
  const order = [...new Set([...SECTION_ORDER.map(([key]) => key), ...groups.keys()])];
  const sections = order.filter((key) => groups.get(key)?.length).map((key) => ({
    key,
    heading: known.get(key) ?? words(key) ?? "Other",
    items: (groups.get(key) ?? []).sort((a, b) => String(a.type).localeCompare(String(b.type)) || a.title.localeCompare(b.title)),
  }));
  const role = (pattern: RegExp) => input.people.filter((person) => pattern.test(String(person.role ?? "")));
  const wills = live.filter((row) => /will/i.test(String(row.category_key ?? "")));
  const willDocs = wills.reduce((sum, row) => sum + (input.documentCounts.get(row.id) ?? 0), 0);
  return {
    ownerName: input.ownerName.trim() || "Me",
    preparedOn: now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    sections,
    executors: role(/executor|executrix/i),
    attorneys: role(/attorney/i),
    willNote: !wills.length
      ? "No Will is recorded in Legacy Fortress yet."
      : willDocs
        ? `A copy of the Will is stored in Legacy Fortress (${willDocs} ${willDocs === 1 ? "document" : "documents"}). The signed original is the one that counts: keep a note of where it is.`
        : "A Will is recorded in Legacy Fortress, without a copy attached. The signed original is the one that counts: keep a note of where it is.",
    totals: { records: live.length, documents: live.reduce((sum, row) => sum + (input.documentCounts.get(row.id) ?? 0), 0) },
  };
}

export function firstSteps(siteUrl: string) {
  const site = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return [
    "Get the medical certificate of cause of death and register the death (within 5 days in England and Wales).",
    "Use Tell Us Once, if offered, to let government departments know.",
    "Find the original signed Will and check who the executors are.",
    "Contact each organisation listed here. Most have a bereavement team and will ask for a copy of the death certificate.",
    `Report the death to Legacy Fortress at ${site}/estate/report-death. Once it has been checked, you receive the access the owner chose for you.`,
  ];
}
