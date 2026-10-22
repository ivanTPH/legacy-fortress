import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isFounderTestLauncherEnvironment, isVerifiedFounder, type FounderAdminRecord } from "@/lib/testLauncher/access";

export const dynamic = "force-dynamic";

const unavailable = () => NextResponse.json({ available: false }, {
  status: 404,
  headers: { "Cache-Control": "private, no-store" },
});

export async function GET(request: Request) {
  // Both checks are server-side. Client roles, metadata and email never grant this entry.
  if (!isFounderTestLauncherEnvironment({ appHost: new URL(request.url).hostname })) return unavailable();
  const configuredUserId = process.env.TEST_FOUNDER_AUTH_USER_ID;
  if (!configuredUserId) return unavailable();

  const { user } = await getRequestUser(request);
  if (!user || user.id !== configuredUserId) return unavailable();

  const admin = createSupabaseAdminClient();
  if (!admin) return unavailable();
  const { data, error } = await admin
    .from("admin_users")
    .select("user_id,status,is_master,role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !isVerifiedFounder({ user, configuredUserId, adminRow: data as FounderAdminRecord | null })) return unavailable();

  return NextResponse.json({ available: true }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
