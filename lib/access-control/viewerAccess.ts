import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ROLE_RULES,
  canAccessSection,
  type AccessActivationStatus,
  type CollaboratorRole,
  type SectionKey,
} from "./roles";

type AnySupabaseClient = SupabaseClient;

export const ACTIVE_LINKED_GRANT_STORAGE_KEY = "lf.activeLinkedGrantId";

export type AccountAccessGrantRow = {
  id: string;
  owner_user_id: string;
  linked_user_id: string;
  contact_id: string | null;
  invitation_id: string | null;
  assigned_role: CollaboratorRole;
  relationship: string | null;
  activation_status: AccessActivationStatus;
  permissions_override: Record<string, unknown> | null;
  last_accessed_at: string | null;
  updated_at: string;
};

export type ViewerAccessState = {
  mode: "owner" | "linked";
  grantId: string | null;
  sessionUserId: string;
  targetOwnerUserId: string;
  accountHolderName: string;
  linkedContactId: string | null;
  linkedContactName: string;
  viewerRole: CollaboratorRole;
  activationStatus: AccessActivationStatus;
  readOnly: boolean;
  canUpgradeToOwnAccount: boolean;
};

export function buildInvitationAcceptPath(invitationId: string, token: string) {
  const params = new URLSearchParams({
    invitation: invitationId,
    token,
  });
  return `/invite/accept?${params.toString()}`;
}

export function buildInvitationAuthNextPath(invitationId: string, token: string) {
  return buildInvitationAcceptPath(invitationId, token);
}

export function getRoleLabel(role: CollaboratorRole) {
  return ROLE_RULES[role]?.label ?? role.replace(/_/g, " ");
}

export function getStoredLinkedGrantId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ACTIVE_LINKED_GRANT_STORAGE_KEY) ?? "";
}

export function setStoredLinkedGrantId(grantId: string) {
  if (typeof window === "undefined") return;
  if (grantId.trim()) {
    window.localStorage.setItem(ACTIVE_LINKED_GRANT_STORAGE_KEY, grantId.trim());
  } else {
    window.localStorage.removeItem(ACTIVE_LINKED_GRANT_STORAGE_KEY);
  }
}

export function clearStoredLinkedGrantId() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVE_LINKED_GRANT_STORAGE_KEY);
}

export async function hasLinkedAccountAccess(client: AnySupabaseClient, userId: string) {
  const res = await client
    .from("account_access_grants")
    .select("id")
    .eq("linked_user_id", userId)
    .in("activation_status", ["accepted", "verified", "active"])
    .limit(1);

  if (res.error) return false;
  return Boolean((res.data ?? []).length);
}

export async function loadViewerAccessState(
  client: AnySupabaseClient,
  sessionUserId: string,
  {
    preferredGrantId,
    fallbackDisplayName = "Secure Account",
  }: {
    preferredGrantId?: string | null;
    fallbackDisplayName?: string;
  } = {},
): Promise<ViewerAccessState> {
  const grantsRes = await client
    .from("account_access_grants")
    .select("id,owner_user_id,linked_user_id,contact_id,invitation_id,assigned_role,relationship,activation_status,permissions_override,last_accessed_at,updated_at")
    .eq("linked_user_id", sessionUserId)
    .in("activation_status", ["accepted", "verified", "active"])
    .order("updated_at", { ascending: false });

  const grants = ((grantsRes.data ?? []) as AccountAccessGrantRow[]).filter(Boolean);
  const selectedGrant =
    grants.find((row) => row.id === String(preferredGrantId ?? "").trim())
    ?? grants[0]
    ?? null;

  if (!selectedGrant) {
    return {
      mode: "owner",
      grantId: null,
      sessionUserId,
      targetOwnerUserId: sessionUserId,
      accountHolderName: fallbackDisplayName,
      linkedContactId: null,
      linkedContactName: "",
      viewerRole: "owner",
      activationStatus: "active",
      readOnly: false,
      canUpgradeToOwnAccount: false,
    };
  }

  const [contactRes, profileRes, legacyProfileRes] = await Promise.all([
    selectedGrant.contact_id
      ? client
          .from("contacts")
          .select("id,full_name")
          .eq("owner_user_id", selectedGrant.owner_user_id)
          .eq("id", selectedGrant.contact_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    client
      .from("user_profiles")
      .select("display_name")
      .eq("user_id", selectedGrant.owner_user_id)
      .maybeSingle(),
    client
      .from("profiles")
      .select("display_name")
      .eq("user_id", selectedGrant.owner_user_id)
      .maybeSingle(),
  ]);

  const accountHolderName =
    String((profileRes as { data?: { display_name?: string | null } | null }).data?.display_name ?? "").trim()
    || String((legacyProfileRes as { data?: { display_name?: string | null } | null }).data?.display_name ?? "").trim()
    || fallbackDisplayName;

  const linkedContactName = String((contactRes as { data?: { full_name?: string | null } | null }).data?.full_name ?? "").trim();

  return {
    mode: "linked",
    grantId: selectedGrant.id,
    sessionUserId,
    targetOwnerUserId: selectedGrant.owner_user_id,
    accountHolderName,
    linkedContactId: selectedGrant.contact_id ?? null,
    linkedContactName,
    viewerRole: selectedGrant.assigned_role,
    activationStatus: selectedGrant.activation_status,
    readOnly: true,
    canUpgradeToOwnAccount: true,
  };
}

export function mapPathnameToSectionKey(pathname: string): SectionKey | null {
  const value = pathname.trim().toLowerCase();
  if (!value) return null;
  if (value === "/dashboard" || value === "/app/dashboard") return "dashboard";
  if (value.startsWith("/profile")) return "profile";
  if (value.startsWith("/contacts")) return "personal";
  if (value.startsWith("/personal") || value.startsWith("/trust")) return "personal";
  if (value.startsWith("/legal")) return "legal";
  if (value.startsWith("/property") || value.startsWith("/vault/property")) return "property";
  if (value.startsWith("/business") || value.startsWith("/vault/business")) return "business";
  if (value.startsWith("/finances") || value.startsWith("/vault/financial")) return "financial";
  if (value.startsWith("/vault/digital")) return "digital";
  if (value.startsWith("/settings") || value.startsWith("/account")) return "settings";
  return null;
}

export function canViewPath(pathname: string, viewer: ViewerAccessState) {
  const section = mapPathnameToSectionKey(pathname);
  if (!section) return true;
  return canAccessSection(viewer.viewerRole, section, "view", viewer.activationStatus);
}

export function filterNavigationTreeForViewer<
  T extends { path: string; children?: T[] },
>(nodes: T[], viewer: ViewerAccessState): T[] {
  return nodes
    .filter((node) => canViewPath(node.path, viewer))
    .map((node) => ({
      ...node,
      children: node.children ? filterNavigationTreeForViewer(node.children, viewer) : node.children,
    }));
}
