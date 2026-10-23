const TEST_SUPABASE_HOST = "supabase-test.mylegacyfortress.com";
const TEST_ENVIRONMENTS = new Set(["test", "uat", "staging"]);

export function getPwaStartUrl({
  publicSupabaseUrl,
  environments,
}: {
  publicSupabaseUrl?: string;
  environments: Array<string | undefined>;
}) {
  let supabaseHost: string;
  try { supabaseHost = new URL(publicSupabaseUrl ?? "").hostname; } catch { return "/"; }
  if (supabaseHost !== TEST_SUPABASE_HOST) return "/";

  const explicitEnvironments = environments
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));
  if (explicitEnvironments.some((value) => !TEST_ENVIRONMENTS.has(value))) return "/";
  return "/pwa-entry";
}
