/**
 * Parses text that has already been extracted inside an approved document processor.
 * This module never reads Storage, persists data, or changes a Vault record.
 */
export type StatementPage = { page: number; text: string };
export type StatementField = {
  value: string;
  page: number;
  evidence: string;
  confidence: "high" | "medium";
};
export type StatementFieldKey =
  | "provider" | "accountName" | "accountHolder" | "accountType"
  | "accountNumber" | "sortCode" | "iban" | "swiftBic"
  | "statementDate" | "periodStart" | "periodEnd"
  | "currency" | "closingBalance";
export type BankStatementCandidate = {
  fields: Partial<Record<StatementFieldKey, StatementField>>;
  warnings: string[];
  requiresOwnerReview: true;
};

const FIELD_PATTERNS: Array<{
  key: StatementFieldKey;
  pattern: RegExp;
  clean?: (value: string) => string | null;
}> = [
  { key: "provider", pattern: /^(?:bank|provider|financial institution)\s*[:：]\s*(.+)$/i },
  { key: "accountName", pattern: /^(?:account name|account nickname)\s*[:：]\s*(.+)$/i },
  { key: "accountHolder", pattern: /^(?:account holder|account holder name|name on account)\s*[:：]\s*(.+)$/i },
  { key: "accountType", pattern: /^(?:account type|type of account)\s*[:：]\s*(.+)$/i },
  { key: "accountNumber", pattern: /^(?:account number|account no\.?|a\/c no\.?)\s*[:：]?\s*([\d ]{6,16})$/i, clean: cleanAccountNumber },
  { key: "sortCode", pattern: /^sort[ -]?code\s*[:：]?\s*(\d{2}[ -]?\d{2}[ -]?\d{2})$/i, clean: cleanSortCode },
  { key: "iban", pattern: /^IBAN\s*[:：]?\s*([A-Z]{2}\d{2}[A-Z\d ]{11,32})$/i, clean: cleanIban },
  { key: "swiftBic", pattern: /^(?:SWIFT(?:\s*\/\s*BIC)?|BIC)\s*[:：]?\s*([A-Z]{4}[A-Z]{2}[A-Z\d]{2}(?:[A-Z\d]{3})?)$/i, clean: cleanBic },
  { key: "statementDate", pattern: /^(?:statement date|date of statement)\s*[:：]\s*(.+)$/i, clean: cleanDate },
  { key: "periodStart", pattern: /^(?:period start|from date)\s*[:：]\s*(.+)$/i, clean: cleanDate },
  { key: "periodEnd", pattern: /^(?:period end|to date)\s*[:：]\s*(.+)$/i, clean: cleanDate },
];

