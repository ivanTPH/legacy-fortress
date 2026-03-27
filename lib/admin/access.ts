import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createSupabaseAdminClient, getSupabaseAdminConfigIssue } from "../supabaseAdmin";

type AnySupabaseClient = SupabaseClient;

export const MASTER_ADMIN_EMAIL = "ivanyardley@me.com";

export type AdminUserRow = {
  id: string;
  email_normalized: string;
  user_id: string | null;
  display_name: string | null;
  status: "active" | "inactive";
  is_master: boolean;
  granted_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminAccessState = {
  user: User;
  emailNormalized: string;
  isMasterAdmin: boolean;
  adminRow: AdminUserRow;
};

const ADMIN_SELECT = "id,email_normalized,user_id,display_name,status,is_master,granted_by_user_id,created_at,updated_at";

export function normalizeAdminEmail(email: string | null | undefined) {
  return String(email ?? "").trim().toLowerCase();
}

export function isMasterAdminEmail(email: string | null | undefined) {
  return normalizeAdminEmail(email) === MASTER_ADMIN_EMAIL;
}

export function isAdminAccessGranted(
  email: string | null | undefined,
  row: Pick<AdminUserRow, "status" | "is_master"> | null | undefined,
) {
  if (isMasterAdminEmail(email)) return true;
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
        granted_by_user_id: userId,
        updated_at: now,
      },
      { onConflict: "email_normalized" },
    )
    .select(ADMIN_SELECT)
    .single();

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
    .maybeSingle();

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
    const claimRes = await adminClient
      .from("admin_users")
      .update({ user_id: requestUser.user.id, updated_at: new Date().toISOString() })
      .eq("id", adminRow.id)
      .select(ADMIN_SELECT)
      .single();
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

  return {
    ok: true,
    access: {
      user: requestUser.user,
      emailNormalized,
      isMasterAdmin: isMasterAdminEmail(emailNormalized) || adminRow.is_master,
      adminRow,
    },
    adminClient,
  };
}

