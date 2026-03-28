import type { SupabaseClient } from "@supabase/supabase-js";
import { hasColumn, hasTable } from "./schemaSafe";
import { isMissingColumnError, isMissingRelationError } from "./supabaseErrors";

type AnySupabaseClient = SupabaseClient;

export type VaultCategoryGroupKey =
  | "legal"
  | "finances"
  | "personal"
  | "digital"
  | "tasks"
  | "property"
  | "business"
  | "cars_transport"
  | "executors";

export type VaultSubsectionKey =
  | "legal_wills"
  | "legal_trusts"
  | "legal_power_of_attorney"
  | "legal_funeral_wishes"
  | "legal_marriage_divorce_documents"
  | "legal_identity_documents"
  | "legal_other_legal_documents"
  | "legal_death_certificate"
  | "finances_bank"
  | "finances_pensions"
  | "finances_investments"
  | "finances_insurance"
  | "finances_debts"
  | "personal_possessions"
  | "personal_subscriptions"
  | "personal_social_media"
  | "personal_wishes"
  | "tasks_follow_up"
  | "property_records"
  | "property_documents"
  | "business_interests"
  | "business_employment";

export type VaultPreferenceKey = VaultCategoryGroupKey | VaultSubsectionKey;

export type VaultPreferences = {
  groups: Record<VaultCategoryGroupKey, boolean>;
  subsections: Record<VaultSubsectionKey, boolean>;
};

export type VaultCategoryDefinition = {
  key: VaultCategoryGroupKey;
  label: string;
  description: string;
  icon: string;
};

export type VaultSubsectionDefinition = {
  key: VaultSubsectionKey;
  groupKey: VaultCategoryGroupKey;
  label: string;
  description: string;
};

const USER_PROFILES_TABLE = "user_profiles";
const USER_PROFILES_VAULT_PREFERENCES_COLUMN = "vault_preferences";

export const VAULT_CATEGORY_DEFINITIONS: VaultCategoryDefinition[] = [
  {
    key: "legal",
    label: "Legal",
    description: "Wills, powers of attorney, identity documents, and other legal records.",
    icon: "description",
  },
  {
    key: "finances",
    label: "Finances",
    description: "Banking, pensions, investments, insurance, and debts.",
    icon: "account_balance",
  },
  {
    key: "personal",
    label: "Personal",
    description: "Possessions, subscriptions, social accounts, and personal wishes.",
    icon: "watch",
  },
  {
    key: "digital",
    label: "Digital",
    description: "Digital assets, accounts, and access details.",
    icon: "devices",
  },
  {
    key: "tasks",
    label: "Tasks",
    description: "Follow-up actions and practical next steps.",
    icon: "task",
  },
  {
    key: "property",
    label: "Property",
    description: "Homes, related records, and supporting property documents.",
    icon: "home",
  },
  {
    key: "business",
    label: "Business",
    description: "Business interests, workplace details, and employment-linked records.",
    icon: "business_center",
  },
  {
    key: "cars_transport",
    label: "Cars & Transport",
    description: "Vehicles, ownership details, transport records, and supporting documents.",
    icon: "directions_car",
  },
  {
    key: "executors",
    label: "Executors & Trustees",
    description: "Executor, trustee, and estate-role records that stay visible when needed.",
    icon: "history_edu",
  },
];

