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

  const payload = (await response.json().catch(() => null)) as { ok?: boolean; issue?: string | null; pendingAdmin?: unknown } | null;
  // Staff who still need their 6-digit code go on; the portal asks for it.
  if (response.status === 401 && payload?.issue === "mfa_required" && payload.pendingAdmin) return safeNext;
  if (!response.ok) return fallbackDestination;
  return payload?.ok ? safeNext : fallbackDestination;
}
