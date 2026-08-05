import { NextResponse } from "next/server.js";

type RetiredLegacyAdminMutationInput = {
  action: string;
  canonicalPath: string;
};

export function retiredLegacyAdminMutationResponse(input: RetiredLegacyAdminMutationInput) {
  return NextResponse.json({
    ok: false,
    code: "LEGACY_ADMIN_API_RETIRED",
    message: "This legacy Platform Administration endpoint no longer performs mutations. Use the canonical authorised admin API instead.",
    action: input.action,
    canonicalPath: input.canonicalPath,
    retired: true,
    policyDecision: "blocked",
    databaseChanged: false,
  }, {
    status: 410,
    headers: {
      "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate",
    },
  });
}
