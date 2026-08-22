import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";
import { createPrivacyExport } from "@/lib/privacy-security/privacy";

export async function POST(request: Request) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const body = (await request.json().catch(() => ({}))) as { caseId?: string; exportType?: "portability" | "subject_access"; syntheticRunMarker?: string };
    const exportRow = await createPrivacyExport(access.admin, {
      caseId: body.caseId ?? null,
      subjectUserId: access.user.id,
      requestedByUserId: access.user.id,
      exportType: body.exportType ?? "portability",
      manifest: {
        format: "json",
        domains: ["identity_metadata", "vault_manifest", "consent_history"],
        excludes: ["credentials", "authentication_tokens", "key_material", "internal_risk_rules", "third_party_private_data"],
      },
      syntheticRunMarker: body.syntheticRunMarker ?? null,
    });
    return NextResponse.json({
      ok: true,
      export: {
        id: exportRow.id,
        status: "created",
        expiresAt: exportRow.expires_at,
        manifest: exportRow.manifest,
      },
    }, { status: 201 });
  } catch (error) {
    return identityErrorResponse(error);
  }
}
