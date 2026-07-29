import type { SupabaseClient } from "@supabase/supabase-js";
import { toSafeInternalPath } from "./session.ts";
import { canRoleAccessPath, isInternalAccessRoute } from "../accessModel.ts";
import type { PlatformRole } from "./platformRoles.ts";

type AnySupabaseClient = SupabaseClient;

export async function resolvePermissionedAdminDestination(
  client: AnySupabaseClient,
  {
    nextPath,
    fallbackDestination,
    roles = [],
  }: {
    nextPath?: string | null;
    fallbackDestination: string;
    roles?: PlatformRole[];
  },
) {
  const safeNext = toSafeInternalPath(nextPath, "");
  if (!isInternalAccessRoute(safeNext)) return fallbackDestination;
  if (canRoleAccessPath(roles, safeNext)) return safeNext;

  const { data } = await client.auth.getSession();
  const token = data.session?.access_token ?? "";
  if (!token) return fallbackDestination;

  const response = await fetch("/api/internal/admin/session", {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return fallbackDestination;
  const payload = (await response.json().catch(() => null)) as { ok?: boolean } | null;
  return payload?.ok ? safeNext : fallbackDestination;
}
