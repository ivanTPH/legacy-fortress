import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ensureWalletContext,
  extractSensitiveMetadata,
  stripSensitiveMetadata,
} from "../canonicalPersistence";
import { normalizeCanonicalBankMetadata } from "./bankAsset";
import { normalizeCanonicalBusinessMetadata } from "./businessAsset";
import { normalizeCanonicalDigitalMetadata } from "./digitalAsset";
import { normalizeCanonicalPropertyMetadata } from "./propertyAsset";
import { normalizeCanonicalBeneficiaryMetadata } from "./beneficiaryAsset";
import { normalizeCanonicalExecutorMetadata } from "./executorAsset";
import { normalizeCanonicalTaskMetadata } from "./taskAsset";
import { hasColumn } from "../schemaSafe";
import { isMissingColumnError, isMissingRelationError } from "../supabaseErrors";

type AnySupabaseClient = SupabaseClient;

export type CreateAssetInput = {
  userId: string;
  categorySlug: "bank-accounts" | "property" | "business-interests" | "digital-assets" | "beneficiaries" | "executors" | "tasks";
  title: string;
  metadata: Record<string, unknown>;
  visibility?: "private" | "shared";
};

export type CreatedAssetRow = {
  id: string;
  owner_user_id: string;
  wallet_id: string;
  section_key: string;
  category_key: string;
  title: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
};

export type CreateAssetResult = {
  id: string;
  row: CreatedAssetRow;
};

export type UpdateAssetInput = {
  assetId: string;
  userId: string;
  categorySlug: "bank-accounts" | "property" | "business-interests" | "digital-assets" | "beneficiaries" | "executors" | "tasks";
  title: string;
  metadata: Record<string, unknown>;
  visibility?: "private" | "shared";
  status?: "active" | "archived";
};

type CategoryLookup = {
  id: string;
  token: string;
};

export async function lookupCategoryBySlug(client: AnySupabaseClient, slug: string): Promise<CategoryLookup> {
  const normalizedSlug = normalizeCategoryToken(slug);
  const candidates = getCategorySlugCandidates(normalizedSlug);

  const tryColumns: Array<"slug" | "key" | "category_key" | "name"> = ["slug", "key", "category_key", "name"];
  for (const column of tryColumns) {
    for (const candidate of candidates) {
      let query = client
        .from("asset_categories")
        .select(`id,${column}`);

      if (column === "name") {
        query = query.ilike(column, candidate.replace(/-/g, " "));
      } else {
        query = query.eq(column, candidate);
      }

      const response = await query.maybeSingle();
      if (response.error) {
        if (isMissingRelationError(response.error, "asset_categories") || isMissingColumnError(response.error, column)) {
          continue;
        }
        throw new Error(response.error.message);
      }
      if (response.data?.id) {
        return {
          id: response.data.id,
          token: normalizeCategoryToken(String((response.data as Record<string, unknown>)[column] ?? candidate)),
        };
      }
    }
  }

  throw new Error(`Category not found for slug: ${slug}`);
}

