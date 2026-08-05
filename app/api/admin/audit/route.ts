import { handleListAuditEvents } from "@/lib/backend/adminRoleApiHandlers";
import { retiredLegacyAdminMutationResponse } from "@/lib/backend/legacyAdminApi";

export async function GET(request: Request) {
  return handleListAuditEvents(request);
}

export async function POST() {
  return retiredLegacyAdminMutationResponse({
    action: "emit_audit_event",
    canonicalPath: "/api/internal/admin/audit-history",
  });
}
