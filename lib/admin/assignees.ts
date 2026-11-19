import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveAdminRole, hasAdminCapability, type AdminCapability } from "./capabilities.ts";

/**
 * Who a case can be handed to (owner decision 19 Nov 2026): only registered, active admins whose role allows
 * the work, chosen from a list, never typed in. Staff names only; nothing about customers.
 */
export type Assignee = { userId: string; name: string };

export async function listAssignableAdmins(client: SupabaseClient, capability: AdminCapability): Promise<Assignee[]> {
  const result = await client.from("admin_users").select("user_id,display_name,email_normalized,status,role,is_master").eq("status", "active");
  if (result.error) throw new Error("admin_assignees_unavailable");
  return ((result.data ?? []) as Array<{ user_id: string | null; display_name: string | null; email_normalized: string | null; role: string | null; is_master: boolean | null }>)
    .filter((row) => row.user_id && hasAdminCapability(deriveAdminRole({ isMaster: row.is_master, role: row.role }), capability))
    .map((row) => ({ userId: String(row.user_id), name: row.display_name?.trim() || String(row.email_normalized ?? "Admin") }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function isAssignableAdmin(client: SupabaseClient, capability: AdminCapability, userId: string) {
  return (await listAssignableAdmins(client, capability)).some((assignee) => assignee.userId === userId);
}