export async function createAsset(client: AnySupabaseClient, input: CreateAssetInput): Promise<CreateAssetResult> {
  validateCreateAssetInput(input);

  const normalizedMetadata: Record<string, unknown> =
    input.categorySlug === "bank-accounts"
      ? normalizeCanonicalBankMetadata(input.metadata)
      : input.categorySlug === "property"
        ? normalizeCanonicalPropertyMetadata(input.metadata)
        : input.categorySlug === "business-interests"
        ? normalizeCanonicalBusinessMetadata(input.metadata)
        : input.categorySlug === "digital-assets"
          ? normalizeCanonicalDigitalMetadata(input.metadata)
          : input.categorySlug === "beneficiaries"
            ? normalizeCanonicalBeneficiaryMetadata(input.metadata)
            : input.categorySlug === "executors"
              ? normalizeCanonicalExecutorMetadata(input.metadata)
              : input.categorySlug === "tasks"
                ? normalizeCanonicalTaskMetadata(input.metadata)
        : input.metadata;

  if (input.categorySlug === "bank-accounts") {
    validateBankAssetMetadata(normalizedMetadata);
  }
  if (input.categorySlug === "property") {
    validatePropertyAssetMetadata(normalizedMetadata);
  }
  if (input.categorySlug === "business-interests") {
    validateBusinessAssetMetadata(normalizedMetadata);
  }
  if (input.categorySlug === "digital-assets") {
    validateDigitalAssetMetadata(normalizedMetadata);
  }
  if (input.categorySlug === "beneficiaries") {
    validateBeneficiaryAssetMetadata(normalizedMetadata);
  }
  if (input.categorySlug === "executors") {
    validateExecutorAssetMetadata(normalizedMetadata);
  }
  if (input.categorySlug === "tasks") {
    validateTaskAssetMetadata(normalizedMetadata);
  }

  const wallet = await ensureWalletContext(client, input.userId);
  const category = await lookupCategoryBySlug(client, input.categorySlug);
  const sectionKey = sectionKeyFromCategory(input.categorySlug);
  const categoryKey = categoryKeyFromSlug(input.categorySlug);
  const hasAssetOrganisationId = await hasColumn(client, "assets", "organisation_id");

  const currency = String(normalizedMetadata["currency_code"] ?? normalizedMetadata["currency"] ?? "GBP").trim().toUpperCase() || "GBP";
  const estimatedValue = Number(normalizedMetadata["value_major"] ?? normalizedMetadata["estimated_value"] ?? 0);
  const valueMinor = Number.isFinite(estimatedValue) ? Math.round(estimatedValue * 100) : 0;

  const metadata = {
    ...normalizedMetadata,
    visibility: input.visibility ?? "private",
    asset_category_id: category.id,
    asset_category_token: category.token,
    category_slug: input.categorySlug,
  };

  const sensitivePayload = extractSensitiveMetadata(metadata);
  const publicMetadata = stripSensitiveMetadata(metadata);

  if (hasAssetOrganisationId && !wallet.organisationId) {
    throw new Error("Asset save failed: assets.organisation_id is required but organisation context is unavailable.");
  }

  const payload: Record<string, unknown> = {
    wallet_id: wallet.walletId,
    owner_user_id: input.userId,
    section_key: sectionKey,
    category_key: categoryKey,
    title: input.title.trim(),
    provider_name: String(normalizedMetadata["provider_name"] ?? normalizedMetadata["institution_name"] ?? "").trim() || null,
    provider_key: String(normalizedMetadata["provider_key"] ?? "").trim() || null,
    summary: String(normalizedMetadata["notes"] ?? "").trim() || null,
    value_minor: valueMinor,
    currency_code: currency,
    visibility: input.visibility ?? "private",
    status: "active",
    metadata_json: publicMetadata,
  };
  if (hasAssetOrganisationId && wallet.organisationId) {
    payload.organisation_id = wallet.organisationId;
  }

  const insertRes = await client.from("assets").insert(payload).select("id").single();
  if (insertRes.error) {
    throw new Error(insertRes.error.message);
  }

  const createdId = String(insertRes.data?.id ?? "").trim();
  if (!createdId) {
    throw new Error("Failed to create asset record.");
  }

  if (Object.keys(sensitivePayload).length > 0) {
    const sensitiveRes = await client.rpc("upsert_asset_sensitive_payload", {
      p_asset_id: createdId,
      p_payload: sensitivePayload,
    });
    if (sensitiveRes.error) {
      throw new Error(sensitiveRes.error.message);
    }
  }

  const verifyRes = await client
    .from("assets")
    .select("id,owner_user_id,wallet_id,section_key,category_key,title,metadata_json,created_at")
    .eq("id", createdId)
    .eq("owner_user_id", input.userId)
    .eq("wallet_id", wallet.walletId)
    .maybeSingle();

  if (verifyRes.error) {
    throw new Error(verifyRes.error.message);
  }
  if (!verifyRes.data) {
    throw new Error("Asset insert verification failed: created row not retrievable.");
  }

  const row = verifyRes.data as CreatedAssetRow;
  if (row.section_key !== sectionKey || row.category_key !== categoryKey) {
    throw new Error("Asset insert verification failed: category mapping mismatch.");
  }

  const dashboardLookup = await client
    .from("assets")
    .select("id,owner_user_id,section_key,category_key,status,archived_at,created_at")
    .eq("owner_user_id", input.userId)
    .eq("wallet_id", wallet.walletId)
    .eq("id", createdId)
    .is("deleted_at", null)
    .maybeSingle();

  if (dashboardLookup.error) {
    throw new Error(dashboardLookup.error.message);
  }
  if (!dashboardLookup.data) {
    throw new Error("Asset insert verification failed: created row not visible in dashboard query.");
  }

  if (input.categorySlug === "bank-accounts") {
    const bankLookup = await client
      .from("assets")
      .select("id")
      .eq("owner_user_id", input.userId)
      .eq("wallet_id", wallet.walletId)
      .eq("section_key", "finances")
      .eq("category_key", "bank")
      .eq("id", createdId)
      .is("deleted_at", null)
      .maybeSingle();

    if (bankLookup.error) {
      throw new Error(bankLookup.error.message);
    }
    if (!bankLookup.data) {
      throw new Error("Asset insert verification failed: created row not visible in bank section query.");
    }
  }

  return { id: createdId, row };
}

