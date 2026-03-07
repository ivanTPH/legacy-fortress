import type { SupabaseClient, User } from "@supabase/supabase-js";

type AnySupabaseClient = SupabaseClient;

export function toSafeInternalPath(path: string | null | undefined, fallback: string) {
  if (!path) return fallback;
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//")) return fallback;
  return path;
}

export async function getActiveUser(client: AnySupabaseClient): Promise<User | null> {
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) return null;
  if (sessionData.session?.user) return sessionData.session.user;

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) return null;
  return userData.user;
}

export async function waitForActiveUser(
  client: AnySupabaseClient,
  options?: { attempts?: number; delayMs?: number },
): Promise<User | null> {
  const attempts = options?.attempts ?? 5;
  const delayMs = options?.delayMs ?? 150;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const user = await getActiveUser(client);
    if (user) return user;
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return null;
}
