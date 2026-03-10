import type { SupabaseClient, User } from "@supabase/supabase-js";
import { waitForActiveUser } from "./session";

type AnySupabaseClient = SupabaseClient;

type Options = {
  attempts?: number;
  delayMs?: number;
  onMissing?: () => void;
};

export async function requireActiveUser(client: AnySupabaseClient, options?: Options): Promise<User | null> {
  const user = await waitForActiveUser(client, {
    attempts: options?.attempts ?? 6,
    delayMs: options?.delayMs ?? 140,
  });

  if (!user) options?.onMissing?.();
  return user;
}

export async function getSafeUserData(client: AnySupabaseClient, options?: Options): Promise<{
  data: { user: User | null };
  error: null;
}> {
  const user = await requireActiveUser(client, options);
  return { data: { user }, error: null };
}