export async function updateAsset(client: AnySupabaseClient, input: UpdateAssetInput): Promise<CreateAssetResult> {
  validateUpdateAssetInput(input);

  const normalizedMetadata: Record<string, unknown> =
    input.categorySlug === "bank-accounts"
      ? normalizeCanonicalBankMetadata(input.metadata)
      : input.categorySlug === "property"
        ? normalizeCanonicalPropertyMetadata(input.metadata)
        : input.categorySlug === "business-interests"
        ? normalizeCanonicalBusinessMetadata(input.metadata)
        : input.categorySlug === "digital-assets"
          ? normalizeCanonicalDigitalMetadata(input.metadata)
          : input.categorySlug === "beneficiaries"
            ? normalizeCanonicalBeneficiaryMetadata(input.metadata)
            : input.categorySlug === "executors"
              ? normalizeCanonicalExecutorMetadata(input.metadata)
              : input.categorySlug === "tasks"
                ? normalizeCanonicalTaskMetadata(input.metadata)
        : input.metadata;

  if (input.categorySlug === "bank-accounts") {
    validateBankAssetMetadata(normalizedMetadata);
  }
  if (input.categorySlug === "property") {
    validatePropertyAssetMetadata(normalizedMetadata);
  }
  if (input.categorySlug === "business-interests") {
    validateBusinessAssetMetadata(normalizedMetadata);
  }
  if (input.categorySlug === "digital-assets") {
    validateDigitalAssetMetadata(normalizedMetadata);
  }
  if (input.categorySlug === "beneficiaries") {
    validateBeneficiaryAssetMetadata(normalizedMetadata);
  }
  if (input.categorySlug === "executors") {
    validateExecutorAssetMetadata(normalizedMetadata);
  }
  if (input.categorySlug === "tasks") {
    validateTaskAssetMetadata(normalizedMetadata);
  }

  const wallet = await ensureWalletContext(client, input.userId);
  const category = await lookupCategoryBySlug(client, input.categorySlug);
  const sectionKey = sectionKeyFromCategory(input.categorySlug);
  const categoryKey = categoryKeyFromSlug(input.categorySlug);
  const currency = String(normalizedMetadata["currency_code"] ?? normalizedMetadata["currency"] ?? "GBP").trim().toUpperCase() || "GBP";
  const estimatedValue = Number(normalizedMetadata["value_major"] ?? normalizedMetadata["estimated_value"] ?? 0);
  const valueMinor = Number.isFinite(estimatedValue) ? Math.round(estimatedValue * 100) : 0;

  const metadata = {
    ...normalizedMetadata,
    visibility: input.visibility ?? "private",
    asset_category_id: category.id,
    asset_category_token: category.token,
    category_slug: input.categorySlug,
  };

  const sensitivePayload = extractSensitiveMetadata(metadata);
  const publicMetadata = stripSensitiveMetadata(metadata);

  const payload: Record<string, unknown> = {
    title: input.title.trim(),
    provider_name: String(normalizedMetadata["provider_name"] ?? normalizedMetadata["institution_name"] ?? "").trim() || null,
    provider_key: String(normalizedMetadata["provider_key"] ?? "").trim() || null,
    summary: String(normalizedMetadata["notes"] ?? "").trim() || null,
    value_minor: valueMinor,
    currency_code: currency,
    visibility: input.visibility ?? "private",
    status: input.status ?? "active",
    metadata_json: publicMetadata,
    updated_at: new Date().toISOString(),
  };

  if (input.status === "archived") {
    payload.archived_at = new Date().toISOString();
  } else {
    payload.archived_at = null;
  }

  const updateRes = await client
    .from("assets")
    .update(payload)
    .eq("id", input.assetId)
    .eq("owner_user_id", input.userId)
    .eq("wallet_id", wallet.walletId)
    .eq("section_key", sectionKey)
    .eq("category_key", categoryKey)
    .is("deleted_at", null)
    .select("id")
    .single();

  if (updateRes.error) {
    throw new Error(updateRes.error.message);
  }

  const updatedId = String(updateRes.data?.id ?? "").trim();
  if (!updatedId) {
    throw new Error("Failed to update asset record.");
  }

  const sensitiveRes = await client.rpc("upsert_asset_sensitive_payload", {
    p_asset_id: updatedId,
    p_payload: sensitivePayload,
  });
  if (sensitiveRes.error) {
    throw new Error(sensitiveRes.error.message);
  }

  const verifyRes = await client
    .from("assets")
    .select("id,owner_user_id,wallet_id,section_key,category_key,title,metadata_json,created_at")
    .eq("id", updatedId)
    .eq("owner_user_id", input.userId)
    .eq("wallet_id", wallet.walletId)
    .is("deleted_at", null)
    .maybeSingle();

  if (verifyRes.error) {
    throw new Error(verifyRes.error.message);
  }
  if (!verifyRes.data) {
    throw new Error("Asset update verification failed: updated row not retrievable.");
  }

  const row = verifyRes.data as CreatedAssetRow;
  if (row.section_key !== sectionKey || row.category_key !== categoryKey) {
    throw new Error("Asset update verification failed: category mapping mismatch.");
  }
  return { id: updatedId, row };
}

