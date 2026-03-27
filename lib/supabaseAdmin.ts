import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdminConfigIssue() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) return "missing_url";
  if (!key) return "missing_service_role_key";
  const parts = key.split(".");
  if (parts.length !== 3 || parts.some((part) => !String(part).trim())) {
    return "malformed_service_role_key";
  }
  return null;
}

export function createSupabaseAdminClient() {
  const issue = getSupabaseAdminConfigIssue();
  if (issue) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
