import type { User } from "@supabase/supabase-js";

const TEST_ENVIRONMENTS = new Set(["test", "uat", "staging"]);

function deploymentEnvironment() {
  const markers = [process.env.APP_ENV, process.env.LEGACY_FORTRESS_ENV, process.env.VERCEL_ENV]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));
  if (markers.some((value) => !TEST_ENVIRONMENTS.has(value))) return "production";
  return markers[0];
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FounderAdminRecord = {
  user_id: string | null;
  status: string;
  is_master: boolean;
  role: string | null;
};

export function isFounderTestLauncherEnvironment({
  environment = deploymentEnvironment(),
  appHost,
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
}: {
  environment?: string;
  appHost: string;
  supabaseUrl?: string;
}) {
  return getFounderTestLauncherEnvironmentFailure({ environment, appHost, supabaseUrl }) === null;
}

export function getFounderTestLauncherEnvironmentFailure({
  environment = deploymentEnvironment(),
  appHost,
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
}: {
  environment?: string;
  appHost: string;
  supabaseUrl?: string;
}) {
  if (appHost !== "test.mylegacyfortress.com") return "app_host";
  let supabaseHost = "";
  try { supabaseHost = new URL(supabaseUrl ?? "").hostname; } catch { return "public_supabase_url"; }
  if (supabaseHost !== "supabase-test.mylegacyfortress.com") return "public_supabase_host";
  // NODE_ENV=production is normal for the TEST build. An explicit production marker always denies.
  if (environment && !TEST_ENVIRONMENTS.has(environment.trim().toLowerCase())) return "deployment_environment";
  return null;
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