function validateCreateAssetInput(input: CreateAssetInput) {
  if (!input.userId?.trim()) throw new Error("User is required.");
  if (!input.categorySlug?.trim()) throw new Error("Category is required.");
  if (!input.title?.trim()) throw new Error("Title is required.");
}

function validateUpdateAssetInput(input: UpdateAssetInput) {
  if (!input.assetId?.trim()) throw new Error("Asset id is required.");
  validateCreateAssetInput(input);
}

function validateBankAssetMetadata(metadata: Record<string, unknown>) {
  const institution = String(metadata["institution_name"] ?? "").trim();
  const accountType = String(metadata["account_type"] ?? "").trim();
  const accountNumber = String(metadata["account_number"] ?? "").trim();
  const country = String(metadata["country_code"] ?? metadata["country"] ?? "").trim();
  const currency = String(metadata["currency_code"] ?? metadata["currency"] ?? "").trim();

  if (!institution) throw new Error("Institution Name is required.");
  if (!accountType) throw new Error("Account Type is required.");
  if (!accountNumber) throw new Error("Account Number is required.");
  if (!country) throw new Error("Country is required.");
  if (!currency) throw new Error("Currency is required.");
}

function validatePropertyAssetMetadata(metadata: Record<string, unknown>) {
  const propertyType = String(metadata["property_type"] ?? "").trim();
  const ownershipType = String(metadata["ownership_type"] ?? "").trim();
  const address = String(metadata["property_address"] ?? "").trim();
  const country = String(metadata["property_country"] ?? "").trim();

  if (!propertyType) throw new Error("Property Type is required.");
  if (!ownershipType) throw new Error("Ownership Type is required.");
  if (!address) throw new Error("Address is required.");
  if (!country) throw new Error("Country is required.");
}

function validateBusinessAssetMetadata(metadata: Record<string, unknown>) {
  const businessName = String(metadata["business_name"] ?? metadata["title"] ?? "").trim();
  const businessType = String(metadata["business_type"] ?? "").trim();
  const jurisdiction = String(metadata["jurisdiction"] ?? "").trim();
  const businessStatus = String(metadata["business_status"] ?? "").trim();

  if (!businessName) throw new Error("Business Name is required.");
  if (!businessType) throw new Error("Business Type is required.");
  if (!jurisdiction) throw new Error("Jurisdiction is required.");
  if (!businessStatus) throw new Error("Status is required.");
}

