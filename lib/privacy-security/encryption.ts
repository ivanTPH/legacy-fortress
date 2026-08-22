import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type AnySupabaseClient = SupabaseClient;

export type VaultKeyEnvelope = {
  id?: string;
  ownerUserId: string;
  walletId?: string | null;
  keyVersion: number;
  algorithm: "AES-256-GCM";
  wrappingProvider: string;
  wrappingKeyReference: string;
  wrappedDek: string;
  recoveryProvider?: string | null;
  recoveryKeyReference?: string | null;
  recoveryWrappedDek?: string | null;
};

export type EncryptedPayload = {
  algorithm: "AES-256-GCM";
  keyVersion: number;
  nonce: string;
  authTag: string;
  ciphertext: string;
  aadContext: Record<string, unknown>;
};

export type VaultKeyManagementProvider = {
  providerKey: string;
  assurance: "staging_test_only" | "production_kms";
  createVaultKey(input: { ownerUserId: string; walletId?: string | null }): Promise<{ plaintextDek: Buffer; keyReference: string }>;
  wrapDataKey(input: { plaintextDek: Buffer; purpose: "normal" | "estate_recovery"; ownerUserId: string; walletId?: string | null }): Promise<{ wrappedDek: string; wrappingKeyReference: string }>;
  unwrapDataKey(input: { wrappedDek: string; purpose: "normal" | "estate_recovery"; ownerUserId: string; walletId?: string | null }): Promise<Buffer>;
  rotateWrappingKey(input: { wrappedDek: string; ownerUserId: string; walletId?: string | null }): Promise<{ wrappedDek: string; wrappingKeyReference: string }>;
  validateRecoverability(input: { wrappedDek: string; recoveryWrappedDek?: string | null; ownerUserId: string; walletId?: string | null }): Promise<{ status: "valid" | "warning" | "failed"; checkedAt: string }>;
  destroyKeyReference(input: { keyReference: string; reason: string }): Promise<{ destroyed: boolean }>;
};

const TEST_PROVIDER_SECRET = "Legacy Fortress Phase 5 staging test wrapping provider. Not production KMS.";

export class InternalStagingVaultKeyProvider implements VaultKeyManagementProvider {
  providerKey = "lf_internal_staging_envelope_v1";
  assurance = "staging_test_only" as const;

  async createVaultKey(input: { ownerUserId: string; walletId?: string | null }) {
    return {
      plaintextDek: crypto.randomBytes(32),
      keyReference: `lf-staging-wrap:${hashRef(`${input.ownerUserId}:${input.walletId ?? "no-wallet"}:${Date.now()}`)}`,
    };
  }

  async wrapDataKey(input: { plaintextDek: Buffer; purpose: "normal" | "estate_recovery"; ownerUserId: string; walletId?: string | null }) {
    const key = deriveWrappingKey(input.purpose, input.ownerUserId, input.walletId);
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(Buffer.from(input.purpose));
    const ciphertext = Buffer.concat([cipher.update(input.plaintextDek), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      wrappedDek: `v1.${nonce.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`,
      wrappingKeyReference: `lf-staging-${input.purpose}:${hashRef(`${input.ownerUserId}:${input.walletId ?? "no-wallet"}`)}`,
    };
  }

  async unwrapDataKey(input: { wrappedDek: string; purpose: "normal" | "estate_recovery"; ownerUserId: string; walletId?: string | null }) {
    const [, nonceText, tagText, ciphertextText] = input.wrappedDek.split(".");
    if (!nonceText || !tagText || !ciphertextText) throw new Error("invalid_wrapped_dek");
    const key = deriveWrappingKey(input.purpose, input.ownerUserId, input.walletId);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(nonceText, "base64url"));
    decipher.setAAD(Buffer.from(input.purpose));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]);
  }

  async rotateWrappingKey(input: { wrappedDek: string; ownerUserId: string; walletId?: string | null }) {
    const plaintextDek = await this.unwrapDataKey({ ...input, purpose: "normal" });
    return this.wrapDataKey({ plaintextDek, purpose: "normal", ownerUserId: input.ownerUserId, walletId: input.walletId });
  }

  async validateRecoverability(input: { wrappedDek: string; recoveryWrappedDek?: string | null; ownerUserId: string; walletId?: string | null }) {
    await this.unwrapDataKey({ wrappedDek: input.wrappedDek, purpose: "normal", ownerUserId: input.ownerUserId, walletId: input.walletId });
    if (input.recoveryWrappedDek) {
      await this.unwrapDataKey({ wrappedDek: input.recoveryWrappedDek, purpose: "estate_recovery", ownerUserId: input.ownerUserId, walletId: input.walletId });
    }
    return { status: "valid" as const, checkedAt: new Date().toISOString() };
  }

  async destroyKeyReference() {
    return { destroyed: false };
  }
}

