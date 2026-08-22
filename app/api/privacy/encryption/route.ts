import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { createVaultKeyEnvelope, decryptVaultPayload, encryptVaultField, InternalStagingVaultKeyProvider, validateVaultRecoverability } from "@/lib/privacy-security/encryption";

export async function POST(request: Request) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      walletId?: string;
      keyEnvelopeId?: string;
      recordTable?: string;
      recordId?: string;
      fieldName?: string;
      plaintext?: string;
    };
    const provider = new InternalStagingVaultKeyProvider();
    if (body.action === "create_envelope") {
      const envelope = await createVaultKeyEnvelope(access.admin, provider, {
        ownerUserId: access.user.id,
        walletId: body.walletId ?? null,
        createdByUserId: access.user.id,
      });
      return NextResponse.json({
        ok: true,
        envelope: {
          id: envelope.id,
          keyVersion: envelope.key_version,
          algorithm: envelope.algorithm,
          providerKey: envelope.wrapping_provider,
          providerAssurance: provider.assurance,
          wrappedOnly: true,
          keyMaterialReturned: false,
        },
      }, { status: 201 });
    }
    if (body.action === "encrypt_value") {
      if (!body.keyEnvelopeId || !body.fieldName || typeof body.plaintext !== "string") {
        return NextResponse.json({ ok: false, error: "keyEnvelopeId, fieldName and plaintext are required." }, { status: 400 });
      }
      const encrypted = await encryptVaultField(access.admin, provider, {
        ownerUserId: access.user.id,
        walletId: body.walletId ?? null,
        keyEnvelopeId: body.keyEnvelopeId,
        recordTable: body.recordTable ?? null,
        recordId: body.recordId ?? null,
        fieldName: body.fieldName,
        plaintext: body.plaintext,
      });
      return NextResponse.json({
        ok: true,
        encrypted: {
          id: encrypted.id,
          algorithm: encrypted.payload.algorithm,
          keyVersion: encrypted.payload.keyVersion,
          nonce: encrypted.payload.nonce,
          ciphertextPresent: true,
          keyMaterialReturned: false,
        },
      }, { status: 201 });
    }
    if (body.action === "decrypt_value") {
      if (!body.recordId) return NextResponse.json({ ok: false, error: "payload id is required as recordId." }, { status: 400 });
      const plaintext = await decryptVaultPayload(access.admin, provider, { ownerUserId: access.user.id, payloadId: body.recordId });
      return NextResponse.json({ ok: true, value: plaintext, keyMaterialReturned: false });
    }
    if (body.action === "validate_recoverability") {
      if (!body.keyEnvelopeId) return NextResponse.json({ ok: false, error: "keyEnvelopeId is required." }, { status: 400 });
      const result = await validateVaultRecoverability(access.admin, provider, body.keyEnvelopeId, access.user.id);
      return NextResponse.json({ ok: true, recoverability: result });
    }
    return NextResponse.json({ ok: false, error: "unsupported_encryption_action" }, { status: 400 });
  } catch (error) {
    return identityErrorResponse(error);
  }
}
