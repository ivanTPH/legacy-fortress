export type AssetType = {
  id: string;
  label: string;
  categoryId: string;
  description: string;
  icon: string;
  enabled: boolean;
};

export const ASSET_TYPES: AssetType[] = [

  // FINANCES

  {
    id: "bank-account",
    label: "Bank Account",
    categoryId: "finances",
    icon: "account_balance",
    description: "Current accounts, savings accounts and banking records",
    enabled: true,
  },

  {
    id: "investment",
    label: "Investment",
    categoryId: "finances",
    icon: "trending_up",
    description: "Stocks, bonds, funds and investment portfolios",
    enabled: true,
  },

  {
    id: "pension",
    label: "Pension",
    categoryId: "finances",
    icon: "savings",
    description: "Private pensions, workplace pensions and retirement funds",
    enabled: true,
  },

  {
    id: "insurance-policy",
    label: "Insurance Policy",
    categoryId: "finances",
    icon: "health_and_safety",
    description: "Life, home, car and other insurance policies",
    enabled: true,
  },

  // LEGAL

  {
    id: "will",
    label: "Will",
    categoryId: "legal",
    icon: "gavel",
    description: "Last will and testament documents",
    enabled: true,
  },

  {
    id: "power-of-attorney",
    label: "Power of Attorney",
    categoryId: "legal",
    icon: "assignment_ind",
    description: "Power of attorney documentation",
    enabled: true,
  },

  {
    id: "trust",
    label: "Trust",
    categoryId: "legal",
    icon: "account_balance_wallet",
    description: "Trust arrangements and trust documentation",
    enabled: true,
  },

  // PROPERTIES

  {
    id: "property",
    label: "Property",
    categoryId: "properties",
    icon: "home",
    description: "Houses, land and property ownership records",
    enabled: true,
  },

  // BUSINESS

  {
    id: "business-interest",
    label: "Business Interest",
    categoryId: "business",
    icon: "business",
    description: "Ownership stakes in companies or partnerships",
    enabled: true,
  },

  // VEHICLES

  {
    id: "vehicle",
    label: "Vehicle",
    categoryId: "cars-transport",
    icon: "directions_car",
    description: "Cars, motorcycles and other vehicles",
    enabled: true,
  },

  // PERSONAL

  {
    id: "possession",
    label: "Possession",
    categoryId: "personal",
    icon: "diamond",
    description: "Valuable personal possessions such as watches or jewellery",
    enabled: true,
  },

  {
    id: "digital-account",
    label: "Digital Account",
    categoryId: "personal",
    icon: "language",
    description: "Online accounts and digital identities",
    enabled: true,
  },

  // EMPLOYMENT

  {
    id: "employment-record",
    label: "Employment Record",
    categoryId: "employment",
    icon: "work",
    description: "Employment history and workplace documentation",
    enabled: true,
  }

];

export function getAssetTypesByCategory(categoryId: string): AssetType[] {
  return ASSET_TYPES.filter((type) => type.categoryId === categoryId && type.enabled);
}

export function getAssetTypeById(id: string): AssetType | undefined {
  return ASSET_TYPES.find((type) => type.id === id);
}