import { retiredLegacyAdminMutationResponse } from "@/lib/backend/legacyAdminApi";

export async function POST() {
  return retiredLegacyAdminMutationResponse({
    action: "suspend_user",
    canonicalPath: "/api/internal/admin/admin-users",
  });
}
