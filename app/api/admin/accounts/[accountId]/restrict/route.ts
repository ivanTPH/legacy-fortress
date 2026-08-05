import { retiredLegacyAdminMutationResponse } from "@/lib/backend/legacyAdminApi";

export async function POST() {
  return retiredLegacyAdminMutationResponse({
    action: "restrict_account",
    canonicalPath: "/api/internal/admin/admin-users",
  });
}
