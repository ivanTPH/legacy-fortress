const FINANCE_BANK_TYPES = [
  { key: "current_account", label: "Current account", legacyAliases: ["current", "current account"] },
  { key: "savings_account", label: "Savings account", legacyAliases: ["savings", "savings account"] },
  { key: "cash_deposit", label: "Cash / deposit account", legacyAliases: ["cash", "deposit", "fixed deposit", "fixed deposit / term deposit"] },
  { key: "isa_cash", label: "Cash ISA", legacyAliases: ["isa", "cash isa"] },
  { key: "joint_account", label: "Joint account", legacyAliases: ["joint", "joint account"] },
  { key: "business_account", label: "Business account", legacyAliases: ["business", "business account"] },
  { key: "other_bank_account", label: "Other bank account", legacyAliases: ["other", "other bank account"] },
];

const FINANCE_PENSION_TYPES = [
  { key: "workplace_pension", label: "Workplace pension", legacyAliases: ["workplace"] },
  { key: "personal_pension", label: "Personal pension", legacyAliases: ["personal", "pension"] },
  { key: "sipp", label: "SIPP", legacyAliases: ["self invested personal pension"] },
  { key: "defined_benefit", label: "Final salary / defined benefit", legacyAliases: ["final salary", "defined benefit", "final salary / defined benefit"] },
  { key: "defined_contribution", label: "Defined contribution", legacyAliases: ["defined contribution"] },
  { key: "stakeholder_pension", label: "Stakeholder pension", legacyAliases: ["stakeholder"] },
  { key: "state_pension", label: "State pension", legacyAliases: ["state pension"] },
  { key: "public_sector_pension", label: "Public sector pension", legacyAliases: ["public sector pension"] },
  { key: "other_pension", label: "Other pension", legacyAliases: ["other", "other pension"] },
];

const FINANCE_INVESTMENT_TYPES = [
  { key: "share_portfolio", label: "Share portfolio", legacyAliases: ["shares", "share portfolio"] },
  { key: "stocks_shares_isa", label: "Stocks and shares ISA", legacyAliases: ["stocks and shares isa"] },
  { key: "investment_fund", label: "Investment fund", legacyAliases: ["fund", "investment fund", "mutual fund", "unit trust"] },
  { key: "investment_trust", label: "Investment trust", legacyAliases: ["investment trust"] },
  { key: "investment_bond", label: "Investment bond", legacyAliases: ["bond", "investment bond"] },
  { key: "brokerage_account", label: "Brokerage / platform account", legacyAliases: ["brokerage", "brokerage / platform account", "platform account"] },
  { key: "managed_portfolio", label: "Managed portfolio", legacyAliases: ["managed portfolio"] },
  { key: "premium_bonds", label: "Premium Bonds", legacyAliases: ["premium bonds"] },
  { key: "private_equity", label: "Private equity", legacyAliases: ["private equity"] },
  { key: "crypto_digital_investment", label: "Crypto / digital investment", legacyAliases: ["crypto / digital investment", "crypto investment"] },
  { key: "other_investment", label: "Other investment", legacyAliases: ["other", "other investment"] },
];

const FINANCE_INSURANCE_TYPES = [
  { key: "life_insurance", label: "Life insurance", legacyAliases: ["life", "life cover"] },
  { key: "critical_illness", label: "Critical illness cover", legacyAliases: ["critical illness"] },
  { key: "income_protection", label: "Income protection", legacyAliases: ["income protection"] },
  { key: "health_insurance", label: "Health insurance", legacyAliases: ["health"] },
  { key: "home_insurance", label: "Home insurance", legacyAliases: ["home"] },
  { key: "vehicle_insurance", label: "Vehicle insurance", legacyAliases: ["car", "vehicle", "car insurance"] },
  { key: "other_insurance", label: "Other insurance", legacyAliases: ["other", "other insurance"] },
];

const FINANCE_DEBT_TYPES = [
  { key: "credit_card", label: "Credit card" },
  { key: "personal_loan", label: "Personal loan", legacyAliases: ["loan", "personal loan"] },
  { key: "mortgage", label: "Mortgage" },
  { key: "overdraft", label: "Overdraft" },
  { key: "business_debt", label: "Business debt", legacyAliases: ["business debt"] },
  { key: "other_debt", label: "Other debt", legacyAliases: ["other", "other debt"] },
];

export const CATEGORY_TYPE_DEFINITIONS = [
  {
    sectionKey: "finances",
    categoryKey: "bank",
    label: "Banks",
    typeField: "account_type",
    allowedTypes: FINANCE_BANK_TYPES,
  },
  {
    sectionKey: "finances",
    categoryKey: "pensions",
    label: "Pensions",
    typeField: "pension_type",
    allowedTypes: FINANCE_PENSION_TYPES,
    crossCategoryAliases: ["investment", "share portfolio", "brokerage", "investment fund"],
    crossCategoryMessage: "This record type belongs under Investments. Please add it from the Investments section.",
  },
  {
    sectionKey: "finances",
    categoryKey: "investments",
    label: "Investments",
    typeField: "investment_type",
    allowedTypes: FINANCE_INVESTMENT_TYPES,
    crossCategoryAliases: ["pension", "sipp", "final salary", "defined benefit", "defined contribution", "workplace pension", "state pension"],
    crossCategoryMessage: "This record type belongs under Pensions. Please add it from the Pensions section.",
  },
  {
    sectionKey: "finances",
    categoryKey: "insurance",
    label: "Insurance",
    typeField: "policy_type",
    allowedTypes: FINANCE_INSURANCE_TYPES,
  },
  {
    sectionKey: "finances",
    categoryKey: "debts",
    label: "Debts",
    typeField: "debt_type",
    allowedTypes: FINANCE_DEBT_TYPES,
  },
];