export function encryptWithDek(plaintext: string | Buffer, dek: Buffer, aadContext: Record<string, unknown>, keyVersion: number): EncryptedPayload {
  if (dek.length !== 32) throw new Error("aes_256_gcm_requires_32_byte_dek");
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dek, nonce);
  cipher.setAAD(Buffer.from(canonicalJson(aadContext)));
  const ciphertext = Buffer.concat([cipher.update(Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext, "utf8")), cipher.final()]);
  return {
    algorithm: "AES-256-GCM",
    keyVersion,
    nonce: nonce.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    aadContext,
  };
}

export function decryptWithDek(payload: EncryptedPayload, dek: Buffer) {
  if (payload.algorithm !== "AES-256-GCM") throw new Error("unsupported_payload_algorithm");
  const decipher = crypto.createDecipheriv("aes-256-gcm", dek, Buffer.from(payload.nonce, "base64url"));
  decipher.setAAD(Buffer.from(canonicalJson(payload.aadContext)));
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, "base64url")), decipher.final()]);
}

export async function createVaultKeyEnvelope(client: AnySupabaseClient, provider: VaultKeyManagementProvider, input: { ownerUserId: string; walletId?: string | null; createdByUserId?: string | null }) {
  const created = await provider.createVaultKey({ ownerUserId: input.ownerUserId, walletId: input.walletId });
  const normalWrap = await provider.wrapDataKey({ plaintextDek: created.plaintextDek, purpose: "normal", ownerUserId: input.ownerUserId, walletId: input.walletId });
  const recoveryWrap = await provider.wrapDataKey({ plaintextDek: created.plaintextDek, purpose: "estate_recovery", ownerUserId: input.ownerUserId, walletId: input.walletId });
  const insert = await client.from("vault_key_envelopes").insert({
    owner_user_id: input.ownerUserId,
    wallet_id: input.walletId ?? null,
    key_version: 1,
    algorithm: "AES-256-GCM",
    wrapping_provider: provider.providerKey,
    wrapping_key_reference: normalWrap.wrappingKeyReference,
    wrapped_dek: normalWrap.wrappedDek,
    recovery_provider: provider.providerKey,
    recovery_key_reference: recoveryWrap.wrappingKeyReference,
    recovery_wrapped_dek: recoveryWrap.wrappedDek,
    created_by_user_id: input.createdByUserId ?? input.ownerUserId,
    metadata: { provider_assurance: provider.assurance, client_key_material_returned: false },
  }).select("id,owner_user_id,wallet_id,key_version,algorithm,wrapping_provider,wrapping_key_reference,wrapped_dek,recovery_provider,recovery_key_reference,recovery_wrapped_dek").single();
  created.plaintextDek.fill(0);
  if (insert.error || !insert.data) throw new Error(insert.error?.message || "vault_key_envelope_create_failed");
  return insert.data;
}

