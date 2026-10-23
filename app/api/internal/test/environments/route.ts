import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getFounderTestLauncherEnvironmentFailure, isVerifiedFounder, type FounderAdminRecord } from "@/lib/testLauncher/access";

export const dynamic = "force-dynamic";

const unavailable = (request: Request, reason: string) => {
  // Reason codes stay in TEST server logs; the public response never identifies an account or gate.
  if (new URL(request.url).hostname === "test.mylegacyfortress.com") {
    console.info("founder_test_launcher_unavailable", { reason });
  }
  return NextResponse.json({ available: false }, {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
};

export async function GET(request: Request) {
  // Both checks are server-side. Client roles, metadata and email never grant this entry.
  const environmentFailure = getFounderTestLauncherEnvironmentFailure({ appHost: new URL(request.url).hostname });
  if (environmentFailure) return unavailable(request, environmentFailure);
  const configuredUserId = process.env.TEST_FOUNDER_AUTH_USER_ID?.trim();
  if (!configuredUserId) return unavailable(request, "founder_config_missing");

  let requestUser: Awaited<ReturnType<typeof getRequestUser>>;
  try { requestUser = await getRequestUser(request); }
  catch { return unavailable(request, "session_check_failed"); }
  const { user, error: sessionError } = requestUser;
  if (!user) return unavailable(request, sessionError ?? "bearer_session");
  if (user.id !== configuredUserId) return unavailable(request, "founder_id_mismatch");

  let admin: ReturnType<typeof createSupabaseAdminClient>;
  try { admin = createSupabaseAdminClient(); }
  catch { return unavailable(request, "service_role_client_failed"); }
  if (!admin) return unavailable(request, "service_role_client");
  let adminRow: FounderAdminRecord | null = null;
  let lookupFailed = false;
  try {
    const result = await admin
      .from("admin_users")
      .select("user_id,status,is_master,role")
      .eq("user_id", user.id)
      .maybeSingle();
    adminRow = result.data as FounderAdminRecord | null;
    lookupFailed = Boolean(result.error);
  } catch { return unavailable(request, "admin_lookup_failed"); }
  if (lookupFailed) return unavailable(request, "admin_lookup");
  if (!adminRow) return unavailable(request, "admin_record_missing");
  if (!isVerifiedFounder({ user, configuredUserId, adminRow })) return unavailable(request, "admin_record_not_active_master");

  console.info("founder_test_launcher_available");

  return NextResponse.json({ available: true }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
