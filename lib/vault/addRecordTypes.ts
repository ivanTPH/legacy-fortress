export type AddRecordChoice = {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: string;
  ariaLabel: string;
};

export const FINANCE_RECORD_CHOICES: AddRecordChoice[] = [
  { key: "bank", label: "Bank account", description: "Current, savings and other bank accounts.", href: "/finances/bank?add=1", icon: "account_balance", ariaLabel: "Add bank account" },
  { key: "pensions", label: "Pension", description: "State, workplace and private pensions.", href: "/finances/pensions?add=1", icon: "savings", ariaLabel: "Add pension" },
  { key: "investments", label: "Investment", description: "Portfolios, funds and investment platforms.", href: "/finances/investments?add=1", icon: "trending_up", ariaLabel: "Add investment" },
  { key: "insurance", label: "Insurance", description: "Life and protection policies.", href: "/finances/insurance?add=1", icon: "health_and_safety", ariaLabel: "Add insurance policy" },
  { key: "debts", label: "Debt", description: "Liabilities and repayment obligations.", href: "/finances/debts?add=1", icon: "credit_card", ariaLabel: "Add debt" },
];

export function getAddRecordChoices(category: string) {
  if (category === "finances") return FINANCE_RECORD_CHOICES;
  return [];
}

export const FINANCE_CATEGORY_CHOICE = {
  label: "Finances",
  description: "Bank accounts, pensions, investments, insurance and debts.",
  href: "/finances?add=1",
  icon: "account_balance",
};
