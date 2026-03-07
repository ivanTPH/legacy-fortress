export type Option = { value: string; label: string };

export const personalPossessionCategories: Option[] = [
  { value: "watches", label: "Watches" },
  { value: "jewellery", label: "Jewellery" },
  { value: "cars_vehicles", label: "Cars / Vehicles" },
  { value: "household_contents", label: "Household contents" },
  { value: "collectibles", label: "Collectibles" },
  { value: "art", label: "Art" },
  { value: "electronics", label: "Electronics" },
  { value: "documents_memorabilia", label: "Documents / memorabilia" },
  { value: "pets", label: "Pets" },
  { value: "other", label: "Other" },
];

export const personalPossessionSubcategories: Record<string, Option[]> = {
  watches: [
    { value: "mechanical", label: "Mechanical" },
    { value: "smart_watch", label: "Smart watch" },
    { value: "vintage", label: "Vintage" },
    { value: "other", label: "Other" },
  ],
  jewellery: [
    { value: "rings", label: "Rings" },
    { value: "necklaces", label: "Necklaces" },
    { value: "bracelets", label: "Bracelets" },
    { value: "other", label: "Other" },
  ],
  cars_vehicles: [
    { value: "owned_vehicle", label: "Owned vehicle" },
    { value: "financed_vehicle", label: "Financed vehicle" },
    { value: "other_vehicle", label: "Other vehicle" },
    { value: "other", label: "Other" },
  ],
  household_contents: [
    { value: "furniture", label: "Furniture" },
    { value: "appliances", label: "Appliances" },
    { value: "decor", label: "Decor" },
    { value: "other", label: "Other" },
  ],
  collectibles: [
    { value: "coins", label: "Coins" },
    { value: "stamps", label: "Stamps" },
    { value: "sports_memorabilia", label: "Sports memorabilia" },
    { value: "other", label: "Other" },
  ],
  art: [
    { value: "painting", label: "Painting" },
    { value: "sculpture", label: "Sculpture" },
    { value: "print", label: "Print" },
    { value: "other", label: "Other" },
  ],
  electronics: [
    { value: "phone", label: "Phone" },
    { value: "laptop", label: "Laptop" },
    { value: "camera", label: "Camera" },
    { value: "other", label: "Other" },
  ],
  documents_memorabilia: [
    { value: "certificate", label: "Certificate" },
    { value: "letters", label: "Letters" },
    { value: "family_archive", label: "Family archive" },
    { value: "other", label: "Other" },
  ],
};

export const propertyTypeOptions: Option[] = [
  { value: "home", label: "Home" },
  { value: "rental", label: "Rental property" },
  { value: "commercial", label: "Commercial property" },
  { value: "land", label: "Land" },
  { value: "foreign_property", label: "Foreign property" },
  { value: "timeshare", label: "Timeshare" },
  { value: "other", label: "Other" },
];

export const financialTypeOptions: Option[] = [
  { value: "bank", label: "Bank account" },
  { value: "savings", label: "Savings" },
  { value: "investment", label: "Investment" },
  { value: "pension", label: "Pension" },
  { value: "insurance", label: "Insurance policy" },
  { value: "crypto", label: "Crypto" },
  { value: "liability", label: "Liability / debt" },
  { value: "other", label: "Other" },
];

export const financialSubtypes: Record<string, Option[]> = {
  pension: [
    { value: "state_pension", label: "State pension" },
    { value: "private_pension", label: "Private pension" },
    { value: "public_sector_pension", label: "Public sector pension" },
    { value: "other", label: "Other" },
  ],
  investment: [
    { value: "shares", label: "Share portfolio" },
    { value: "isa", label: "ISA" },
    { value: "premium_bonds", label: "Premium bonds" },
    { value: "other", label: "Other" },
  ],
  insurance: [
    { value: "life_insurance", label: "Life insurance" },
    { value: "income_protection", label: "Income protection" },
    { value: "critical_illness", label: "Critical illness" },
    { value: "other", label: "Other" },
  ],
};

export const legalTypeOptions: Option[] = [
  { value: "will", label: "Will" },
  { value: "lpa", label: "Power of Attorney" },
  { value: "insurance", label: "Insurance" },
  { value: "property", label: "Property documents" },
  { value: "tax", label: "Tax documents" },
  { value: "funeral", label: "Funeral wishes" },
  { value: "business", label: "Business documents" },
  { value: "benefits", label: "Benefits" },
  { value: "student_loan", label: "Student loan" },
  { value: "other", label: "Other" },
];

export const legalSubtypes: Record<string, Option[]> = {
  property: [
    { value: "deeds", label: "Deeds" },
    { value: "mortgage", label: "Mortgage" },
    { value: "council_tax", label: "Council tax" },
    { value: "utilities", label: "Utilities" },
    { value: "other", label: "Other" },
  ],
  business: [
    { value: "companies_house", label: "Companies House" },
    { value: "vat_paye", label: "VAT / PAYE / Tax" },
    { value: "advisor_details", label: "Advisor details" },
    { value: "other", label: "Other" },
  ],
};

export const businessTypeOptions: Option[] = [
  { value: "company", label: "Company" },
  { value: "partnership", label: "Partnership" },
  { value: "sole_trader", label: "Sole trader" },
  { value: "shareholding", label: "Shareholding only" },
  { value: "other", label: "Other" },
];

export const businessSubtypes: Record<string, Option[]> = {
  company: [
    { value: "limited_company", label: "Limited company" },
    { value: "llp", label: "LLP" },
    { value: "other", label: "Other" },
  ],
  partnership: [
    { value: "general_partnership", label: "General partnership" },
    { value: "limited_partnership", label: "Limited partnership" },
    { value: "other", label: "Other" },
  ],
};

export const digitalCategoryOptions: Option[] = [
  { value: "email", label: "Email" },
  { value: "social", label: "Social" },
  { value: "subscription", label: "Subscriptions" },
  { value: "cloud", label: "Cloud" },
  { value: "domains", label: "Domains" },
  { value: "devices", label: "Devices" },
  { value: "crypto_access", label: "Crypto access note" },
  { value: "finance", label: "Financial service" },
  { value: "other", label: "Other" },
];

export const digitalSubcategories: Record<string, Option[]> = {
  social: [
    { value: "facebook", label: "Facebook" },
    { value: "instagram", label: "Instagram" },
    { value: "x", label: "X / Twitter" },
    { value: "other", label: "Other" },
  ],
  cloud: [
    { value: "google_drive", label: "Google Drive" },
    { value: "icloud", label: "iCloud" },
    { value: "dropbox", label: "Dropbox" },
    { value: "other", label: "Other" },
  ],
  devices: [
    { value: "phone", label: "Phone" },
    { value: "laptop", label: "Laptop" },
    { value: "tablet", label: "Tablet" },
    { value: "other", label: "Other" },
  ],
  subscription: [
    { value: "streaming", label: "Streaming" },
    { value: "software", label: "Software" },
    { value: "utility", label: "Utility" },
    { value: "other", label: "Other" },
  ],
};

export function optionLabel(options: Option[], value: string, fallback = "Other") {
  return options.find((option) => option.value === value)?.label ?? fallback;
}