export const VAULT_SUBSECTION_DEFINITIONS: VaultSubsectionDefinition[] = [
  { key: "legal_wills", groupKey: "legal", label: "Wills", description: "Keep will records visible." },
  { key: "legal_trusts", groupKey: "legal", label: "Trusts", description: "Show trust records and related documents." },
  { key: "legal_power_of_attorney", groupKey: "legal", label: "Power of Attorney", description: "Show power of attorney records." },
  { key: "legal_funeral_wishes", groupKey: "legal", label: "Funeral Wishes", description: "Show funeral guidance and instructions." },
  { key: "legal_marriage_divorce_documents", groupKey: "legal", label: "Marriage / Divorce", description: "Show marriage and divorce records." },
  { key: "legal_identity_documents", groupKey: "legal", label: "Identity Documents", description: "Show passport, licence, and identity records." },
  { key: "legal_other_legal_documents", groupKey: "legal", label: "Other Legal Documents", description: "Show other legal paperwork." },
  { key: "legal_death_certificate", groupKey: "legal", label: "Death Certificate Verification", description: "Show death certificate verification." },
  { key: "finances_bank", groupKey: "finances", label: "Bank", description: "Show bank accounts and related files." },
  { key: "finances_pensions", groupKey: "finances", label: "Pensions", description: "Show pension providers and values." },
  { key: "finances_investments", groupKey: "finances", label: "Investments", description: "Show investment accounts and holdings." },
  { key: "finances_insurance", groupKey: "finances", label: "Insurance", description: "Show insurance policies and protection records." },
  { key: "finances_debts", groupKey: "finances", label: "Debts", description: "Show liabilities and repayment records." },
  { key: "personal_possessions", groupKey: "personal", label: "Possessions", description: "Show possessions and keepsakes." },
  { key: "personal_subscriptions", groupKey: "personal", label: "Subscriptions", description: "Show recurring services and renewals." },
  { key: "personal_social_media", groupKey: "personal", label: "Social media", description: "Show social profiles and handover details." },
  { key: "personal_wishes", groupKey: "personal", label: "Personal wishes", description: "Show wishes and personal guidance." },
  { key: "tasks_follow_up", groupKey: "tasks", label: "Tasks & follow-up", description: "Show outstanding tasks." },
  { key: "property_records", groupKey: "property", label: "Property Records", description: "Show property assets and notes." },
  { key: "property_documents", groupKey: "property", label: "Property Documents", description: "Show property documents." },
  { key: "business_interests", groupKey: "business", label: "Business Interests", description: "Show business interests and ownership records." },
  { key: "business_employment", groupKey: "business", label: "Employment", description: "Show employment and workplace records." },
];

const SUBSECTIONS_BY_GROUP = VAULT_SUBSECTION_DEFINITIONS.reduce<Record<VaultCategoryGroupKey, VaultSubsectionDefinition[]>>((map, definition) => {
  (map[definition.groupKey] ||= []).push(definition);
  return map;
}, {
  legal: [],
  finances: [],
  personal: [],
  digital: [],
  tasks: [],
  property: [],
  business: [],
  cars_transport: [],
  executors: [],
});

export function getDefaultVaultPreferences(): VaultPreferences {
  return {
    groups: {
      legal: true,
      finances: true,
      personal: true,
      digital: true,
      tasks: true,
      property: true,
      business: true,
      cars_transport: true,
      executors: true,
    },
    subsections: VAULT_SUBSECTION_DEFINITIONS.reduce<Record<VaultSubsectionKey, boolean>>((next, definition) => {
      next[definition.key] = true;
      return next;
    }, {} as Record<VaultSubsectionKey, boolean>),
  };
}

export function normalizeVaultPreferences(input: unknown): VaultPreferences {
  const defaults = getDefaultVaultPreferences();
  if (!input || typeof input !== "object") return defaults;

  const record = input as Record<string, unknown>;
  const rawGroups = record.groups && typeof record.groups === "object"
    ? (record.groups as Record<string, unknown>)
    : record;
  const rawSubsections = record.subsections && typeof record.subsections === "object"
    ? (record.subsections as Record<string, unknown>)
    : record;

  return {
    groups: VAULT_CATEGORY_DEFINITIONS.reduce<Record<VaultCategoryGroupKey, boolean>>((next, definition) => {
      next[definition.key] = rawGroups[definition.key] === false ? false : defaults.groups[definition.key];
      return next;
    }, { ...defaults.groups }),
    subsections: VAULT_SUBSECTION_DEFINITIONS.reduce<Record<VaultSubsectionKey, boolean>>((next, definition) => {
      next[definition.key] = rawSubsections[definition.key] === false ? false : defaults.subsections[definition.key];
      return next;
    }, { ...defaults.subsections }),
  };
}

