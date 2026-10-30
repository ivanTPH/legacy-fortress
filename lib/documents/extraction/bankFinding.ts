import type { BankStatementCandidate } from "../bankStatementExtraction.ts";

export type BankAccountFinding = {
  status: "matches_this_record" | "matches_other_record" | "new_account";
  otherRecordId: string | null;
  page: number;
  display: { provider: string | null; holder: string | null; accountEnding: string | null; sortCodeEnding: string | null; accountType: string | null; closingBalance: string | null; currency: string | null; asOf: string | null };
  prefill: { bank_name: string; account_holder_name: string; account_number: string; sort_code: string; iban: string; bank_account_type: string; bank_account_type_other: string; value_major: string; last_updated_on: string; currency: string };
};

export function bankAccountTypeToken(label: string | null | undefined) {
  const text = String(label ?? "").toLowerCase();
  if (!text) return { token: "", other: "" };
  if (/\bisa\b/.test(text)) return { token: "isa_cash", other: "" };
  if (/sav(?:er|ings?)\b|instant access|easy access/.test(text)) return { token: "savings_account", other: "" };
  if (/\bcurrent\b/.test(text)) return { token: "current_account", other: "" };
  if (/\bjoint\b/.test(text)) return { token: "joint_account", other: "" };
  if (/\bbusiness\b/.test(text)) return { token: "business_account", other: "" };
  if (/deposit|fixed/.test(text)) return { token: "cash_deposit", other: "" };
  return { token: "other_bank_account", other: String(label).trim().slice(0, 60) };
}

export function buildBankAccountFinding(candidate: BankStatementCandidate, match: { status: string; recordIds: string[] }, currentRecordId: string): BankAccountFinding | null {
  const f = candidate.fields;
  if (!f.accountNumber && !f.iban) return null;
  const status = match.recordIds.includes(currentRecordId) ? "matches_this_record" : match.recordIds.length ? "matches_other_record" : "new_account";
  const type = bankAccountTypeToken(f.accountType?.value);
  const ending = (value?: string) => (value ? value.replace(/\W/g, "").slice(-4) : null);
  return {
    status,
    otherRecordId: status === "matches_other_record" ? match.recordIds[0] : null,
    page: (f.accountNumber ?? f.iban)?.page ?? 1,
    display: {
      provider: f.provider?.value ?? null,
      holder: f.accountHolder?.value ?? null,
      accountEnding: ending(f.accountNumber?.value ?? f.iban?.value),
      sortCodeEnding: f.sortCode ? f.sortCode.value.slice(-2) : null,
      accountType: f.accountType?.value ?? null,
      closingBalance: f.closingBalance?.value ?? null,
      currency: f.currency?.value ?? null,
      asOf: f.periodEnd?.value ?? f.statementDate?.value ?? null,
    },
    prefill: {
      bank_name: f.provider?.value ?? "",
      account_holder_name: f.accountHolder?.value ?? "",
      account_number: f.accountNumber?.value ?? "",
      sort_code: f.sortCode?.value ?? "",
      iban: f.iban?.value ?? "",
      bank_account_type: type.token,
      bank_account_type_other: type.other,
      value_major: f.closingBalance?.value ?? "",
      last_updated_on: f.periodEnd?.value ?? f.statementDate?.value ?? "",
      currency: f.currency?.value ?? "",
    },
  };
}
