import type { SupabaseClient } from "@supabase/supabase-js";
import { hasColumn, hasTable } from "./schemaSafe";
import { isMissingColumnError, isMissingRelationError } from "./supabaseErrors";

type AnySupabaseClient = SupabaseClient;
type WalletRow = {
  id?: string | number | null;
  organisation_id?: string | number | null;
};
type MaybeSingleWalletResult = {
  data: WalletRow | null;
  error: { message: string } | null;
};

export type WalletContext = {
  organisationId: string | null;
  walletId: string;
};

export type WalletReadContext = {
  walletId: string | null;
  organisationId: string | null;
  warning: string | null;
};

export type AssetSensitivePayloadRow = {
  asset_id: string;
  payload: Record<string, unknown>;
};

export const SENSITIVE_ASSET_METADATA_KEYS = [
  "account_number",
  "sort_code",
  "iban",
  "swift_bic",
  "investment_reference",
  "pension_member_number",
  "policy_number",
  "debt_reference",
  "serial_number",
  "property_address",
  "registration_number",
  "wallet_reference",
  "beneficiary_address",
  "date_of_birth",
  "identification_reference",
  "contact_email",
  "contact_phone",
  "executor_address",
  "identity_reference",
  "private_instructions",
  "recovery_reference",
] as const;

export function extractSensitiveMetadata(metadata: Record<string, unknown>) {
  const sensitive: Record<string, unknown> = {};
  for (const key of SENSITIVE_ASSET_METADATA_KEYS) {
    const value = metadata[key];
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && !value.trim()) continue;
    sensitive[key] = value;
  }
  return sensitive;
}

export function stripSensitiveMetadata(metadata: Record<string, unknown>) {
  const clone = { ...metadata };
  for (const key of SENSITIVE_ASSET_METADATA_KEYS) {
    delete clone[key];
  }
  return clone;
}

