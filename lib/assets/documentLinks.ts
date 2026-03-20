import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCanonicalAssets } from "./fetchCanonicalAssets";
import { sanitizeFileName } from "../validation/upload";

type AnySupabaseClient = SupabaseClient;
export const SUPPORTED_DOCUMENT_SECTION_KEYS = ["finances", "property", "business", "digital", "personal"] as const;
export type SupportedDocumentSectionKey = (typeof SUPPORTED_DOCUMENT_SECTION_KEYS)[number];

export type CanonicalAssetDocumentContext = {
  assetId: string;
  ownerUserId: string;
  organisationId: string;
  walletId: string;
  assetTitle: string;
  sectionKey: string;
  categoryKey: string;
};

export type CanonicalDocumentWorkspaceAsset = {
  id: string;
  title: string;
  providerName: string;
  providerKey: string;
  sectionKey: string;
  categoryKey: string;
  parentLabel: string;
};

export type CanonicalDocumentWorkspaceItem = {
  id: string;
  assetId: string;
  ownerUserId: string;
  storageBucket: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string | null;
  createdAt: string;
  documentKind: "document" | "photo";
  assetTitle: string;
  sectionKey: string;
  categoryKey: string;
  parentLabel: string;
};

export function getCanonicalAssetDocumentParentLabel(
  context:
    | Pick<CanonicalAssetDocumentContext, "assetTitle" | "sectionKey" | "categoryKey">
    | null
    | undefined,
) {
  const assetTitle = String(context?.assetTitle ?? "").trim();
  if (assetTitle) return assetTitle;

  const sectionKey = String(context?.sectionKey ?? "").trim();
  const categoryKey = String(context?.categoryKey ?? "").trim();
  const fallback = [sectionKey, categoryKey].filter(Boolean).join(" · ");
  return fallback || "this asset";
}

export function isPrintableDocumentMimeType(mimeType: string | null | undefined) {
  const normalized = String(mimeType ?? "").toLowerCase();
  return normalized === "application/pdf" || normalized.startsWith("image/");
}

