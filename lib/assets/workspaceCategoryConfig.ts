import { getAssetCategoryFormConfig } from "./fieldDictionary";

export type ManagedAssetWorkspaceConfig = {
  sectionKey: "finances" | "property" | "business" | "digital";
  categoryKey: "bank" | "investments" | "property" | "business" | "digital";
  title: string;
  subtitle: string;
  readsCanonicalAssets: boolean;
  canonicalCategorySlug: "bank-accounts" | "property" | "business-interests" | "digital-assets" | null;
  fieldConfigCategorySlug: "bank-accounts" | "property" | "business-interests" | "digital-assets" | null;
};

type WorkspaceRecordLike = {
  id?: unknown;
  section_key?: unknown;
  category_key?: unknown;
};

export const BANK_WORKSPACE_CONFIG: ManagedAssetWorkspaceConfig = {
  sectionKey: "finances",
  categoryKey: "bank",
  title: "Finances · Bank accounts",
  subtitle: "Keep account details, balances, and supporting statements together so they are easy to review when needed.",
  readsCanonicalAssets: true,
  canonicalCategorySlug: "bank-accounts",
  fieldConfigCategorySlug: "bank-accounts",
};

export const INVESTMENTS_WORKSPACE_CONFIG: ManagedAssetWorkspaceConfig = {
  sectionKey: "finances",
  categoryKey: "investments",
  title: "Finances · Investments",
  subtitle: "Track investments, premiums, certificates, and portfolio details.",
  readsCanonicalAssets: true,
  canonicalCategorySlug: null,
  fieldConfigCategorySlug: null,
};

export const PROPERTY_WORKSPACE_CONFIG: ManagedAssetWorkspaceConfig = {
  sectionKey: "property",
  categoryKey: "property",
  title: "Property · Assets",
  subtitle: "Capture property assets, protect sensitive address details, and attach supporting documents in one canonical workspace.",
  readsCanonicalAssets: true,
  canonicalCategorySlug: "property",
  fieldConfigCategorySlug: "property",
};

export const BUSINESS_WORKSPACE_CONFIG: ManagedAssetWorkspaceConfig = {
  sectionKey: "business",
  categoryKey: "business",
  title: "Business · Interests",
  subtitle: "Capture business interests, protect sensitive registration details, and attach supporting documents in one canonical workspace.",
  readsCanonicalAssets: true,
  canonicalCategorySlug: "business-interests",
  fieldConfigCategorySlug: "business-interests",
};

export const DIGITAL_WORKSPACE_CONFIG: ManagedAssetWorkspaceConfig = {
  sectionKey: "digital",
  categoryKey: "digital",
  title: "Digital · Assets",
  subtitle: "Capture digital assets, protect sensitive access references, and attach supporting documents in one canonical workspace.",
  readsCanonicalAssets: true,
  canonicalCategorySlug: "digital-assets",
  fieldConfigCategorySlug: "digital-assets",
};

const MANAGED_ASSET_WORKSPACE_CONFIGS: ManagedAssetWorkspaceConfig[] = [
  BANK_WORKSPACE_CONFIG,
  INVESTMENTS_WORKSPACE_CONFIG,
  PROPERTY_WORKSPACE_CONFIG,
  BUSINESS_WORKSPACE_CONFIG,
  DIGITAL_WORKSPACE_CONFIG,
];

export function getManagedAssetWorkspaceConfig(sectionKey: string, categoryKey: string) {
  return (
    MANAGED_ASSET_WORKSPACE_CONFIGS.find(
      (config) => config.sectionKey === sectionKey && config.categoryKey === categoryKey,
    ) ?? null
  );
}

export function validateManagedAssetWorkspaceConfig(sectionKey: string, categoryKey: string) {
  const config = getManagedAssetWorkspaceConfig(sectionKey, categoryKey);
  if (!config) return null;

  if (config.fieldConfigCategorySlug && !getAssetCategoryFormConfig(config.fieldConfigCategorySlug)) {
    throw new Error(
      `Workspace category validation failed: missing fieldDictionary config for ${config.fieldConfigCategorySlug}.`,
    );
  }

  return config;
}

export function assertWorkspaceRowsMatchCategory(
  rows: WorkspaceRecordLike[],
  {
    sectionKey,
    categoryKey,
  }: {
    sectionKey: string;
    categoryKey: string;
  },
) {
  for (const row of rows) {
    const id = String(row.id ?? "").trim();
    const rowSectionKey = String(row.section_key ?? "").trim();
    const rowCategoryKey = String(row.category_key ?? "").trim();

    if (!id) {
      throw new Error("Workspace row validation failed: missing record id.");
    }
    if (rowSectionKey !== sectionKey) {
      throw new Error(
        `Workspace row validation failed: expected section_key ${sectionKey} but received ${rowSectionKey || "<empty>"}.`,
      );
    }
    if (rowCategoryKey !== categoryKey) {
      throw new Error(
        `Workspace row validation failed: expected category_key ${categoryKey} but received ${rowCategoryKey || "<empty>"}.`,
      );
    }
  }
}
