import type { User } from "@supabase/supabase-js";

export function isEmailVerified(user: User | null) {
  if (!user) return false;
  return Boolean(user.email_confirmed_at);
}

export function getUserDisplayName(user: User | null) {
  const firstName = user?.user_metadata?.first_name as string | undefined;
  const lastName = user?.user_metadata?.last_name as string | undefined;
  if (firstName || lastName) return `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return user?.email ?? "Account";
}