export async function loadCanonicalDocumentWorkspaceData(
  client: AnySupabaseClient,
  {
    ownerUserId,
    sectionKeys,
  }: {
    ownerUserId: string;
    sectionKeys?: SupportedDocumentSectionKey[];
  },
): Promise<{ assets: CanonicalDocumentWorkspaceAsset[]; documents: CanonicalDocumentWorkspaceItem[] }> {
  const normalizedOwnerUserId = ownerUserId.trim();
  if (!normalizedOwnerUserId) {
    return { assets: [], documents: [] };
  }

  const filteredSectionKeys =
    sectionKeys && sectionKeys.length > 0
      ? sectionKeys.filter((value): value is SupportedDocumentSectionKey => SUPPORTED_DOCUMENT_SECTION_KEYS.includes(value))
      : [...SUPPORTED_DOCUMENT_SECTION_KEYS];

  const assetsResult = await fetchCanonicalAssets(client, {
    userId: normalizedOwnerUserId,
    sectionKeys: filteredSectionKeys,
    select: "id,title,provider_name,provider_key,section_key,category_key,metadata_json",
  });
  if (assetsResult.error) {
    throw new Error(assetsResult.error.message);
  }

  const assets = (((assetsResult.data ?? []) as unknown) as Array<Record<string, unknown>>).map((row) => {
    const sectionKey = String(row.section_key ?? "").trim();
    const categoryKey = String(row.category_key ?? "").trim();
    const title = String(row.title ?? "").trim();
    const providerName = String(row.provider_name ?? "").trim();
    return {
      id: String(row.id ?? ""),
      title,
      providerName,
      providerKey: String(row.provider_key ?? "").trim(),
      sectionKey,
      categoryKey,
      parentLabel: getCanonicalAssetDocumentParentLabel({
        assetTitle: title || providerName,
        sectionKey,
        categoryKey,
      }),
    } satisfies CanonicalDocumentWorkspaceAsset;
  });

  const assetIds = assets.map((asset) => asset.id).filter(Boolean);
  if (assetIds.length === 0) {
    return { assets, documents: [] };
  }

  const documentsResult = await client
    .from("documents")
    .select("id,asset_id,owner_user_id,storage_bucket,storage_path,file_name,mime_type,size_bytes,checksum,created_at,document_kind")
    .eq("owner_user_id", normalizedOwnerUserId)
    .in("asset_id", assetIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (documentsResult.error) {
    throw new Error(documentsResult.error.message);
  }

  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const documents = ((documentsResult.data ?? []) as Array<Record<string, unknown>>)
    .map((row) => {
      const assetId = String(row.asset_id ?? "");
      const asset = assetsById.get(assetId);
      if (!asset) return null;
      return {
        id: String(row.id ?? ""),
        assetId,
        ownerUserId: String(row.owner_user_id ?? ""),
        storageBucket: String(row.storage_bucket ?? ""),
        storagePath: String(row.storage_path ?? ""),
        fileName: String(row.file_name ?? ""),
        mimeType: String(row.mime_type ?? ""),
        sizeBytes: Number(row.size_bytes ?? 0),
        checksum: typeof row.checksum === "string" ? row.checksum : null,
        createdAt: String(row.created_at ?? ""),
        documentKind: row.document_kind === "photo" ? "photo" : "document",
        assetTitle: asset.title,
        sectionKey: asset.sectionKey,
        categoryKey: asset.categoryKey,
        parentLabel: asset.parentLabel,
      } satisfies CanonicalDocumentWorkspaceItem;
    })
    .filter((item): item is CanonicalDocumentWorkspaceItem => Boolean(item));

  return { assets, documents };
}

export async function resolveCanonicalAssetDocumentContext(
  client: AnySupabaseClient,
  {
    assetId,
    ownerUserId,
  }: {
    assetId: string;
    ownerUserId: string;
  },
): Promise<CanonicalAssetDocumentContext | null> {
  const normalizedAssetId = assetId.trim();
  const normalizedOwnerUserId = ownerUserId.trim();
  if (!normalizedAssetId || !normalizedOwnerUserId) return null;

  const result = await client
    .from("assets")
    .select("id,owner_user_id,organisation_id,wallet_id,title,section_key,category_key")
    .eq("id", normalizedAssetId)
    .eq("owner_user_id", normalizedOwnerUserId)
    .maybeSingle();

  if (result.error || !result.data?.id) return null;

  const row = result.data as {
    id: string;
    owner_user_id: string;
    organisation_id: string | null;
    wallet_id: string | null;
    title: string | null;
    section_key: string | null;
    category_key: string | null;
  };

  if (!row.organisation_id || !row.wallet_id) return null;

  return {
    assetId: String(row.id),
    ownerUserId: String(row.owner_user_id),
    organisationId: String(row.organisation_id),
    walletId: String(row.wallet_id),
    assetTitle: String(row.title ?? "").trim(),
    sectionKey: String(row.section_key ?? "").trim(),
    categoryKey: String(row.category_key ?? "").trim(),
  };
}

export async function createCanonicalAssetDocument(
  client: AnySupabaseClient,
  {
    context,
    file,
    kind,
  }: {
    context: CanonicalAssetDocumentContext;
    file: File;
    kind: "document" | "photo";
  },
): Promise<{ ok: true; storagePath: string } | { ok: false; error: string }> {
  const storageBucket = "vault-docs";
  const folder = kind === "photo" ? "photos" : "documents";
  const storagePath = buildCanonicalDocumentStoragePath(context, file.name, folder);

  const uploadResult = await client.storage.from(storageBucket).upload(storagePath, file, { upsert: false });
  if (uploadResult.error) {
    return { ok: false, error: `Upload failed: ${uploadResult.error.message}` };
  }

  const insertResult = await client.from("documents").insert({
    organisation_id: context.organisationId,
    wallet_id: context.walletId,
    asset_id: context.assetId,
    owner_user_id: context.ownerUserId,
    storage_bucket: storageBucket,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size,
    checksum: null,
    document_kind: kind,
  });

  if (insertResult.error) {
    await client.storage.from(storageBucket).remove([storagePath]);
    return { ok: false, error: `Document link failed: ${insertResult.error.message}` };
  }

  return { ok: true, storagePath };
}

export async function getStoredFileSignedUrl(
  client: AnySupabaseClient,
  {
    storageBucket,
    storagePath,
    expiresInSeconds,
  }: {
    storageBucket: string;
    storagePath: string;
    expiresInSeconds: number;
  },
) {
  const result = await client.storage.from(storageBucket).createSignedUrl(storagePath, expiresInSeconds);
  if (result.error || !result.data?.signedUrl) {
    return null;
  }
  return result.data.signedUrl;
}

function buildCanonicalDocumentStoragePath(
  context: CanonicalAssetDocumentContext,
  fileName: string,
  folder: "documents" | "photos",
) {
  return `users/${context.ownerUserId}/assets/${context.assetId}/${folder}/${Date.now()}-${sanitizeFileName(fileName)}`;
}
