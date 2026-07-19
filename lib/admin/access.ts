import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createSupabaseAdminClient, getSupabaseAdminConfigIssue } from "../supabaseAdmin.ts";
import { MASTER_ADMIN_EMAIL, normalizeAdminEmail } from "../auth/adminRoles.ts";
import {
  deriveAdminRole,
  getAdminRoleCapabilities,
  getDeniedAdminCapabilityMessage,
  hasAdminCapability,
  normalizeAdminRole,
  type AdminCapability,
  type AdminRole,
} from "./capabilities.ts";

export { MASTER_ADMIN_EMAIL, normalizeAdminEmail };

type AnySupabaseClient = SupabaseClient;
type AdminRoleOverride = AdminRole | "standard_user" | "revoked_admin";
type AdminRowResponse = {
  data: Record<string, unknown> | null;
  error: { message: string } | null;
};

export type AdminUserRow = {
  id: string;
  email_normalized: string;
  user_id: string | null;
  display_name: string | null;
  status: "active" | "inactive";
  is_master: boolean;
  role: AdminRole | string | null;
  granted_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminAccessState = {
  user: User;
  emailNormalized: string;
  isMasterAdmin: boolean;
  adminRole: AdminRole;
  capabilities: AdminCapability[];
  adminRow: AdminUserRow;
};

const ADMIN_ROLE_OVERRIDE_COOKIE = "lf_admin_role_override";

const ADMIN_SELECT = "id,email_normalized,user_id,display_name,status,is_master,role,granted_by_user_id,created_at,updated_at";
const LEGACY_ADMIN_SELECT = "id,email_normalized,user_id,display_name,status,is_master,granted_by_user_id,created_at,updated_at";

export function isMasterAdminEmail(email: string | null | undefined) {
  return normalizeAdminEmail(email) === MASTER_ADMIN_EMAIL;
}

export function isLocalAdminRoleHarnessEnabled() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  return process.env.NODE_ENV !== "production" && (url.includes("127.0.0.1") || url.includes("localhost"));
}

