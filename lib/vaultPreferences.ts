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

export type VaultPreferences = Record<VaultCategoryGroupKey, boolean>;

export type VaultCategoryDefinition = {
  key: VaultCategoryGroupKey;
  label: string;
  description: string;
  icon: string;
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

export function getDefaultVaultPreferences(): VaultPreferences {
  return {
    legal: true,
    finances: true,
    personal: true,
    digital: true,
    tasks: true,
    property: true,
    business: true,
    cars_transport: true,
    executors: true,
  };
}

export function normalizeVaultPreferences(input: unknown): VaultPreferences {
  const defaults = getDefaultVaultPreferences();
  if (!input || typeof input !== "object") return defaults;

  const record = input as Record<string, unknown>;
  return VAULT_CATEGORY_DEFINITIONS.reduce<VaultPreferences>((next, definition) => {
    next[definition.key] = record[definition.key] === false ? false : defaults[definition.key];
    return next;
  }, { ...defaults });
}

export function isVaultCategoryEnabled(preferences: VaultPreferences, key: VaultCategoryGroupKey | null | undefined) {
  if (!key) return true;
  return preferences[key] !== false;
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

export function isVaultPathEnabled(pathname: string, preferences: VaultPreferences) {
  return isVaultCategoryEnabled(preferences, resolveVaultCategoryForPath(pathname));
}

export function filterNodesByVaultPreferences<T extends {
  path: string;
  children?: T[];
  vaultCategoryKey?: VaultCategoryGroupKey;
}>(nodes: T[], preferences: VaultPreferences): T[] {
  return nodes
    .filter((node) => isVaultCategoryEnabled(preferences, node.vaultCategoryKey ?? resolveVaultCategoryForPath(node.path)))
    .map((node) => ({
      ...node,
      children: node.children ? filterNodesByVaultPreferences(node.children, preferences) : node.children,
    }));
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
