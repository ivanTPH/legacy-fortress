import { retiredLegacyAdminMutationResponse } from "@/lib/backend/legacyAdminApi";

export async function POST() {
  return retiredLegacyAdminMutationResponse({
    action: "submit_role_change",
    canonicalPath: "/api/internal/admin/admin-users",
  });
}
