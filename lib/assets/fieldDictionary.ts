export type AssetFieldType =
  | "text"
  | "textarea"
  | "select"
  | "number"
  | "currency"
  | "date"
  | "toggle"
  | "file";

export type AssetFieldOption = {
  label: string;
  value: string;
};

export type AssetFieldValidationRule = {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  message?: string;
};

export type AssetFieldConfig = {
  key: string;
  label: string;
  iconName?: string;
  inputType: AssetFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: AssetFieldOption[];
  supportsOther?: boolean;
  otherKey?: string;
  validationRules?: AssetFieldValidationRule;
  defaultValue?: string;
  extractionSupported?: boolean;
  sensitive?: boolean;
  contributesToCompleteness?: boolean;
};

export type AssetCategoryFormConfig = {
  categorySlug: string;
  title: string;
  fields: AssetFieldConfig[];
};

export const COUNTRY_OPTIONS: AssetFieldOption[] = [
  { label: "United Kingdom", value: "UK" },
  { label: "United States", value: "US" },
  { label: "Ireland", value: "IE" },
  { label: "Germany", value: "DE" },
  { label: "France", value: "FR" },
  { label: "Spain", value: "ES" },
  { label: "Italy", value: "IT" },
  { label: "Netherlands", value: "NL" },
  { label: "Canada", value: "CA" },
  { label: "Australia", value: "AU" },
  { label: "Other", value: "__other" },
];

export const CURRENCY_OPTIONS: AssetFieldOption[] = [
  { label: "GBP", value: "GBP" },
  { label: "USD", value: "USD" },
  { label: "EUR", value: "EUR" },
  { label: "CAD", value: "CAD" },
  { label: "AUD", value: "AUD" },
  { label: "JPY", value: "JPY" },
  { label: "CHF", value: "CHF" },
  { label: "SGD", value: "SGD" },
  { label: "Other", value: "__other" },
];

export const ACCOUNT_TYPE_OPTIONS: AssetFieldOption[] = [
  { label: "Current Account", value: "current_account" },
  { label: "Savings Account", value: "savings_account" },
  { label: "Business Account", value: "business_account" },
  { label: "Joint Account", value: "joint_account" },
  { label: "ISA", value: "isa" },
  { label: "Fixed Deposit / Term Deposit", value: "fixed_deposit_term_deposit" },
  { label: "Investment Account", value: "investment_account" },
  { label: "Other", value: "__other" },
];

export const PENSION_TYPE_OPTIONS: AssetFieldOption[] = [
  { label: "Workplace pension", value: "workplace" },
  { label: "Personal pension", value: "personal" },
  { label: "SIPP", value: "sipp" },
  { label: "Defined benefit", value: "defined_benefit" },
  { label: "Other", value: "__other" },
];

export const INSURANCE_TYPE_OPTIONS: AssetFieldOption[] = [
  { label: "Life", value: "life" },
  { label: "Health", value: "health" },
  { label: "Home", value: "home" },
  { label: "Car", value: "car" },
  { label: "Other", value: "__other" },
];

export const DEBT_TYPE_OPTIONS: AssetFieldOption[] = [
  { label: "Credit card", value: "credit_card" },
  { label: "Loan", value: "loan" },
  { label: "Mortgage", value: "mortgage" },
  { label: "Overdraft", value: "overdraft" },
  { label: "Other", value: "__other" },
];

export const PROPERTY_TYPE_OPTIONS: AssetFieldOption[] = [
  { label: "Residential home", value: "residential" },
  { label: "Rental property", value: "rental" },
  { label: "Commercial property", value: "commercial" },
  { label: "Land / plot", value: "land" },
  { label: "Foreign property", value: "foreign_property" },
  { label: "Other", value: "__other" },
];

export const PROPERTY_OWNERSHIP_OPTIONS: AssetFieldOption[] = [
  { label: "Sole ownership", value: "sole" },
  { label: "Joint ownership", value: "joint" },
  { label: "Tenants in common", value: "tenants_in_common" },
  { label: "Trust", value: "trust" },
  { label: "Company owned", value: "company" },
  { label: "Other", value: "__other" },
];