export async function encryptVaultField(client: AnySupabaseClient, provider: VaultKeyManagementProvider, input: {
  ownerUserId: string;
  walletId?: string | null;
  keyEnvelopeId: string;
  recordTable?: string | null;
  recordId?: string | null;
  fieldName: string;
  plaintext: string;
  domain?: "identity" | "vault" | "estate" | "privacy";
}) {
  const envelope = await loadEnvelope(client, input.keyEnvelopeId, input.ownerUserId);
  const dek = await provider.unwrapDataKey({ wrappedDek: String(envelope.wrapped_dek), purpose: "normal", ownerUserId: input.ownerUserId, walletId: envelope.wallet_id as string | null });
  const aadContext = { owner_user_id: input.ownerUserId, wallet_id: input.walletId ?? envelope.wallet_id ?? null, record_table: input.recordTable ?? null, record_id: input.recordId ?? null, field_name: input.fieldName };
  const payload = encryptWithDek(input.plaintext, dek, aadContext, Number(envelope.key_version));
  dek.fill(0);
  const insert = await client.from("vault_encrypted_payloads").insert({
    owner_user_id: input.ownerUserId,
    wallet_id: input.walletId ?? envelope.wallet_id ?? null,
    key_envelope_id: input.keyEnvelopeId,
    domain: input.domain ?? "vault",
    record_table: input.recordTable ?? null,
    record_id: input.recordId ?? null,
    field_name: input.fieldName,
    algorithm: payload.algorithm,
    nonce: payload.nonce,
    auth_tag: payload.authTag,
    ciphertext: payload.ciphertext,
    aad_context: payload.aadContext,
  }).select("id,ciphertext,nonce,auth_tag").single();
  if (insert.error || !insert.data) throw new Error(insert.error?.message || "vault_payload_encrypt_failed");
  return { id: insert.data.id, payload };
}

export async function decryptVaultPayload(client: AnySupabaseClient, provider: VaultKeyManagementProvider, input: { ownerUserId: string; payloadId: string }) {
  const row = await client.from("vault_encrypted_payloads").select("id,key_envelope_id,algorithm,nonce,auth_tag,ciphertext,aad_context,owner_user_id").eq("id", input.payloadId).eq("owner_user_id", input.ownerUserId).single();
  if (row.error || !row.data) throw new Error(row.error?.message || "encrypted_payload_not_found");
  const envelope = await loadEnvelope(client, String(row.data.key_envelope_id), input.ownerUserId);
  const dek = await provider.unwrapDataKey({ wrappedDek: String(envelope.wrapped_dek), purpose: "normal", ownerUserId: input.ownerUserId, walletId: envelope.wallet_id as string | null });
  const plaintext = decryptWithDek({
    algorithm: "AES-256-GCM",
    keyVersion: Number(envelope.key_version),
    nonce: String(row.data.nonce),
    authTag: String(row.data.auth_tag),
    ciphertext: String(row.data.ciphertext),
    aadContext: row.data.aad_context as Record<string, unknown>,
  }, dek);
  dek.fill(0);
  return plaintext.toString("utf8");
}

export async function validateVaultRecoverability(client: AnySupabaseClient, provider: VaultKeyManagementProvider, envelopeId: string, ownerUserId: string) {
  const envelope = await loadEnvelope(client, envelopeId, ownerUserId);
  const result = await provider.validateRecoverability({
    wrappedDek: String(envelope.wrapped_dek),
    recoveryWrappedDek: envelope.recovery_wrapped_dek ? String(envelope.recovery_wrapped_dek) : null,
    ownerUserId,
    walletId: envelope.wallet_id as string | null,
  });
  await client.from("vault_key_envelopes").update({ recoverability_status: result.status, last_recoverability_check_at: result.checkedAt, updated_at: result.checkedAt }).eq("id", envelopeId);
  return result;
}

async function loadEnvelope(client: AnySupabaseClient, envelopeId: string, ownerUserId: string) {
  const envelope = await client.from("vault_key_envelopes").select("*").eq("id", envelopeId).eq("owner_user_id", ownerUserId).eq("status", "active").single();
  if (envelope.error || !envelope.data) throw new Error(envelope.error?.message || "vault_key_envelope_not_found");
  return envelope.data;
}

function deriveWrappingKey(purpose: string, ownerUserId: string, walletId?: string | null) {
  return crypto.createHash("sha256").update(TEST_PROVIDER_SECRET).update(purpose).update(ownerUserId).update(walletId ?? "no-wallet").digest();
}

function hashRef(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function canonicalJson(value: Record<string, unknown>) {
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
}