export function isVaultCategoryEnabled(preferences: VaultPreferences, key: VaultCategoryGroupKey | null | undefined) {
  if (!key) return true;
  if (preferences.groups[key] === false) return false;
  const subsections = SUBSECTIONS_BY_GROUP[key] ?? [];
  if (!subsections.length) return true;
  return subsections.some((definition) => preferences.subsections[definition.key] !== false);
}

export function isVaultSubsectionEnabled(preferences: VaultPreferences, key: VaultSubsectionKey | null | undefined) {
  if (!key) return true;
  const definition = VAULT_SUBSECTION_DEFINITIONS.find((item) => item.key === key);
  if (!definition) return true;
  if (!isVaultCategoryEnabled(preferences, definition.groupKey)) return false;
  return preferences.subsections[key] !== false;
}

export function getVaultSubsectionsForGroup(groupKey: VaultCategoryGroupKey) {
  return SUBSECTIONS_BY_GROUP[groupKey] ?? [];
}

export function resolveVaultCategoryForPath(pathname: string): VaultCategoryGroupKey | null {
  const value = pathname.trim().toLowerCase();
  if (!value) return null;
  if (value.startsWith("/legal")) return "legal";
  if (value.startsWith("/finances")) return "finances";
  if (value.startsWith("/vault/digital")) return "digital";
  if (value.startsWith("/personal/tasks")) return "tasks";
  if (value.startsWith("/personal") || value.startsWith("/vault/personal")) return "personal";
  if (value.startsWith("/property") || value.startsWith("/vault/property")) return "property";
  if (value.startsWith("/business") || value.startsWith("/employment") || value.startsWith("/vault/business")) return "business";
  if (value.startsWith("/cars-transport")) return "cars_transport";
  if (value.startsWith("/trust")) return "executors";
  return null;
}

export function resolveVaultSubsectionForPath(pathname: string): VaultSubsectionKey | null {
  const value = pathname.trim().toLowerCase();
  if (!value) return null;
  if (value.startsWith("/legal/wills")) return "legal_wills";
  if (value.startsWith("/legal/trusts")) return "legal_trusts";
  if (value.startsWith("/legal/power-of-attorney")) return "legal_power_of_attorney";
  if (value.startsWith("/legal/funeral-wishes")) return "legal_funeral_wishes";
  if (value.startsWith("/legal/marriage-divorce-documents")) return "legal_marriage_divorce_documents";
  if (value.startsWith("/legal/identity-documents")) return "legal_identity_documents";
  if (value.startsWith("/legal/other-legal-documents")) return "legal_other_legal_documents";
  if (value.startsWith("/legal/death-certificate")) return "legal_death_certificate";
  if (value.startsWith("/finances/bank")) return "finances_bank";
  if (value.startsWith("/finances/pensions")) return "finances_pensions";
  if (value.startsWith("/finances/investments")) return "finances_investments";
  if (value.startsWith("/finances/insurance")) return "finances_insurance";
  if (value.startsWith("/finances/debts")) return "finances_debts";
  if (value.startsWith("/vault/personal")) return "personal_possessions";
  if (value.startsWith("/personal/subscriptions")) return "personal_subscriptions";
  if (value.startsWith("/personal/social-media")) return "personal_social_media";
  if (value.startsWith("/personal/wishes")) return "personal_wishes";
  if (value.startsWith("/personal/tasks")) return "tasks_follow_up";
  if (value.startsWith("/vault/property")) return "property_records";
  if (value.startsWith("/property/documents")) return "property_documents";
  if (value === "/business" || value.startsWith("/business?")) return "business_interests";
  if (value.startsWith("/employment")) return "business_employment";
  return null;
}

export function isVaultPreferenceEnabled(
  preferences: VaultPreferences,
  key: VaultPreferenceKey | null | undefined,
) {
  if (!key) return true;
  if (VAULT_CATEGORY_DEFINITIONS.some((item) => item.key === key)) {
    return isVaultCategoryEnabled(preferences, key as VaultCategoryGroupKey);
  }
  return isVaultSubsectionEnabled(preferences, key as VaultSubsectionKey);
}

