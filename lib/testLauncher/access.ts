import type { User } from "@supabase/supabase-js";
import { getApplicationEnvironment } from "../environment/appEnvironment.ts";
import { getServerSupabaseUrl } from "../supabaseAdmin.ts";

const TEST_ENVIRONMENTS = new Set(["test", "uat", "staging"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FounderAdminRecord = {
  user_id: string | null;
  status: string;
  is_master: boolean;
  role: string | null;
};

export function isFounderTestLauncherEnvironment({
  environment = getApplicationEnvironment(),
  appHost,
  supabaseUrl = getServerSupabaseUrl(),
}: {
  environment?: string;
  appHost: string;
  supabaseUrl?: string;
}) {
  let supabaseHost = "";
  try { supabaseHost = new URL(supabaseUrl ?? "").hostname; } catch { return false; }
  return TEST_ENVIRONMENTS.has(environment)
    && appHost === "test.mylegacyfortress.com"
    && supabaseHost === "supabase-test.mylegacyfortress.com";
}

export function isVerifiedFounder({
  user,
  configuredUserId,
  adminRow,
}: {
  user: Pick<User, "id"> | null;
  configuredUserId?: string;
  adminRow: FounderAdminRecord | null;
}) {
  const id = configuredUserId?.trim() ?? "";
  return UUID.test(id)
    && user?.id === id
    && adminRow?.user_id === id
    && adminRow.status === "active"
    && adminRow.is_master === true
    && adminRow.role === "super_admin";
}
