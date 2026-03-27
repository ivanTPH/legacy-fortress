import type { SupabaseClient } from "@supabase/supabase-js";
import { hasColumn } from "../schemaSafe";

type AnySupabaseClient = SupabaseClient;

const BASE_ASSET_QUERY_COLUMNS = ["id", "updated_at"] as const;

type CanonicalAssetQueryRow = Record<string, unknown>;

function normalizeCategoryToken(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeCanonicalAssetSelectClause(select: string) {
  const replacements: Record<string, string> = {
    "owner-user-id": "owner_user_id",
    "wallet-id": "wallet_id",
    "organisation-id": "organisation_id",
    "section-key": "section_key",
    "category-key": "category_key",
    "metadata-json": "metadata_json",
    "asset-category-token": "asset_category_token",
    "category-slug": "category_slug",
  };

  let normalized = select;
  for (const [wrong, right] of Object.entries(replacements)) {
    normalized = normalized.replaceAll(wrong, right);
  }

  if (process.env.NODE_ENV === "development" && normalized !== select) {
    console.info("[fetchCanonicalAssets] normalized asset select clause", {
      requestedSelect: select,
      normalizedSelect: normalized,
    });
  }

  return normalized;
}

function resolveDerivedAssetCategoryIdentity(row: CanonicalAssetQueryRow) {
  const metadata = ((row.metadata_json as Record<string, unknown> | null) ?? row.metadata ?? {}) as Record<string, unknown>;
  const rawSectionKey = normalizeCategoryToken(row.section_key);
  const rawCategoryKey = normalizeCategoryToken(row.category_key);
  const normalizedToken = normalizeCategoryToken(
    row.asset_category_token
      ?? row.category_slug
      ?? metadata["asset_category_token"]
      ?? metadata["category_slug"],
  );

  if (rawSectionKey === "finances") {
    if (rawCategoryKey === "bank-accounts" || rawCategoryKey === "bank-account" || normalizedToken === "bank-accounts" || normalizedToken === "bank-account") {
      return { sectionKey: "finances", categoryKey: "bank" };
    }
    if (rawCategoryKey === "investment" || normalizedToken === "investment") {
      return { sectionKey: "finances", categoryKey: "investments" };
    }
    if (rawCategoryKey === "pension" || normalizedToken === "pension") {
      return { sectionKey: "finances", categoryKey: "pensions" };
    }
    if (rawCategoryKey === "debt" || normalizedToken === "debt") {
      return { sectionKey: "finances", categoryKey: "debts" };
    }
  }

  if (rawSectionKey && rawCategoryKey) {
    return { sectionKey: rawSectionKey, categoryKey: rawCategoryKey };
  }

  const token = normalizedToken;

  if (token === "bank-accounts" || token === "bank-account" || token === "bank") {
    return { sectionKey: "finances", categoryKey: "bank" };
  }
  if (token === "investments" || token === "investment") {
    return { sectionKey: "finances", categoryKey: "investments" };
  }
  if (token === "pensions" || token === "pension") {
    return { sectionKey: "finances", categoryKey: "pensions" };
  }
  if (token === "insurance") {
    return { sectionKey: "finances", categoryKey: "insurance" };
  }
  if (token === "debts" || token === "debt" || token === "loans-liabilities") {
    return { sectionKey: "finances", categoryKey: token === "debt" ? "debts" : token };
  }
  if (token === "property") {
    return { sectionKey: "property", categoryKey: "property" };
  }
  if (token === "business-interests" || token === "business-interest" || token === "business") {
    return { sectionKey: "business", categoryKey: "business" };
  }
  if (token === "digital-assets" || token === "digital-asset" || token === "digital") {
    return { sectionKey: "digital", categoryKey: "digital" };
  }
  if (token === "beneficiaries" || token === "beneficiary") {
    return { sectionKey: "personal", categoryKey: "beneficiaries" };
  }
  if (token === "executors" || token === "executor") {
    return { sectionKey: "personal", categoryKey: "executors" };
  }
  if (token === "tasks" || token === "task") {
    return { sectionKey: "personal", categoryKey: "tasks" };
  }

  return {
    sectionKey: rawSectionKey,
    categoryKey: rawCategoryKey,
  };
}

function normalizeFetchedAssetRows(
  rows: CanonicalAssetQueryRow[],
  {
    sectionKey,
    sectionKeys,
    categoryKey,
  }: {
    sectionKey?: string | null;
    sectionKeys?: string[] | null;
    categoryKey?: string | null;
  },
) {
  const normalizedSectionKey = normalizeCategoryToken(sectionKey);
  const normalizedSectionKeys = (sectionKeys ?? []).map((value) => normalizeCategoryToken(value)).filter(Boolean);
  const normalizedCategoryKey = normalizeCategoryToken(categoryKey);

  return rows
    .map((row) => {
      const derived = resolveDerivedAssetCategoryIdentity(row);
      return {
        ...row,
        section_key: derived.sectionKey || row.section_key,
        category_key: derived.categoryKey || row.category_key,
      };
    })
    .filter((row) => {
      const derivedSectionKey = normalizeCategoryToken(row.section_key);
      const derivedCategoryKey = normalizeCategoryToken(row.category_key);
      if (normalizedSectionKey && derivedSectionKey !== normalizedSectionKey) return false;
      if (normalizedSectionKeys.length > 0 && !normalizedSectionKeys.includes(derivedSectionKey)) return false;
      if (normalizedCategoryKey && derivedCategoryKey !== normalizedCategoryKey) return false;
      return true;
    });
}

async function assertCanonicalAssetQuerySchema(
  client: AnySupabaseClient,
  {
    requiresOwnerUserId,
    requiresWalletId,
    requiresDeletedAt,
  }: {
    requiresOwnerUserId: boolean;
    requiresWalletId: boolean;
    requiresDeletedAt: boolean;
  },
) {
  const requiredColumns = [
    ...BASE_ASSET_QUERY_COLUMNS,
    ...(requiresOwnerUserId ? (["owner_user_id"] as const) : []),
    ...(requiresWalletId ? (["wallet_id"] as const) : []),
    ...(requiresDeletedAt ? (["deleted_at"] as const) : []),
  ];

  const availability = await Promise.all(
    requiredColumns.map(async (column) => ({
      column,
      present: await hasColumn(client, "assets", column),
    })),
  );
  const missingColumns = availability.filter((entry) => !entry.present).map((entry) => entry.column);

  if (missingColumns.length > 0) {
    throw new Error(
      `Canonical asset query failed: assets is missing required column${missingColumns.length === 1 ? "" : "s"} ${missingColumns.join(", ")}.`,
    );
  }
}

export async function fetchCanonicalAssets(
  client: AnySupabaseClient,
  {
    userId,
    walletId,
    sectionKey,
    sectionKeys,
    categoryKey,
    select = "*",
  }: {
    userId: string;
    walletId?: string | null;
    sectionKey?: string | null;
    sectionKeys?: string[] | null;
    categoryKey?: string | null;
    select?: string;
  },
) {
  const requiresOwnerUserId = !walletId;
  const requiresDeletedAt = await hasColumn(client, "assets", "deleted_at");
  const hasSectionKeyColumn = await hasColumn(client, "assets", "section_key");
  const hasCategoryKeyColumn = await hasColumn(client, "assets", "category_key");

  await assertCanonicalAssetQuerySchema(client, {
    requiresOwnerUserId,
    requiresWalletId: Boolean(walletId),
    requiresDeletedAt,
  });

  const normalizedSelect = normalizeCanonicalAssetSelectClause(select);

  let query = client
    .from("assets")
    .select(normalizedSelect)
    .order("updated_at", { ascending: false });

  if (requiresOwnerUserId) query = query.eq("owner_user_id", userId);
  if (walletId) query = query.eq("wallet_id", walletId);
  if (sectionKey && hasSectionKeyColumn) query = query.eq("section_key", sectionKey);
  if (sectionKeys && sectionKeys.length > 0 && hasSectionKeyColumn) query = query.in("section_key", sectionKeys);
  if (categoryKey && hasCategoryKeyColumn) query = query.eq("category_key", categoryKey);
  if (requiresDeletedAt) query = query.is("deleted_at", null);

  const result = await query;
  if (result.error || !result.data) {
    return result;
  }

  const normalizedRows = normalizeFetchedAssetRows(
    (result.data as unknown) as CanonicalAssetQueryRow[],
    { sectionKey, sectionKeys, categoryKey },
  );

  return {
    ...result,
    data: normalizedRows,
  };
}