export function extractBankStatementCandidate(pages: StatementPage[]): BankStatementCandidate {
  const candidates = new Map<StatementFieldKey, StatementField[]>();
  const warnings = new Set<string>();
  for (const page of pages.slice(0, 20)) {
    if (!Number.isInteger(page.page) || page.page < 1) continue;
    for (const rawLine of page.text.split(/\r?\n/).slice(0, 1000)) {
      const line = rawLine.replace(/\s+/g, " ").trim();
      if (!line || line.length > 240) continue;
      for (const { key, pattern, clean } of FIELD_PATTERNS) {
        const match = line.match(pattern);
        if (!match) continue;
        const value = clean ? clean(match[1]) : cleanLabel(match[1]);
        if (value) add(candidates, key, { value, page: page.page, evidence: line, confidence: "high" });
      }
      // Unlabelled or combined lines, e.g. "Sort code 20-45-77   Account number 41207781".
      const inlineSort = line.match(/\bsort[ -]?code\s*[:：]?\s*(\d{2}[ -]?\d{2}[ -]?\d{2})\b/i);
      if (inlineSort) { const value = cleanSortCode(inlineSort[1]); if (value) add(candidates, "sortCode", { value, page: page.page, evidence: line, confidence: "high" }); }
      const inlineAccount = line.match(/\b(?:account (?:number|no\.?)|a\/c no\.?)\s*[:：]?\s*(\d[\d ]{4,14}\d)\b/i);
      if (inlineAccount) { const value = cleanAccountNumber(inlineAccount[1]); if (value) add(candidates, "accountNumber", { value, page: page.page, evidence: line, confidence: "high" }); }
      const holder = line.match(/^(?:statement for|prepared for)\s*[:：]\s*(.+)$/i);
      if (holder) { const value = cleanLabel(holder[1].replace(/^(?:mr|mrs|ms|miss|mx|dr)\.?\s+/i, "")); if (value) add(candidates, "accountHolder", { value, page: page.page, evidence: line, confidence: "medium" }); }
      const period = line.match(/^(?:statement\s+)?period\s*[:：]\s*(.+?)\s+(?:to|–|—)\s+(.+)$/i);
      if (period) {
        const start = cleanDate(period[1]);
        const end = cleanDate(period[2]);
        if (start && end && start <= end) {
          add(candidates, "periodStart", { value: start, page: page.page, evidence: line, confidence: "high" });
          add(candidates, "periodEnd", { value: end, page: page.page, evidence: line, confidence: "high" });
        }
      }
      const balance = line.match(/^(?:closing|final|end(?:ing)?)(?:\s+account)?\s+balance\s*[:：]?\s*(CR|DR)?\s*(-)?\s*(£|€|\$|GBP|EUR|USD)\s*([\d,]+\.\d{2})\s*(CR|DR)?$/i);
      if (balance) {
        const currency = ({ "£": "GBP", "€": "EUR", "$": "USD" } as Record<string, string>)[balance[3]] ?? balance[3].toUpperCase();
        const debit = Boolean(balance[2]) || [balance[1], balance[5]].some((value) => value?.toUpperCase() === "DR");
        const credit = [balance[1], balance[5]].some((value) => value?.toUpperCase() === "CR");
        if (!(debit && credit)) {
          const amount = Number(balance[4].replaceAll(",", ""));
          if (Number.isFinite(amount)) {
            add(candidates, "currency", { value: currency, page: page.page, evidence: line, confidence: "high" });
            add(candidates, "closingBalance", { value: `${debit ? "-" : ""}${amount.toFixed(2)}`, page: page.page, evidence: line, confidence: "high" });
          }
        }
      }
      const currency = line.match(/^currency\s*[:：]\s*(GBP|EUR|USD)$/i);
      if (currency) add(candidates, "currency", { value: currency[1].toUpperCase(), page: page.page, evidence: line, confidence: "high" });
    }
  }

  if (!candidates.has("provider")) {
    const first = pages.find((page) => page.page === 1);
    const heading = first?.text.split(/\r?\n/).slice(0, 6).map((line) => line.replace(/\s+/g, " ").trim())
      .find((line) => line.length <= 60 && !/\d/.test(line) && /\b(?:bank|building society|nationwide|monzo|starling|revolut|halifax|santander|barclays|lloyds|natwest|hsbc|metro)\b/i.test(line));
    if (heading && first) add(candidates, "provider", { value: heading.replace(/\s+(?:plc|limited|ltd|uk)\.?$/i, ""), page: 1, evidence: heading, confidence: "medium" });
  }

  const fields: BankStatementCandidate["fields"] = {};
  for (const [key, matches] of candidates) {
    const values = new Set(matches.map((match) => match.value));
    if (values.size === 1) fields[key] = matches[0];
    else warnings.add(`conflicting_${key}`);
  }
  if (!pages.some((page) => page.text.trim())) warnings.add("no_digital_text");
  if (!fields.accountNumber && !fields.iban) warnings.add("account_identifier_not_found");
  if (!fields.statementDate && !fields.periodEnd) warnings.add("statement_date_not_found");
  return { fields, warnings: [...warnings], requiresOwnerReview: true };
}

function add(map: Map<StatementFieldKey, StatementField[]>, key: StatementFieldKey, field: StatementField) {
  map.set(key, [...(map.get(key) ?? []), field]);
}

function cleanLabel(value: string) {
  const text = value.trim();
  return text && text.length <= 100 ? text : null;
}

function cleanAccountNumber(value: string) {
  const digits = value.replaceAll(" ", "");
  return /^\d{6,10}$/.test(digits) ? digits : null;
}

function cleanSortCode(value: string) {
  const digits = value.replace(/\D/g, "");
  return /^\d{6}$/.test(digits) ? digits.replace(/^(\d{2})(\d{2})(\d{2})$/, "$1-$2-$3") : null;
}

function cleanIban(value: string) {
  const iban = value.replaceAll(" ", "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z\d]{11,30}$/.test(iban)) return null;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = /\d/.test(char) ? char : String(char.charCodeAt(0) - 55);
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1 ? iban : null;
}

function cleanBic(value: string) {
  const bic = value.toUpperCase();
  return /^[A-Z]{4}[A-Z]{2}[A-Z\d]{2}(?:[A-Z\d]{3})?$/.test(bic) ? bic : null;
}

function cleanDate(value: string) {
  const text = value.trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const uk = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  const named = text.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  let year: number, month: number, day: number;
  if (iso) [, year, month, day] = iso.map(Number);
  else if (uk) { day = Number(uk[1]); month = Number(uk[2]); year = Number(uk[3]); }
  else if (named) {
    day = Number(named[1]); year = Number(named[3]);
    month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(named[2].slice(0, 3).toLowerCase()) + 1;
  } else return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
    ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;
}