export const MORTGAGE_STATUS_OPTIONS: AssetFieldOption[] = [
  { label: "No mortgage", value: "none" },
  { label: "Repayment mortgage", value: "repayment" },
  { label: "Interest only", value: "interest_only" },
  { label: "Offset mortgage", value: "offset" },
  { label: "Other", value: "__other" },
];

export const BUSINESS_TYPE_OPTIONS: AssetFieldOption[] = [
  { label: "Limited company", value: "limited_company" },
  { label: "Partnership", value: "partnership" },
  { label: "Sole trader", value: "sole_trader" },
  { label: "LLP", value: "llp" },
  { label: "Holding company", value: "holding_company" },
  { label: "Trust / vehicle", value: "trust" },
  { label: "Other", value: "__other" },
];

export const BUSINESS_STATUS_OPTIONS: AssetFieldOption[] = [
  { label: "Active", value: "active" },
  { label: "Dormant", value: "dormant" },
  { label: "Sold", value: "sold" },
  { label: "Winding down", value: "winding_down" },
  { label: "Exited", value: "exited" },
  { label: "Other", value: "__other" },
];

export const DIGITAL_ASSET_TYPE_OPTIONS: AssetFieldOption[] = [
  { label: "Exchange account", value: "exchange_account" },
  { label: "Custodial wallet", value: "custodial_wallet" },
  { label: "Self-custody wallet", value: "self_custody_wallet" },
  { label: "Domain name", value: "domain_name" },
  { label: "Creator account", value: "creator_account" },
  { label: "Cloud storage", value: "cloud_storage" },
  { label: "Other", value: "__other" },
];

export const DIGITAL_STATUS_OPTIONS: AssetFieldOption[] = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Locked", value: "locked" },
  { label: "Closed", value: "closed" },
  { label: "Unknown", value: "unknown" },
  { label: "Other", value: "__other" },
];

export const BENEFICIARY_RELATIONSHIP_OPTIONS: AssetFieldOption[] = [
  { label: "Spouse / partner", value: "spouse_partner" },
  { label: "Child", value: "child" },
  { label: "Grandchild", value: "grandchild" },
  { label: "Sibling", value: "sibling" },
  { label: "Parent", value: "parent" },
  { label: "Friend", value: "friend" },
  { label: "Charity", value: "charity" },
  { label: "Trust", value: "trust" },
  { label: "Other", value: "__other" },
];

export const BENEFICIARY_TYPE_OPTIONS: AssetFieldOption[] = [
  { label: "Individual", value: "individual" },
  { label: "Charity", value: "charity" },
  { label: "Trust", value: "trust" },
  { label: "Organisation", value: "organisation" },
  { label: "Estate", value: "estate" },
  { label: "Other", value: "__other" },
];

export const BENEFICIARY_STATUS_OPTIONS: AssetFieldOption[] = [
  { label: "Primary", value: "primary" },
  { label: "Contingent", value: "contingent" },
  { label: "Minor", value: "minor" },
  { label: "Deceased", value: "deceased" },
  { label: "Revoked", value: "revoked" },
  { label: "Other", value: "__other" },
];

export const EXECUTOR_TYPE_OPTIONS: AssetFieldOption[] = [
  { label: "Executor", value: "executor" },
  { label: "Co-executor", value: "co_executor" },
  { label: "Solicitor", value: "solicitor" },
  { label: "Professional adviser", value: "professional_adviser" },
  { label: "Guardian", value: "guardian" },
  { label: "Trusted contact", value: "trusted_contact" },
  { label: "Other", value: "__other" },
];

export const EXECUTOR_RELATIONSHIP_OPTIONS: AssetFieldOption[] = [
  { label: "Spouse / partner", value: "spouse_partner" },
  { label: "Child", value: "child" },
  { label: "Sibling", value: "sibling" },
  { label: "Parent", value: "parent" },
  { label: "Friend", value: "friend" },
  { label: "Adviser", value: "adviser" },
  { label: "Solicitor", value: "solicitor" },
  { label: "Other family", value: "other_family" },
  { label: "Other", value: "__other" },
];

export const EXECUTOR_AUTHORITY_OPTIONS: AssetFieldOption[] = [
  { label: "Primary", value: "primary" },
  { label: "Joint", value: "joint" },
  { label: "Backup", value: "backup" },
  { label: "Limited", value: "limited" },
  { label: "Informational", value: "informational" },
  { label: "Other", value: "__other" },
];

