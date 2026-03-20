export type AssetCategory = {
  id: string;
  label: string;
  icon: string;
  description: string;
  order: number;
  enabled: boolean;
};

export const ASSET_CATEGORIES: AssetCategory[] = [
  {
    id: "legal",
    label: "Legal",
    icon: "gavel",
    description: "Wills, power of attorney, trusts and legal records",
    order: 1,
    enabled: true,
  },
  {
    id: "finances",
    label: "Finances",
    icon: "account_balance",
    description: "Bank accounts, pensions, investments, insurance and financial records",
    order: 2,
    enabled: true,
  },
  {
    id: "personal",
    label: "Personal",
    icon: "person",
    description: "Personal wishes, possessions, digital accounts and identity records",
    order: 3,
    enabled: true,
  },
  {
    id: "properties",
    label: "Properties",
    icon: "home",
    description: "Homes, land, deeds, mortgages and property information",
    order: 4,
    enabled: true,
  },
  {
    id: "business",
    label: "Business",
    icon: "business_center",
    description: "Business interests, shareholdings, partnerships and company records",
    order: 5,
    enabled: true,
  },
  {
    id: "cars-transport",
    label: "Cars & Transport",
    icon: "directions_car",
    description: "Vehicles, transport assets, registrations, finance and related documents",
    order: 6,
    enabled: true,
  },
  {
    id: "employment",
    label: "Employment",
    icon: "work",
    description: "Employment history, benefits, pensions and workplace-related records",
    order: 7,
    enabled: true,
  },
  {
    id: "support",
    label: "Support",
    icon: "support_agent",
    description: "Support records, guidance, service contacts and related help resources",
    order: 8,
    enabled: true,
  },
];

export function getCategoryById(id: string): AssetCategory | undefined {
  return ASSET_CATEGORIES.find((category) => category.id === id);
}

export function getEnabledCategories(): AssetCategory[] {
  return ASSET_CATEGORIES.filter((category) => category.enabled).sort(
    (a, b) => a.order - b.order
  );
}