function validateDigitalAssetMetadata(metadata: Record<string, unknown>) {
  const assetName = String(metadata["asset_name"] ?? metadata["title"] ?? "").trim();
  const assetType = String(metadata["digital_asset_type"] ?? "").trim();
  const provider = String(metadata["platform_provider"] ?? "").trim();
  const jurisdiction = String(metadata["jurisdiction"] ?? "").trim();
  const status = String(metadata["digital_status"] ?? "").trim();

  if (!assetName) throw new Error("Asset Name is required.");
  if (!assetType) throw new Error("Asset Type is required.");
  if (!provider) throw new Error("Platform / Provider is required.");
  if (!jurisdiction) throw new Error("Jurisdiction is required.");
  if (!status) throw new Error("Status is required.");
}

function validateBeneficiaryAssetMetadata(metadata: Record<string, unknown>) {
  const fullName = String(metadata["full_name"] ?? metadata["beneficiary_name"] ?? metadata["title"] ?? "").trim();
  const relationship = String(metadata["relationship_to_user"] ?? "").trim();
  const beneficiaryType = String(metadata["beneficiary_type"] ?? "").trim();
  const beneficiaryStatus = String(metadata["beneficiary_status"] ?? "").trim();

  if (!fullName) throw new Error("Full Name is required.");
  if (!relationship) throw new Error("Relationship is required.");
  if (!beneficiaryType) throw new Error("Beneficiary Type is required.");
  if (!beneficiaryStatus) throw new Error("Status is required.");
}

function validateExecutorAssetMetadata(metadata: Record<string, unknown>) {
  const fullName = String(metadata["full_name"] ?? metadata["executor_name"] ?? metadata["title"] ?? "").trim();
  const executorType = String(metadata["executor_type"] ?? "").trim();
  const relationship = String(metadata["relationship_to_user"] ?? "").trim();
  const authorityLevel = String(metadata["authority_level"] ?? "").trim();
  const jurisdiction = String(metadata["jurisdiction"] ?? "").trim();
  const executorStatus = String(metadata["executor_status"] ?? "").trim();

  if (!fullName) throw new Error("Full Name is required.");
  if (!executorType) throw new Error("Role / Type is required.");
  if (!relationship) throw new Error("Relationship is required.");
  if (!authorityLevel) throw new Error("Authority Level is required.");
  if (!jurisdiction) throw new Error("Jurisdiction is required.");
  if (!executorStatus) throw new Error("Status is required.");
}

function validateTaskAssetMetadata(metadata: Record<string, unknown>) {
  const title = String(metadata["task_title"] ?? metadata["title"] ?? "").trim();
  const relatedAssetId = String(metadata["related_asset_id"] ?? "").trim();
  const priority = String(metadata["priority"] ?? "").trim();
  const taskStatus = String(metadata["task_status"] ?? "").trim();

  if (!title) throw new Error("Task Title is required.");
  if (!relatedAssetId) throw new Error("Related Asset / Record is required.");
  if (!priority) throw new Error("Priority is required.");
  if (!taskStatus) throw new Error("Status is required.");
}

function getCategorySlugCandidates(slug: string) {
  const set = new Set<string>([slug]);
  if (slug === "bank-accounts") set.add("bank");
  if (slug === "business-interests") set.add("business");
  if (slug === "digital-assets") set.add("digital");
  if (slug === "beneficiaries") set.add("beneficiary");
  if (slug === "executors") {
    set.add("executor");
    set.add("trusted-contacts");
    set.add("trusted_contacts");
  }
  if (slug === "tasks") {
    set.add("task");
    set.add("action-tracking");
    set.add("actions");
  }
  return [...set];
}

function normalizeCategoryToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function sectionKeyFromCategory(categorySlug: CreateAssetInput["categorySlug"]) {
  if (categorySlug === "bank-accounts") return "finances";
  if (categorySlug === "property") return "property";
  if (categorySlug === "business-interests") return "business";
  if (categorySlug === "beneficiaries") return "personal";
  if (categorySlug === "executors") return "personal";
  if (categorySlug === "tasks") return "personal";
  return "digital";
}

function categoryKeyFromSlug(categorySlug: CreateAssetInput["categorySlug"]) {
  if (categorySlug === "bank-accounts") return "bank";
  if (categorySlug === "business-interests") return "business";
  if (categorySlug === "digital-assets") return "digital";
  if (categorySlug === "beneficiaries") return "beneficiaries";
  if (categorySlug === "executors") return "executors";
  if (categorySlug === "tasks") return "tasks";
  return "property";
}
