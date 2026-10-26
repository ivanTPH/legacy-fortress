import type { BankStatementCandidate } from "./bankStatementExtraction";

/** Trusted server callers must supply only records already authorised for this owner. */
export type AuthorisedBankRecord = {
  id: string;
  ownerUserId: string;
  accountNumber?: string | null;
  sortCode?: string | null;
  iban?: string | null;
};

export function matchBankStatementToAuthorisedAccounts(
  candidate: BankStatementCandidate,
  ownerUserId: string,
  authorisedRecords: AuthorisedBankRecord[],
) {
  const accountNumber = digits(candidate.fields.accountNumber?.value);
  const sortCode = digits(candidate.fields.sortCode?.value);
  const iban = compact(candidate.fields.iban?.value);
  if (!ownerUserId || (!iban && !(accountNumber && sortCode))) {
    return { status: "insufficient_evidence" as const, recordIds: [] as string[] };
  }

  const recordIds = authorisedRecords
    .filter((record) => record.ownerUserId === ownerUserId)
    .filter((record) =>
      (iban && iban === compact(record.iban))
      || (accountNumber && sortCode && accountNumber === digits(record.accountNumber) && sortCode === digits(record.sortCode)),
    )
    .map((record) => record.id);
  return {
    status: recordIds.length === 1 ? "exact_match" as const : recordIds.length > 1 ? "ambiguous" as const : "no_match" as const,
    recordIds,
  };
}

function compact(value: string | null | undefined) {
  return String(value ?? "").replace(/\s/g, "").toUpperCase();
}

function digits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}
