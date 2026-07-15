import { createClient } from "@supabase/supabase-js";

const PUBLIC_SUPABASE_URL_ENV = "NEXT_PUBLIC_SUPABASE_URL";

export function getServerSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env[PUBLIC_SUPABASE_URL_ENV];
}

export function getSupabaseAdminConfigIssue() {
  const url = getServerSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) return "missing_url";
  const normalizedKey = String(key ?? "").trim();
  if (!normalizedKey) return "missing_service_role_key";
  if (!isSupportedServiceRoleKey(normalizedKey)) {
    return "malformed_service_role_key";
  }
  return null;
}

function isSupportedServiceRoleKey(key: string) {
  if (key.startsWith("sb_secret_") && key.length > "sb_secret_".length) return true;
  const parts = key.split(".");
  return parts.length === 3 && parts.every((part) => Boolean(part.trim()));
}

export function createSupabaseAdminClient() {
  const issue = getSupabaseAdminConfigIssue();
  if (issue) return null;
  const url = getServerSupabaseUrl() as string;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