export function getCategoryTypeDefinition(sectionKey, categoryKey) {
  return CATEGORY_TYPE_DEFINITIONS.find(
    (definition) => definition.sectionKey === sectionKey && definition.categoryKey === categoryKey,
  ) ?? null;
}

export function getCategoryTypeSelectOptions(sectionKey, categoryKey, placeholder) {
  const definition = getCategoryTypeDefinition(sectionKey, categoryKey);
  if (!definition) return [];
  return [
    { value: "", label: placeholder ?? `Select ${definition.label.toLowerCase()} type` },
    ...definition.allowedTypes.map((option) => ({ value: option.key, label: option.label })),
  ];
}

/**
 * @param {string} sectionKey
 * @param {string} categoryKey
 * @param {{ otherValue?: string | null }} [options]
 */
export function getCategoryTypeFieldOptions(sectionKey, categoryKey, { otherValue = null } = {}) {
  const definition = getCategoryTypeDefinition(sectionKey, categoryKey);
  if (!definition) return [];
  return definition.allowedTypes.map((option) => ({
    value: otherValue && option.key.startsWith("other_") ? otherValue : option.key,
    label: option.label.replace(/^Other .+$/, "Other"),
    canonicalValue: option.key,
  }));
}

export function normalizeCategoryTypeToken(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[/_]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "_");
}

export function resolveCategoryTypeOption(sectionKey, categoryKey, value) {
  const definition = getCategoryTypeDefinition(sectionKey, categoryKey);
  if (!definition) return null;
  const normalized = normalizeCategoryTypeToken(value);
  if (!normalized) return null;
  return definition.allowedTypes.find((option) => {
    if (normalizeCategoryTypeToken(option.key) === normalized) return true;
    if (normalizeCategoryTypeToken(option.label) === normalized) return true;
    return (option.legacyAliases ?? []).some((alias) => normalizeCategoryTypeToken(alias) === normalized);
  }) ?? null;
}

export function canonicalizeCategoryTypeValue(sectionKey, categoryKey, value) {
  return resolveCategoryTypeOption(sectionKey, categoryKey, value)?.key ?? String(value ?? "").trim();
}

export function getCategoryTypeDatabaseTokens(sectionKey, categoryKey) {
  const definition = getCategoryTypeDefinition(sectionKey, categoryKey);
  if (!definition) return [];
  return [...new Set(definition.allowedTypes.flatMap((option) => [
    normalizeCategoryTypeToken(option.key),
    normalizeCategoryTypeToken(option.label),
    ...(option.legacyAliases ?? []).map((alias) => normalizeCategoryTypeToken(alias)),
  ]).filter(Boolean))];
}

export function validateCategoryTypeSelection({
  sectionKey,
  categoryKey,
  typeValue,
  descriptionText = "",
}) {
  const definition = getCategoryTypeDefinition(sectionKey, categoryKey);
  if (!definition) {
    return { ok: true, canonicalTypeKey: String(typeValue ?? "").trim(), label: String(typeValue ?? "").trim() };
  }

  const rawValue = String(typeValue ?? "").trim();
  if (!rawValue) {
    return {
      ok: false,
      code: "CATEGORY_TYPE_REQUIRED",
      message: `Choose a ${definition.label.toLowerCase()} type before saving.`,
    };
  }

  const resolved = resolveCategoryTypeOption(sectionKey, categoryKey, rawValue);
  if (resolved) {
    const combinedText = `${rawValue} ${descriptionText}`.trim();
    const matchedCrossAlias = (definition.crossCategoryAliases ?? []).some((alias) =>
      new RegExp(`\\b${escapeRegExp(alias).replace(/\\s+/g, "\\s+")}\\b`, "i").test(combinedText),
    );
    if (matchedCrossAlias && resolved.key.startsWith("other_")) {
      return {
        ok: false,
        code: "CATEGORY_TYPE_MISMATCH",
        message: definition.crossCategoryMessage ?? "This record type belongs in another category.",
        suggestedCategoryKey: categoryKey === "investments" ? "pensions" : undefined,
      };
    }
    return { ok: true, canonicalTypeKey: resolved.key, label: resolved.label };
  }

  const normalized = normalizeCategoryTypeToken(rawValue);
  const crossCategory = CATEGORY_TYPE_DEFINITIONS.find((candidate) =>
    candidate.sectionKey === sectionKey && candidate.categoryKey !== categoryKey && Boolean(resolveCategoryTypeOption(candidate.sectionKey, candidate.categoryKey, rawValue)),
  );
  if (crossCategory) {
    return {
      ok: false,
      code: "CATEGORY_TYPE_MISMATCH",
      message: `This record type belongs under ${crossCategory.label}. Please add it from the ${crossCategory.label} section.`,
      suggestedCategoryKey: crossCategory.categoryKey,
    };
  }

  const matchedCrossAlias = (definition.crossCategoryAliases ?? []).some((alias) => normalizeCategoryTypeToken(alias) === normalized);
  if (matchedCrossAlias) {
    return {
      ok: false,
      code: "CATEGORY_TYPE_MISMATCH",
      message: definition.crossCategoryMessage ?? "This record type belongs in another category.",
      suggestedCategoryKey: categoryKey === "investments" ? "pensions" : undefined,
    };
  }

  return {
    ok: false,
    code: "CATEGORY_TYPE_MISMATCH",
    message: `Choose a valid ${definition.label.toLowerCase()} type for this section.`,
  };
}

export function getCategoryTypeLabel(sectionKey, categoryKey, value) {
  return resolveCategoryTypeOption(sectionKey, categoryKey, value)?.label ?? String(value ?? "").trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
