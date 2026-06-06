import type { PlatformRole } from "./platformRoles.ts";

export const MASTER_ADMIN_EMAIL = "ivanyardley@me.com";

export function normalizeAdminEmail(email: string | null | undefined) {
  return String(email ?? "").trim().toLowerCase();
}

export function getMasterAdminRolesForEmail(email: string | null | undefined): PlatformRole[] {
  return normalizeAdminEmail(email) === MASTER_ADMIN_EMAIL ? ["super_admin"] : [];
}

export function mergePlatformRoles(...roleGroups: readonly PlatformRole[][]): PlatformRole[] {
  return [...new Set(roleGroups.flat())];
}
