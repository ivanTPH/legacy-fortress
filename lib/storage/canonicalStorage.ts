import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentAttachmentEntity } from "../backend/domainEntities.ts";

type AnySupabaseClient = SupabaseClient;

export type StorageIntentType = "upload" | "preview" | "download" | "remove";

export type CanonicalStorageIntent = {
  type: StorageIntentType;
  bucket: string;
  path: string;
  fileName: string;
  mimeType?: string | null;
  ownerUserId: string;
  parentType: DocumentAttachmentEntity["parentType"];
  parentId: string;
};

export type CanonicalStorageAdapter = {
  createSignedUrl(intent: CanonicalStorageIntent, expiresInSeconds?: number): Promise<{ url: string }>;
  remove(intent: CanonicalStorageIntent): Promise<{ removed: boolean }>;
};

export const CANONICAL_STORAGE_BOUNDARY = {
  presentationSurface: "AttachmentGallery",
  metadataStores: ["asset_documents", "record_attachments"],
  storageBuckets: ["vault-docs"],
  rule: "Pages must not create page-level attachment systems; use shared document helpers and AttachmentGallery for preview/download/remove.",
  futureAdapter: "server_signed_storage_service",
} as const;

export function createSupabaseCanonicalStorageAdapter(client: AnySupabaseClient): CanonicalStorageAdapter {
  return {
    async createSignedUrl(intent, expiresInSeconds = 300) {
      const result = await client.storage.from(intent.bucket).createSignedUrl(intent.path, expiresInSeconds);
      if (result.error || !result.data?.signedUrl) {
        throw new Error(result.error?.message || "Could not create signed storage URL.");
      }
      return { url: result.data.signedUrl };
    },
    async remove(intent) {
      const result = await client.storage.from(intent.bucket).remove([intent.path]);
      if (result.error) throw new Error(result.error.message);
      return { removed: true };
    },
  };
}

export function buildCanonicalStorageIntent(input: CanonicalStorageIntent): CanonicalStorageIntent {
  return {
    ...input,
    bucket: input.bucket || "vault-docs",
    path: input.path.replace(/^\/+/, ""),
  };
}