export async function loadSensitiveAssetPayloads(
  client: AnySupabaseClient,
  assetIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const ids = assetIds.map((value) => value.trim()).filter(Boolean);
  if (!ids.length) return new Map();

  const response = await client.rpc("get_assets_sensitive_payloads", {
    p_asset_ids: ids,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  const rows = (response.data ?? []) as Array<{
    asset_id?: string | null;
    payload?: Record<string, unknown> | null;
  }>;
  const payloads = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const assetId = String(row.asset_id ?? "").trim();
    if (!assetId) continue;
    payloads.set(assetId, row.payload ?? {});
  }
  return payloads;
}

export async function ensureWalletContext(client: AnySupabaseClient, userId: string): Promise<WalletContext> {
  if (!userId.trim()) {
    throw new Error("Wallet resolution failed: user id is required.");
  }

  const walletTableExists = await hasTable(client, "wallets");
  if (!walletTableExists) {
    throw new Error("Wallet resolution failed: wallets table is unavailable.");
  }

  const [
    hasWalletOrganisationId,
    hasWalletStatus,
    hasWalletLabel,
    hasWalletCreatedAt,
    hasWalletOwnerUserId,
    hasOrganisationTable,
  ] = await Promise.all([
    hasColumn(client, "wallets", "organisation_id"),
    hasColumn(client, "wallets", "status"),
    hasColumn(client, "wallets", "label"),
    hasColumn(client, "wallets", "created_at"),
    hasColumn(client, "wallets", "owner_user_id"),
    hasTable(client, "organisations"),
  ]);

  if (!hasWalletOwnerUserId) {
    throw new Error("Wallet resolution failed: wallets.owner_user_id is unavailable.");
  }

  // Reuse the shared read resolver first so read/write paths stay aligned, but do not
  // return early because canonical asset writes may still need an organisation created
  // or backfilled onto an existing wallet.
  const existing = await resolveWalletContextForRead(client, userId);
  let walletId = existing.walletId ?? "";
  let organisationId = existing.organisationId ?? "";

  const existingWalletWithOrg = await findPreferredWallet(client, userId, {
    hasWalletOrganisationId,
    hasWalletStatus,
    hasWalletCreatedAt,
  });
  if (existingWalletWithOrg.error) {
    if (!isMissingRelationError(existingWalletWithOrg.error, "wallets")) {
      throw new Error(existingWalletWithOrg.error.message);
    }
    throw new Error("Wallet resolution failed: wallets table is unavailable.");
  }

  if (!walletId) {
    walletId = existingWalletWithOrg.data?.id ? String(existingWalletWithOrg.data.id) : "";
  }
  if (!organisationId) {
    organisationId =
      hasWalletOrganisationId && existingWalletWithOrg.data?.organisation_id
        ? String(existingWalletWithOrg.data.organisation_id)
        : "";
  }

  const [hasOrganisationOwnerUserId, hasOrganisationCreatedAt] = hasOrganisationTable
    ? await Promise.all([
        hasColumn(client, "organisations", "owner_user_id"),
        hasColumn(client, "organisations", "created_at"),
      ])
    : [false, false];

  if (!organisationId && hasOrganisationTable && hasOrganisationOwnerUserId) {
    let existingOrganisationQuery = client
      .from("organisations")
      .select("id")
      .eq("owner_user_id", userId);
    if (hasOrganisationCreatedAt) {
      existingOrganisationQuery = existingOrganisationQuery.order("created_at", { ascending: true });
    }
    const existingOrganisation = await existingOrganisationQuery.limit(1).maybeSingle();
    if (existingOrganisation.error && !isMissingRelationError(existingOrganisation.error, "organisations")) {
      throw new Error(existingOrganisation.error.message);
    }

    if (existingOrganisation.data?.id) {
      organisationId = String(existingOrganisation.data.id);
    }
  }

  if (!organisationId && hasOrganisationTable && hasOrganisationOwnerUserId) {
    const createdOrganisation = await client
      .from("organisations")
      .insert({ owner_user_id: userId, name: "Primary organisation" })
      .select("id")
      .single();

    if (createdOrganisation.error || !createdOrganisation.data?.id) {
      throw new Error(createdOrganisation.error?.message || "Could not create organisation.");
    }
    organisationId = String(createdOrganisation.data.id);
  }

  if (!walletId) {
    if (hasWalletOrganisationId && !organisationId) {
      throw new Error("Wallet resolution failed: wallets.organisation_id is required but organisation context is unavailable.");
    }
    const walletInsertPayload: Record<string, unknown> = {
      owner_user_id: userId,
    };
    if (hasWalletLabel) walletInsertPayload.label = "Primary wallet";
    if (hasWalletStatus) walletInsertPayload.status = "active";
    if (hasWalletOrganisationId) {
      walletInsertPayload.organisation_id = organisationId;
    }

    const createdWallet = await client
      .from("wallets")
      .insert(walletInsertPayload)
      .select("id")
      .single();

    if (createdWallet.error || !createdWallet.data?.id) {
      throw new Error(createdWallet.error?.message || "Could not create wallet.");
    }

    walletId = String(createdWallet.data.id);
  }

  if (!walletId) {
    throw new Error("Could not resolve canonical wallet context.");
  }

  if (hasWalletStatus || (hasWalletOrganisationId && organisationId)) {
    const walletPatch: Record<string, unknown> = {};
    if (hasWalletStatus) walletPatch.status = "active";
    if (hasWalletOrganisationId && organisationId) walletPatch.organisation_id = organisationId;
    if (Object.keys(walletPatch).length > 0) {
      const walletNormalize = await client
        .from("wallets")
        .update(walletPatch)
        .eq("id", walletId)
        .eq("owner_user_id", userId);
      if (walletNormalize.error) {
        throw new Error(walletNormalize.error.message);
      }
    }
  }

  if (hasWalletOrganisationId && organisationId) {
    const walletWithOrg = await client
      .from("wallets")
      .select("id,organisation_id")
      .eq("id", walletId)
      .maybeSingle();

    if (walletWithOrg.error && !isMissingColumnError(walletWithOrg.error, "organisation_id")) {
      throw new Error(walletWithOrg.error.message);
    }

    if (!walletWithOrg.error && walletWithOrg.data?.organisation_id) {
      organisationId = String(walletWithOrg.data.organisation_id);
    } else if (!walletWithOrg.error && !walletWithOrg.data?.organisation_id) {
      const walletUpdate = await client
        .from("wallets")
        .update({ organisation_id: organisationId })
        .eq("id", walletId)
        .eq("owner_user_id", userId);
      if (walletUpdate.error && !isMissingColumnError(walletUpdate.error, "organisation_id")) {
        throw new Error(walletUpdate.error.message);
      }
    }
  }

  return { walletId, organisationId: organisationId || null };
}

export async function resolveWalletContextForRead(
  client: AnySupabaseClient,
  userId: string,
): Promise<WalletReadContext> {
  if (!userId.trim()) {
    return { walletId: null, organisationId: null, warning: "user-id-missing" };
  }

  const walletTableExists = await hasTable(client, "wallets");
  if (!walletTableExists) {
    return { walletId: null, organisationId: null, warning: "wallets-table-unavailable" };
  }

  const [hasWalletStatus, hasWalletCreatedAt, hasWalletOwnerUserId, hasWalletOrganisationId] =
    await Promise.all([
      hasColumn(client, "wallets", "status"),
      hasColumn(client, "wallets", "created_at"),
      hasColumn(client, "wallets", "owner_user_id"),
      hasColumn(client, "wallets", "organisation_id"),
    ]);

  if (!hasWalletOwnerUserId) {
    return { walletId: null, organisationId: null, warning: "wallet-owner-column-unavailable" };
  }

  const walletRes = await findPreferredWallet(client, userId, {
    hasWalletOrganisationId,
    hasWalletStatus,
    hasWalletCreatedAt,
  });
  if (walletRes.error) {
    if (isMissingRelationError(walletRes.error, "wallets")) {
      return { walletId: null, organisationId: null, warning: "wallets-table-unavailable" };
    }
    return { walletId: null, organisationId: null, warning: walletRes.error.message };
  }

  const walletId = walletRes.data?.id ? String(walletRes.data.id) : null;
  let organisationId = walletRes.data?.organisation_id ? String(walletRes.data.organisation_id) : null;
  if (!walletId) {
    let fallbackOrganisationId: string | null = null;

    const hasOrganisationsTable = await hasTable(client, "organisations");
    if (hasOrganisationsTable) {
      const hasOrgOwnerUserId = await hasColumn(client, "organisations", "owner_user_id");
      if (hasOrgOwnerUserId) {
        const orgRes = await client
          .from("organisations")
          .select("id")
          .eq("owner_user_id", userId)
          .limit(1)
          .maybeSingle();

        if (!orgRes.error && orgRes.data?.id) {
          fallbackOrganisationId = String(orgRes.data.id);
        }
      }
    }

    return { walletId: null, organisationId: fallbackOrganisationId, warning: "wallet-not-found" };
  }

  const hasOrganisationsTable = await hasTable(client, "organisations");
  if (!hasOrganisationsTable) {
    return { walletId, organisationId, warning: "organisations-table-unavailable" };
  }

  if (!organisationId) {
    const hasOrgOwnerUserId = await hasColumn(client, "organisations", "owner_user_id");
    if (hasOrgOwnerUserId) {
      const orgRes = await client
        .from("organisations")
        .select("id")
        .eq("owner_user_id", userId)
        .limit(1)
        .maybeSingle();
      if (!orgRes.error && orgRes.data?.id) {
        organisationId = String(orgRes.data.id);
      }
    }
  }

  return { walletId, organisationId, warning: null };
}

async function findPreferredWallet(
  client: AnySupabaseClient,
  userId: string,
  {
    hasWalletOrganisationId,
    hasWalletStatus,
    hasWalletCreatedAt,
  }: {
    hasWalletOrganisationId: boolean;
    hasWalletStatus: boolean;
    hasWalletCreatedAt: boolean;
  },
): Promise<MaybeSingleWalletResult> {
  const selectColumns = hasWalletOrganisationId ? "id,organisation_id" : "id";

  let activeWalletQuery = client
    .from("wallets")
    .select(selectColumns)
    .eq("owner_user_id", userId);
  if (hasWalletStatus) activeWalletQuery = activeWalletQuery.eq("status", "active");
  if (hasWalletCreatedAt) activeWalletQuery = activeWalletQuery.order("created_at", { ascending: true });

  const activeWallet = (await activeWalletQuery.limit(1).maybeSingle()) as MaybeSingleWalletResult;
  if (activeWallet.error) return activeWallet;
  if (activeWallet.data?.id || !hasWalletStatus) {
    return activeWallet;
  }

  let fallbackWalletQuery = client
    .from("wallets")
    .select(selectColumns)
    .eq("owner_user_id", userId);
  if (hasWalletCreatedAt) fallbackWalletQuery = fallbackWalletQuery.order("created_at", { ascending: true });

  const fallbackWallet = (await fallbackWalletQuery.limit(1).maybeSingle()) as MaybeSingleWalletResult;
  return fallbackWallet;
}