export function isVaultPathEnabled(pathname: string, preferences: VaultPreferences) {
  const subsectionKey = resolveVaultSubsectionForPath(pathname);
  if (subsectionKey) return isVaultSubsectionEnabled(preferences, subsectionKey);
  return isVaultCategoryEnabled(preferences, resolveVaultCategoryForPath(pathname));
}

export function filterNodesByVaultPreferences<T extends {
  path: string;
  children?: T[];
  vaultCategoryKey?: VaultCategoryGroupKey;
  vaultSubsectionKey?: VaultSubsectionKey;
}>(nodes: T[], preferences: VaultPreferences): T[] {
  return nodes
    .map((node) => ({
      ...node,
      children: node.children ? filterNodesByVaultPreferences(node.children, preferences) : node.children,
    }))
    .filter((node) => {
      if (node.vaultSubsectionKey) {
        return isVaultSubsectionEnabled(preferences, node.vaultSubsectionKey);
      }
      const groupKey = node.vaultCategoryKey ?? resolveVaultCategoryForPath(node.path);
      if (!groupKey) return true;
      if (!isVaultCategoryEnabled(preferences, groupKey)) return false;
      if (node.children?.length) return node.children.length > 0;
      return true;
    });
}

export async function loadVaultPreferences(client: AnySupabaseClient, userId: string): Promise<VaultPreferences> {
  const tableExists = await hasTable(client, USER_PROFILES_TABLE);
  if (!tableExists) return getDefaultVaultPreferences();

  const columnExists = await hasColumn(client, USER_PROFILES_TABLE, USER_PROFILES_VAULT_PREFERENCES_COLUMN);
  if (!columnExists) return getDefaultVaultPreferences();

  const response = await client
    .from(USER_PROFILES_TABLE)
    .select(`user_id,${USER_PROFILES_VAULT_PREFERENCES_COLUMN}`)
    .eq("user_id", userId)
    .maybeSingle();

  if (response.error) {
    if (
      isMissingRelationError(response.error, USER_PROFILES_TABLE)
      || isMissingColumnError(response.error, USER_PROFILES_VAULT_PREFERENCES_COLUMN)
    ) {
      return getDefaultVaultPreferences();
    }
    throw new Error(response.error.message || "Could not load vault preferences");
  }

  return normalizeVaultPreferences((response.data as { vault_preferences?: unknown } | null)?.vault_preferences ?? null);
}

export async function saveVaultPreferences(
  client: AnySupabaseClient,
  userId: string,
  preferences: VaultPreferences,
): Promise<VaultPreferences> {
  const tableExists = await hasTable(client, USER_PROFILES_TABLE);
  if (!tableExists) return normalizeVaultPreferences(preferences);

  const columnExists = await hasColumn(client, USER_PROFILES_TABLE, USER_PROFILES_VAULT_PREFERENCES_COLUMN);
  if (!columnExists) return normalizeVaultPreferences(preferences);

  const now = new Date().toISOString();
  const payload = {
    user_id: userId,
    vault_preferences: normalizeVaultPreferences(preferences),
    updated_at: now,
  };

  const response = await client
    .from(USER_PROFILES_TABLE)
    .upsert(payload, { onConflict: "user_id" })
    .select(USER_PROFILES_VAULT_PREFERENCES_COLUMN)
    .single();

  if (response.error || !response.data) {
    if (
      isMissingRelationError(response.error, USER_PROFILES_TABLE)
      || isMissingColumnError(response.error, USER_PROFILES_VAULT_PREFERENCES_COLUMN)
    ) {
      return normalizeVaultPreferences(preferences);
    }
    throw new Error(response.error?.message || "Could not save vault preferences");
  }

  return normalizeVaultPreferences((response.data as { vault_preferences?: unknown }).vault_preferences ?? preferences);
}
