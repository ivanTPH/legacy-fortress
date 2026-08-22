import { NextResponse } from "next/server";
import { identityErrorResponse, requireIdentityApiAccess } from "@/lib/identity-verification/api";

export async function GET(request: Request, context: { params: Promise<{ exportId: string }> }) {
  const access = await requireIdentityApiAccess(request);
  if (!access.ok) return access.response;
  try {
    const { exportId } = await context.params;
    const exportRow = await access.admin
      .from("privacy_data_exports")
      .select("id,subject_user_id,storage_bucket,storage_path,status,expires_at")
      .eq("id", exportId)
      .maybeSingle();
    if (exportRow.error || !exportRow.data || exportRow.data.subject_user_id !== access.user.id) {
      return NextResponse.json({ ok: false, error: "export_not_found" }, { status: 404 });
    }
    if (!['created', 'released'].includes(exportRow.data.status) || new Date(exportRow.data.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ ok: false, error: "export_expired" }, { status: 410 });
    }
    const signed = await access.admin.storage
      .from(exportRow.data.storage_bucket)
      .createSignedUrl(exportRow.data.storage_path, 300);
    if (signed.error || !signed.data?.signedUrl) throw new Error("privacy_export_signed_url_failed");
    return NextResponse.json({ ok: true, exportId, expiresAt: exportRow.data.expires_at, signedUrl: signed.data.signedUrl });
  } catch (error) {
    return identityErrorResponse(error);
  }
}