export const EXECUTOR_STATUS_OPTIONS: AssetFieldOption[] = [
  { label: "Active", value: "active" },
  { label: "Pending", value: "pending" },
  { label: "Declined", value: "declined" },
  { label: "Retired", value: "retired" },
  { label: "Deceased", value: "deceased" },
  { label: "Other", value: "__other" },
];

export const TASK_PRIORITY_OPTIONS: AssetFieldOption[] = [
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
  { label: "Other", value: "__other" },
];

export const TASK_STATUS_OPTIONS: AssetFieldOption[] = [
  { label: "Not started", value: "not_started" },
  { label: "In progress", value: "in_progress" },
  { label: "Waiting", value: "waiting" },
  { label: "Completed", value: "completed" },
  { label: "Blocked", value: "blocked" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Other", value: "__other" },
];

export const COUNTRY_TO_CURRENCY_DEFAULT: Record<string, string> = {
  UK: "GBP",
  US: "USD",
  IE: "EUR",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  CA: "CAD",
  AU: "AUD",
};

function field(config: AssetFieldConfig): AssetFieldConfig {
  return {
    extractionSupported: true,
    contributesToCompleteness: config.required,
    ...config,
  };
}

const SHARED_TITLE = field({
  key: "title",
  label: "Record title",
  iconName: "title",
  inputType: "text",
  required: true,
  placeholder: "Enter title",
  validationRules: { minLength: 2, message: "Record title is required." },
});

const SHARED_CURRENCY = field({
  key: "currency",
  label: "Currency",
  iconName: "currency_exchange",
  inputType: "select",
  required: true,
  options: CURRENCY_OPTIONS,
  supportsOther: true,
  otherKey: "currency_other",
});

const CATEGORY_FORM_CONFIGS: AssetCategoryFormConfig[] = [
  {
    categorySlug: "bank-accounts",
    title: "Bank account",
    fields: [
      SHARED_TITLE,
      field({ key: "institution_name", label: "Institution name", iconName: "account_balance", inputType: "text", required: true, placeholder: "e.g. HSBC" }),
      field({ key: "account_type", label: "Account type", iconName: "category", inputType: "select", required: true, options: ACCOUNT_TYPE_OPTIONS, supportsOther: true, otherKey: "account_type_other" }),
      field({ key: "account_number", label: "Account number", iconName: "pin", inputType: "text", required: true, placeholder: "e.g. 12345678", sensitive: true }),
      field({ key: "sort_code", label: "Sort code", iconName: "tag", inputType: "text", required: false, placeholder: "e.g. 10-20-30", sensitive: true }),
      field({ key: "country", label: "Country", iconName: "public", inputType: "select", required: true, options: COUNTRY_OPTIONS, supportsOther: true, otherKey: "country_other" }),
      SHARED_CURRENCY,
      field({ key: "estimated_value", label: "Estimated/current value", iconName: "payments", inputType: "number", required: false, placeholder: "e.g. 120000" }),
      field({ key: "last_updated_on", label: "Last updated", iconName: "event", inputType: "date", required: false }),
      field({ key: "notes", label: "Notes", iconName: "notes", inputType: "textarea", required: false, placeholder: "Optional notes" }),
    ],
  },
  {
    categorySlug: "pensions",
    title: "Pension",
    fields: [
      SHARED_TITLE,
      field({ key: "pension_provider", label: "Pension provider", inputType: "text", required: true }),
      field({ key: "pension_type", label: "Pension type", inputType: "select", required: true, options: PENSION_TYPE_OPTIONS, supportsOther: true, otherKey: "pension_type_other" }),
      field({ key: "pension_member_number", label: "Policy/member number", inputType: "text", required: true, sensitive: true }),
      field({ key: "estimated_value", label: "Estimated value", inputType: "number", required: true }),
      SHARED_CURRENCY,
      field({ key: "pension_portal_url", label: "Online portal URL", inputType: "text", required: false }),
      field({ key: "notes", label: "Notes", inputType: "textarea", required: false }),
    ],
  },
  {
    categorySlug: "insurance",
    title: "Insurance",
    fields: [
      SHARED_TITLE,
      field({ key: "insurer_name", label: "Insurer name", inputType: "text", required: true }),
      field({ key: "policy_type", label: "Policy type", inputType: "select", required: true, options: INSURANCE_TYPE_OPTIONS, supportsOther: true, otherKey: "policy_type_other" }),
      field({ key: "policy_number", label: "Policy number", inputType: "text", required: true, sensitive: true }),
      field({ key: "insured_item", label: "Insured person/item", inputType: "text", required: true }),
      field({ key: "cover_amount", label: "Cover amount", inputType: "number", required: false }),
      SHARED_CURRENCY,
      field({ key: "renewal_date", label: "Renewal date", inputType: "date", required: false }),
      field({ key: "notes", label: "Notes", inputType: "textarea", required: false }),
    ],
  },
  {
    categorySlug: "debts",
    title: "Debt",
    fields: [
      SHARED_TITLE,
      field({ key: "creditor_name", label: "Creditor name", inputType: "text", required: true }),
      field({ key: "debt_type", label: "Debt type", inputType: "select", required: true, options: DEBT_TYPE_OPTIONS, supportsOther: true, otherKey: "debt_type_other" }),
      field({ key: "debt_reference", label: "Account/reference number", inputType: "text", required: true, sensitive: true }),
      field({ key: "outstanding_balance", label: "Outstanding balance", inputType: "number", required: true }),
      SHARED_CURRENCY,
      field({ key: "interest_rate", label: "Interest rate", inputType: "number", required: false }),
      field({ key: "notes", label: "Notes", inputType: "textarea", required: false }),
    ],
  },
  {
    categorySlug: "possessions",
    title: "Possession",
    fields: [
      SHARED_TITLE,
      field({ key: "estimated_value", label: "Estimated value", inputType: "number", required: false }),
      SHARED_CURRENCY,
      field({ key: "acquired_date", label: "Purchase / acquired date", inputType: "date", required: false }),
      field({ key: "notes", label: "Notes", inputType: "textarea", required: false }),
    ],
  },
  {
    categorySlug: "property",
    title: "Property",
    fields: [
      field({ ...SHARED_TITLE, label: "Property name", iconName: "home_work", placeholder: "e.g. Family home" }),
      field({ key: "property_type", label: "Property type", iconName: "holiday_village", inputType: "select", required: true, options: PROPERTY_TYPE_OPTIONS, supportsOther: true, otherKey: "property_type_other" }),
      field({ key: "ownership_type", label: "Ownership type", iconName: "groups", inputType: "select", required: true, options: PROPERTY_OWNERSHIP_OPTIONS, supportsOther: true, otherKey: "ownership_type_other" }),
      field({ key: "property_address", label: "Address", iconName: "location_on", inputType: "textarea", required: true, sensitive: true, placeholder: "Enter the full property address" }),
      field({ key: "property_country", label: "Country", iconName: "public", inputType: "select", required: true, options: COUNTRY_OPTIONS, supportsOther: true, otherKey: "property_country_other" }),
      field({ key: "estimated_value", label: "Estimated value", iconName: "payments", inputType: "number", required: true }),
      SHARED_CURRENCY,
      field({ key: "valuation_date", label: "Valuation date", iconName: "event", inputType: "date", required: false }),
      field({ key: "mortgage_status", label: "Mortgage status", iconName: "account_balance_wallet", inputType: "select", required: true, options: MORTGAGE_STATUS_OPTIONS, supportsOther: true, otherKey: "mortgage_status_other" }),
      field({ key: "mortgage_lender", label: "Mortgage lender", iconName: "account_balance", inputType: "text", required: false }),
      field({ key: "mortgage_balance", label: "Mortgage balance", iconName: "request_quote", inputType: "number", required: false }),
      field({ key: "notes", label: "Notes", iconName: "notes", inputType: "textarea", required: false }),
    ],
  },
  {
    categorySlug: "business-interests",
    title: "Business interest",
    fields: [
      field({ ...SHARED_TITLE, label: "Business name", iconName: "business_center", placeholder: "e.g. Legacy Fortress Ltd" }),
      field({ key: "business_type", label: "Business type", iconName: "apartment", inputType: "select", required: true, options: BUSINESS_TYPE_OPTIONS, supportsOther: true, otherKey: "business_type_other" }),
      field({ key: "registration_number", label: "Registration number", iconName: "badge", inputType: "text", required: false, sensitive: true, placeholder: "e.g. 12345678" }),
      field({ key: "jurisdiction", label: "Jurisdiction", iconName: "public", inputType: "select", required: true, options: COUNTRY_OPTIONS, supportsOther: true, otherKey: "jurisdiction_other" }),
      field({ key: "ownership_percentage", label: "Ownership percentage", iconName: "pie_chart", inputType: "number", required: false, placeholder: "e.g. 50" }),
      field({ key: "estimated_value", label: "Estimated value", iconName: "payments", inputType: "number", required: false }),
      SHARED_CURRENCY,
      field({ key: "valuation_date", label: "Valuation date", iconName: "event", inputType: "date", required: false }),
      field({ key: "role_title", label: "Role / title", iconName: "work", inputType: "text", required: false, placeholder: "e.g. Director" }),
      field({ key: "business_status", label: "Status", iconName: "task_alt", inputType: "select", required: true, options: BUSINESS_STATUS_OPTIONS, supportsOther: true, otherKey: "business_status_other" }),
      field({ key: "notes", label: "Notes", iconName: "notes", inputType: "textarea", required: false }),
    ],
  },
  {
    categorySlug: "digital-assets",
    title: "Digital account",
    fields: [
      field({ ...SHARED_TITLE, label: "Asset name", iconName: "hub", placeholder: "e.g. Coinbase account" }),
      field({ key: "digital_asset_type", label: "Asset type", iconName: "category", inputType: "select", required: true, options: DIGITAL_ASSET_TYPE_OPTIONS, supportsOther: true, otherKey: "digital_asset_type_other" }),
      field({ key: "platform_provider", label: "Platform / provider", iconName: "storefront", inputType: "text", required: true, placeholder: "e.g. Coinbase" }),
      field({ key: "wallet_reference", label: "Wallet or account reference", iconName: "badge", inputType: "text", required: false, sensitive: true, placeholder: "e.g. wallet name or account email" }),
      field({ key: "jurisdiction", label: "Jurisdiction", iconName: "public", inputType: "select", required: true, options: COUNTRY_OPTIONS, supportsOther: true, otherKey: "jurisdiction_other" }),
      field({ key: "estimated_value", label: "Estimated value", iconName: "payments", inputType: "number", required: false }),
      SHARED_CURRENCY,
      field({ key: "valuation_date", label: "Valuation date", iconName: "event", inputType: "date", required: false }),
      field({ key: "access_contact", label: "Access contact / custodian", iconName: "contact_support", inputType: "text", required: false, placeholder: "e.g. Recovery contact or custodian" }),
      field({ key: "digital_status", label: "Status", iconName: "task_alt", inputType: "select", required: true, options: DIGITAL_STATUS_OPTIONS, supportsOther: true, otherKey: "digital_status_other" }),
      field({ key: "notes", label: "Notes", iconName: "notes", inputType: "textarea", required: false }),
    ],
  },
  {
    categorySlug: "beneficiaries",
    title: "Beneficiary",
    fields: [
      field({ ...SHARED_TITLE, label: "Full name", iconName: "person", placeholder: "e.g. Jane Doe" }),
      field({ key: "preferred_name", label: "Preferred name", iconName: "badge", inputType: "text", required: false, placeholder: "Optional preferred name" }),
      field({ key: "relationship_to_user", label: "Relationship to you", iconName: "family_restroom", inputType: "select", required: true, options: BENEFICIARY_RELATIONSHIP_OPTIONS, supportsOther: true, otherKey: "relationship_to_user_other" }),
      field({ key: "date_of_birth", label: "Date of birth", iconName: "event", inputType: "date", required: false, sensitive: true }),
      field({ key: "contact_email", label: "Email", iconName: "mail", inputType: "text", required: false, placeholder: "e.g. jane@example.com" }),
      field({ key: "contact_phone", label: "Phone", iconName: "call", inputType: "text", required: false, placeholder: "e.g. +44 7700 900123" }),
      field({ key: "beneficiary_address", label: "Address", iconName: "location_on", inputType: "textarea", required: false, sensitive: true, placeholder: "Enter address if known" }),
      field({ key: "country_code", label: "Country", iconName: "public", inputType: "select", required: false, options: COUNTRY_OPTIONS, supportsOther: true, otherKey: "country_code_other" }),
      field({ key: "beneficiary_type", label: "Beneficiary type", iconName: "category", inputType: "select", required: true, options: BENEFICIARY_TYPE_OPTIONS, supportsOther: true, otherKey: "beneficiary_type_other" }),
      field({ key: "beneficiary_status", label: "Status", iconName: "task_alt", inputType: "select", required: true, options: BENEFICIARY_STATUS_OPTIONS, supportsOther: true, otherKey: "beneficiary_status_other" }),
      field({ key: "share_percentage", label: "Share / percentage", iconName: "pie_chart", inputType: "number", required: false, placeholder: "e.g. 50" }),
      field({ key: "identification_reference", label: "Identification reference", iconName: "badge", inputType: "text", required: false, sensitive: true, placeholder: "Optional passport, charity, or trust reference" }),
      field({ key: "notes", label: "Notes", iconName: "notes", inputType: "textarea", required: false, placeholder: "Optional notes" }),
    ],
  },
  {
    categorySlug: "executors",
    title: "Executor / trusted contact",
    fields: [
      field({ ...SHARED_TITLE, label: "Full name", iconName: "person", placeholder: "e.g. John Smith" }),
      field({ key: "executor_type", label: "Role / type", iconName: "gavel", inputType: "select", required: true, options: EXECUTOR_TYPE_OPTIONS, supportsOther: true, otherKey: "executor_type_other" }),
      field({ key: "relationship_to_user", label: "Relationship", iconName: "family_restroom", inputType: "select", required: true, options: EXECUTOR_RELATIONSHIP_OPTIONS, supportsOther: true, otherKey: "relationship_to_user_other" }),
      field({ key: "contact_email", label: "Email", iconName: "mail", inputType: "text", required: false, sensitive: true, placeholder: "e.g. john@example.com" }),
      field({ key: "contact_phone", label: "Phone", iconName: "call", inputType: "text", required: false, sensitive: true, placeholder: "e.g. +44 7700 900123" }),
      field({ key: "authority_level", label: "Authority level", iconName: "admin_panel_settings", inputType: "select", required: true, options: EXECUTOR_AUTHORITY_OPTIONS, supportsOther: true, otherKey: "authority_level_other" }),
      field({ key: "jurisdiction", label: "Jurisdiction", iconName: "public", inputType: "select", required: true, options: COUNTRY_OPTIONS, supportsOther: true, otherKey: "jurisdiction_other" }),
      field({ key: "executor_status", label: "Status", iconName: "task_alt", inputType: "select", required: true, options: EXECUTOR_STATUS_OPTIONS, supportsOther: true, otherKey: "executor_status_other" }),
      field({ key: "appointed_on", label: "Appointed on", iconName: "event", inputType: "date", required: false }),
      field({ key: "executor_address", label: "Address", iconName: "location_on", inputType: "textarea", required: false, sensitive: true, placeholder: "Optional postal address" }),
      field({ key: "identity_reference", label: "Identity reference", iconName: "badge", inputType: "text", required: false, sensitive: true, placeholder: "Optional passport or regulatory reference" }),
      field({ key: "beneficiary_reference", label: "Beneficiary reference", iconName: "volunteer_activism", inputType: "text", required: false, placeholder: "Optional beneficiary name or note reference" }),
      field({ key: "instruction_reference", label: "Instruction reference", iconName: "rule", inputType: "text", required: false, placeholder: "Optional wishes / instruction reference" }),
      field({ key: "notes", label: "Notes", iconName: "notes", inputType: "textarea", required: false, placeholder: "Optional notes" }),
    ],
  },
  {
    categorySlug: "tasks",
    title: "Task",
    fields: [
      field({ ...SHARED_TITLE, label: "Task title", iconName: "task", placeholder: "e.g. Contact bank about closure" }),
      field({ key: "description", label: "Description", iconName: "description", inputType: "textarea", required: false, placeholder: "What needs to be done?" }),
      field({ key: "related_asset_id", label: "Related asset / record", iconName: "link", inputType: "select", required: true, options: [] }),
      field({ key: "assigned_executor_asset_id", label: "Assigned executor / trusted contact", iconName: "supervisor_account", inputType: "select", required: false, options: [] }),
      field({ key: "assigned_beneficiary_asset_id", label: "Assigned beneficiary", iconName: "volunteer_activism", inputType: "select", required: false, options: [] }),
      field({ key: "priority", label: "Priority", iconName: "priority_high", inputType: "select", required: true, options: TASK_PRIORITY_OPTIONS, supportsOther: true, otherKey: "priority_other" }),
      field({ key: "task_status", label: "Status", iconName: "task_alt", inputType: "select", required: true, options: TASK_STATUS_OPTIONS, supportsOther: true, otherKey: "task_status_other" }),
      field({ key: "due_date", label: "Due date", iconName: "event", inputType: "date", required: false }),
      field({ key: "completion_date", label: "Completion date", iconName: "event_available", inputType: "date", required: false }),
      field({ key: "instruction_reference", label: "Instruction / wish reference", iconName: "rule", inputType: "text", required: false, placeholder: "Optional related wish or instruction" }),
      field({ key: "notes", label: "Notes", iconName: "notes", inputType: "textarea", required: false, placeholder: "Optional execution notes" }),
    ],
  },
];

export function getAssetCategoryFormConfig(categorySlug: string | null | undefined) {
  if (!categorySlug) return null;
  return CATEGORY_FORM_CONFIGS.find((config) => config.categorySlug === categorySlug) ?? null;
}

export function buildInitialAssetFormValues(config: AssetCategoryFormConfig) {
  const values: Record<string, string> = {};
  for (const field of config.fields) {
    values[field.key] = field.defaultValue ?? "";
    if (field.supportsOther && field.otherKey) {
      values[field.otherKey] = "";
    }
  }
  return values;
}

export function validateAssetFormValues(config: AssetCategoryFormConfig, values: Record<string, string>) {
  const errors: Record<string, string> = {};

  for (const field of config.fields) {
    const raw = `${values[field.key] ?? ""}`.trim();
    const usingOther = field.supportsOther && raw === "__other" && field.otherKey;
    const value = usingOther ? `${values[field.otherKey ?? ""] ?? ""}`.trim() : raw;

    if (field.required && !value) {
      errors[field.key] = `${field.label} is required.`;
      if (usingOther && field.otherKey) {
        errors[field.otherKey] = `Please enter ${field.label.toLowerCase()}.`;
      }
      continue;
    }

    if (!value) continue;

    const rules = field.validationRules;
    if (rules?.minLength && value.length < rules.minLength) {
      errors[field.key] = rules.message ?? `${field.label} is too short.`;
      continue;
    }

    if (rules?.maxLength && value.length > rules.maxLength) {
      errors[field.key] = rules.message ?? `${field.label} is too long.`;
      continue;
    }

    if (rules?.pattern && !rules.pattern.test(value)) {
      errors[field.key] = rules.message ?? `${field.label} format is invalid.`;
    }
  }

  return errors;
}

export function resolveConfiguredFieldValue(field: AssetFieldConfig, values: Record<string, string>) {
  const selected = `${values[field.key] ?? ""}`.trim();
  if (field.supportsOther && selected === "__other" && field.otherKey) {
    return `${values[field.otherKey] ?? ""}`.trim();
  }
  return selected;
}

export function getCanonicalAssetMetadataFromValues(config: AssetCategoryFormConfig, values: Record<string, string>) {
  const metadata: Record<string, unknown> = {};
  for (const field of config.fields) {
    if (field.key === "title") continue;
    const value = resolveConfiguredFieldValue(field, values);
    if (!value) continue;
    if (field.inputType === "number") {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        metadata[field.key] = numeric;
      }
      continue;
    }
    metadata[field.key] = value;
  }
  return metadata;
}

export function getSensitiveFieldKeys(config: AssetCategoryFormConfig) {
  return config.fields.filter((field) => field.sensitive).map((field) => field.key);
}

export function getCompleteness(config: AssetCategoryFormConfig, values: Record<string, string>) {
  const requiredFields = config.fields.filter((field) => field.contributesToCompleteness ?? field.required);
  if (!requiredFields.length) {
    return { completed: 0, total: 0, ratio: 1 };
  }

  let completed = 0;
  for (const field of requiredFields) {
    const value = resolveConfiguredFieldValue(field, values);
    if (value) completed += 1;
  }

  return {
    completed,
    total: requiredFields.length,
    ratio: completed / requiredFields.length,
  };
}