export function getLocalAdminRoleOverride(request: Request): AdminRoleOverride | null {
  if (!isLocalAdminRoleHarnessEnabled()) return null;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${ADMIN_ROLE_OVERRIDE_COOKIE}=`));
  const value = decodeURIComponent(cookie?.split("=").slice(1).join("=") ?? "");
  if (value === "standard_user" || value === "revoked_admin") return value;
  return normalizeAdminRole(value);
}

export { ADMIN_ROLE_OVERRIDE_COOKIE };

export function isAdminAccessGranted(
  email: string | null | undefined,
  row: Pick<AdminUserRow, "status" | "is_master"> | null | undefined,
) {
  if (!row) return false;
  return row.status === "active";
}

function createSupabaseRequestAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function extractBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

export async function getRequestUser(request: Request) {
  const token = extractBearerToken(request);
  if (!token) return { user: null, error: "missing_bearer_token" as const };

  const authClient = createSupabaseRequestAuthClient();
  if (!authClient) return { user: null, error: "missing_public_env" as const };

  const userRes = await authClient.auth.getUser(token);
  if (userRes.error || !userRes.data.user) {
    return { user: null, error: "invalid_session" as const };
  }

  return { user: userRes.data.user, error: null };
}

export async function ensureMasterAdminRecord(
  client: AnySupabaseClient,
  {
    userId,
  }: {
    userId: string | null;
  },
) {
  const now = new Date().toISOString();
  const upsert = await client
    .from("admin_users")
    .upsert(
      {
        email_normalized: MASTER_ADMIN_EMAIL,
        user_id: userId,
        display_name: "Master Admin",
        status: "active",
        is_master: true,
        role: "super_admin",
        granted_by_user_id: userId,
        updated_at: now,
      },
      { onConflict: "email_normalized" },
    )
    .select(ADMIN_SELECT)
    .single();

  if (upsert.error && /role/i.test(upsert.error.message)) {
    const legacyUpsert = await client
      .from("admin_users")
      .upsert(
        {
          email_normalized: MASTER_ADMIN_EMAIL,
          user_id: userId,
          display_name: "Master Admin",
          status: "active",
          is_master: true,
          granted_by_user_id: userId,
          updated_at: now,
        },
        { onConflict: "email_normalized" },
      )
      .select(LEGACY_ADMIN_SELECT)
      .single();
    if (legacyUpsert.error || !legacyUpsert.data) {
      throw new Error(legacyUpsert.error?.message || "Could not ensure master admin record.");
    }
    return { ...legacyUpsert.data, role: null } as AdminUserRow;
  }

  if (upsert.error || !upsert.data) {
    throw new Error(upsert.error?.message || "Could not ensure master admin record.");
  }

  return upsert.data as AdminUserRow;
}

export async function requireAdminAccess(request: Request): Promise<
  | { ok: true; access: AdminAccessState; adminClient: AnySupabaseClient }
  | { ok: false; status: number; message: string; issue?: string }
> {
  const issue = getSupabaseAdminConfigIssue();
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return {
      ok: false,
      status: 503,
      message: "Admin service is unavailable in this environment.",
      issue: issue ?? undefined,
    };
  }

  const requestUser = await getRequestUser(request);
  if (!requestUser.user) {
    return {
      ok: false,
      status: requestUser.error === "missing_public_env" ? 503 : 401,
      message:
        requestUser.error === "missing_public_env"
          ? "Public auth configuration is unavailable."
          : "You must be signed in to continue.",
      issue: requestUser.error === "missing_public_env" ? "missing_public_env" : requestUser.error ?? undefined,
    };
  }

  const emailNormalized = normalizeAdminEmail(requestUser.user.email);
  let rowRes = await adminClient
    .from("admin_users")
    .select(ADMIN_SELECT)
    .eq("email_normalized", emailNormalized)
    .maybeSingle() as AdminRowResponse;
  if (rowRes.error && /role/i.test(rowRes.error.message)) {
    rowRes = await adminClient
      .from("admin_users")
      .select(LEGACY_ADMIN_SELECT)
      .eq("email_normalized", emailNormalized)
      .maybeSingle() as AdminRowResponse;
    if (rowRes.data) {
      rowRes.data = { ...rowRes.data, role: null };
    }
  }

  let adminRow = (rowRes.data ?? null) as AdminUserRow | null;

  if (!adminRow && isMasterAdminEmail(emailNormalized)) {
    adminRow = await ensureMasterAdminRecord(adminClient, { userId: requestUser.user.id });
  }

  if (!isAdminAccessGranted(emailNormalized, adminRow)) {
    return {
      ok: false,
      status: 403,
      message: "Admin access is restricted.",
    };
  }

  if (adminRow && !adminRow.user_id) {
    let claimRes = await adminClient
      .from("admin_users")
      .update({ user_id: requestUser.user.id, updated_at: new Date().toISOString() })
      .eq("id", adminRow.id)
      .select(ADMIN_SELECT)
      .single() as AdminRowResponse;
    if (claimRes.error && /role/i.test(claimRes.error.message)) {
      claimRes = await adminClient
        .from("admin_users")
        .update({ user_id: requestUser.user.id, updated_at: new Date().toISOString() })
        .eq("id", adminRow.id)
        .select(LEGACY_ADMIN_SELECT)
        .single() as AdminRowResponse;
      if (claimRes.data) {
        claimRes.data = { ...claimRes.data, role: null };
      }
    }
    if (!claimRes.error && claimRes.data) {
      adminRow = claimRes.data as AdminUserRow;
    }
  }

  if (!adminRow) {
    return {
      ok: false,
      status: 403,
      message: "Admin access is restricted.",
    };
  }

  const normalizedAdminRole = normalizeAdminRole(adminRow.role);
  if (!adminRow.is_master && adminRow.role && !normalizedAdminRole) {
    return {
      ok: false,
      status: 403,
      message: "Admin access is restricted.",
      issue: "invalid_admin_role",
    };
  }

  const realRole = adminRow.is_master ? deriveAdminRole(adminRow) : normalizedAdminRole ?? deriveAdminRole(adminRow);
  const overrideRole = getLocalAdminRoleOverride(request);
  if (overrideRole === "standard_user" || overrideRole === "revoked_admin") {
    return {
      ok: false,
      status: 403,
      message: "Admin access is restricted.",
    };
  }
  const effectiveRole = overrideRole ?? realRole;

  return {
    ok: true,
    access: {
      user: requestUser.user,
      emailNormalized,
      isMasterAdmin: isMasterAdminEmail(emailNormalized) || adminRow.is_master,
      adminRole: effectiveRole,
      capabilities: getAdminRoleCapabilities(effectiveRole),
      adminRow,
    },
    adminClient,
  };
}

export function adminHasCapability(access: AdminAccessState, capability: AdminCapability) {
  return hasAdminCapability(access.adminRole, capability);
}

export function requireAdminCapability(access: AdminAccessState, capability: AdminCapability) {
  if (adminHasCapability(access, capability)) return null;
  return {
    status: 403,
    message: getDeniedAdminCapabilityMessage(capability),
    capability,
  };
}
