import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminAccessState } from "./access.ts";
import { normalizeAdminEmail } from "./access.ts";
import { normalizeAdminRole, type AdminRole } from "./capabilities.ts";
import { adminLifecycleError } from "./lifecycleSecurity.ts";

type AnySupabaseClient = SupabaseClient;

export const ADMIN_INVITATION_ROLE_TEMPLATES = [
  "super_admin",
  "support_agent",
  "probate_reviewer",
  "auditor",
  "enterprise_admin",
  "read_only_operations",
] as const;

export type AdminInvitationRoleTemplate = typeof ADMIN_INVITATION_ROLE_TEMPLATES[number];

export type AdminInvitationInput = {
  email: string;
  fullName?: string | null;
  roleTemplate?: string | null;
  scopeType?: string | null;
  organisationId?: string | null;
  requireMfa?: boolean | null;
  expiryDays?: number | null;
  accessExpiry?: string | null;
};

export async function listAdminInvitations(client: AnySupabaseClient) {
  const res = await client
    .from("admin_invitations")
    .select("id,email_normalized,full_name,role_template,scope_type,organisation_id,status,require_mfa,expires_at,access_expires_at,accepted_at,revoked_at,failure_reason,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}

export async function createAdminInvitation(
  client: AnySupabaseClient,
  access: AdminAccessState,
  input: AdminInvitationInput,
) {
  const email = normalizeAdminEmail(input.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw adminLifecycleError("ADMIN_INVALID_EMAIL", "invalid_admin_invitation_email");
  }
  const template = normalizeAdminInvitationRole(input.roleTemplate);
  if (!template) throw adminLifecycleError("ADMIN_INVALID_ROLE", "invalid_admin_invitation_role");

  const existing = await client
    .from("admin_invitations")
    .select("id,status")
    .eq("email_normalized", email)
    .in("status", ["draft", "pending", "sent", "delivered"])
    .maybeSingle();
  if (existing.error) throw adminLifecycleError("ADMIN_INTERNAL_ERROR", existing.error.message);
  if (existing.data) throw adminLifecycleError("ADMIN_DUPLICATE_USER", "duplicate_pending_admin_invitation");

  const expiryDays = Math.max(Number(input.expiryDays ?? 7), 1);
  const insert = await client
    .from("admin_invitations")
    .insert({
      email_normalized: email,
      full_name: String(input.fullName ?? "").trim() || null,
      role_template: template,
      scope_type: normalizeScope(input.scopeType),
      organisation_id: String(input.organisationId ?? "").trim() || null,
      status: "sent",
      require_mfa: input.requireMfa !== false,
      token_hash: createHash("sha256").update(randomBytes(32).toString("base64url")).digest("hex"),
      expires_at: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString(),
      access_expires_at: String(input.accessExpiry ?? "").trim() || null,
      created_by_user_id: access.user.id,
    })
    .select("id,email_normalized,full_name,role_template,scope_type,organisation_id,status,require_mfa,expires_at,access_expires_at,accepted_at,revoked_at,failure_reason,created_at,updated_at")
    .single();
  if (insert.error || !insert.data) {
    throw adminLifecycleError("ADMIN_INTERNAL_ERROR", insert.error?.message || "admin_invitation_create_failed");
  }
  return insert.data;
}

export async function updateAdminInvitationStatus(client: AnySupabaseClient, invitationId: string, status: "sent" | "revoked" | "expired") {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "revoked") patch.revoked_at = new Date().toISOString();
  const update = await client
    .from("admin_invitations")
    .update(patch)
    .eq("id", invitationId)
    .select("id,email_normalized,full_name,role_template,scope_type,status,require_mfa,expires_at,accepted_at,revoked_at,created_at,updated_at")
    .single();
  if (update.error || !update.data) throw adminLifecycleError("ADMIN_OPERATION_CONFLICT", update.error?.message || "admin_invitation_update_failed");
  return update.data;
}

export function normalizeAdminInvitationRole(value: string | null | undefined): AdminInvitationRoleTemplate | null {
  const normalized = String(value ?? "support_agent").trim().toLowerCase().replace(/-/g, "_");
  if (normalized === "read_only_operations") return "read_only_operations";
  const adminRole = normalizeAdminRole(normalized) as AdminRole | null;
  if (adminRole && ADMIN_INVITATION_ROLE_TEMPLATES.includes(adminRole as AdminInvitationRoleTemplate)) return adminRole as AdminInvitationRoleTemplate;
  return null;
}

function normalizeScope(value: string | null | undefined) {
  const normalized = String(value ?? "platform").trim().toLowerCase();
  if (["platform", "organisation", "support_only", "probate_only", "read_only", "time_limited"].includes(normalized)) return normalized;
  return "platform";
}
