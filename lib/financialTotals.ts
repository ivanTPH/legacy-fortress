export type FinancialTotalEntry = {
  account_type: string;
  balance: number;
};

export type FinancialTotals = {
  assets: number;
  liabilities: number;
  net: number;
};

export function computeFinancialTotals(entries: FinancialTotalEntry[]): FinancialTotals {
  const assets = entries
    .filter((entry) => entry.account_type !== "liability")
    .reduce((sum, entry) => sum + Number(entry.balance || 0), 0);

  const liabilities = entries
    .filter((entry) => entry.account_type === "liability")
    .reduce((sum, entry) => sum + Math.abs(Number(entry.balance || 0)), 0);

  return {
    assets,
    liabilities,
    net: assets - liabilities,
  };
}
