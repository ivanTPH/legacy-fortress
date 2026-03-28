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
  permissionsOverride: ViewerPermissionsOverride;
  assignedAssetIds: string[];
  assignedRecordIds: string[];
  assignedSectionKeys: SectionKey[];
};

export type ViewerPermissionsOverride = {
  readOnly?: boolean;
  allowedSections: SectionKey[];
  assetIds: string[];
  recordIds: string[];
  ownerNotes?: string;
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
      permissionsOverride: EMPTY_VIEWER_PERMISSIONS_OVERRIDE,
      assignedAssetIds: [],
      assignedRecordIds: [],
      assignedSectionKeys: [],
    };
  }

  const permissionsOverride = normalizePermissionsOverride(selectedGrant.permissions_override);

  const [contactRes, profileRes, legacyProfileRes, assetLinksRes, recordLinksRes] = await Promise.all([
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
    selectedGrant.contact_id
      ? client
          .from("contact_links")
          .select("source_id,section_key")
          .eq("owner_user_id", selectedGrant.owner_user_id)
          .eq("contact_id", selectedGrant.contact_id)
          .eq("source_kind", "asset")
      : Promise.resolve({ data: [], error: null }),
    selectedGrant.contact_id
      ? client
          .from("record_contacts")
          .select("record_id")
          .eq("owner_user_id", selectedGrant.owner_user_id)
          .eq("contact_id", selectedGrant.contact_id)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const accountHolderName =
    String((profileRes as { data?: { display_name?: string | null } | null }).data?.display_name ?? "").trim()
    || String((legacyProfileRes as { data?: { display_name?: string | null } | null }).data?.display_name ?? "").trim()
    || fallbackDisplayName;

  const linkedContactName = String((contactRes as { data?: { full_name?: string | null } | null }).data?.full_name ?? "").trim();
  const linkedAssetIds = ((assetLinksRes as { data?: Array<{ source_id?: string | null }> | null }).data ?? [])
    .map((row) => String(row.source_id ?? "").trim())
    .filter(Boolean);
  const linkedRecordIds = ((recordLinksRes as { data?: Array<{ record_id?: string | null }> | null }).data ?? [])
    .map((row) => String(row.record_id ?? "").trim())
    .filter(Boolean);
  const recordSectionKeys = linkedRecordIds.length
    ? await loadRecordSectionKeys(client, selectedGrant.owner_user_id, linkedRecordIds)
    : [];
  const assetSectionKeys = ((assetLinksRes as { data?: Array<{ section_key?: string | null }> | null }).data ?? [])
    .map((row) => normalizeSectionKey(row.section_key))
    .filter((value): value is SectionKey => Boolean(value));
  const assignedSectionKeys = Array.from(new Set([
    ...permissionsOverride.allowedSections,
    ...assetSectionKeys,
    ...recordSectionKeys,
  ]));

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
    readOnly: permissionsOverride.readOnly ?? true,
    canUpgradeToOwnAccount: true,
    permissionsOverride,
    assignedAssetIds: Array.from(new Set([...permissionsOverride.assetIds, ...linkedAssetIds])),
    assignedRecordIds: Array.from(new Set([...permissionsOverride.recordIds, ...linkedRecordIds])),
    assignedSectionKeys,
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
  if (!canAccessSection(viewer.viewerRole, section, "view", viewer.activationStatus)) return false;
  if (viewer.mode !== "linked") return true;
  if (pathname.startsWith("/account") || pathname.startsWith("/settings")) return false;
  if (viewer.assignedSectionKeys.length > 0 && section !== "dashboard" && !viewer.assignedSectionKeys.includes(section)) {
    return false;
  }
  return true;
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

export function filterAssetIdsForViewer<T extends { id: string; section_key?: string | null; sectionKey?: string | null }>(
  rows: T[],
  viewer: ViewerAccessState,
) {
  if (viewer.mode !== "linked") return rows;
  const allowedIds = new Set(viewer.assignedAssetIds);
  return rows.filter((row) => {
    const id = String(row.id ?? "").trim();
    if (!id || !allowedIds.has(id)) return false;
    const section = normalizeSectionKey(row.section_key ?? row.sectionKey);
    return section ? canViewPath(sectionPathMap[section], viewer) : true;
  });
}

export function filterRecordIdsForViewer<T extends { id?: string; record_id?: string | null; recordId?: string | null }>(
  rows: T[],
  viewer: ViewerAccessState,
) {
  if (viewer.mode !== "linked") return rows;
  const allowedIds = new Set(viewer.assignedRecordIds);
  return rows.filter((row) => {
    const id = String(row.record_id ?? row.recordId ?? row.id ?? "").trim();
    return Boolean(id) && allowedIds.has(id);
  });
}

const EMPTY_VIEWER_PERMISSIONS_OVERRIDE: ViewerPermissionsOverride = {
  allowedSections: [],
  assetIds: [],
  recordIds: [],
};

const sectionPathMap: Record<SectionKey, string> = {
  dashboard: "/dashboard",
  profile: "/profile",
  personal: "/personal",
  financial: "/finances",
  legal: "/legal",
  property: "/property",
  business: "/business",
  digital: "/vault/digital",
  settings: "/account",
};

function normalizePermissionsOverride(value: Record<string, unknown> | null): ViewerPermissionsOverride {
  const source = value && typeof value === "object" ? value : {};
  return {
    readOnly: readOptionalBoolean(source["read_only"]),
    allowedSections: normalizeSectionKeys(source["allowed_sections"] ?? source["section_keys"]),
    assetIds: normalizeStringArray(source["asset_ids"]),
    recordIds: normalizeStringArray(source["record_ids"]),
    ownerNotes: typeof source["owner_notes"] === "string" ? source["owner_notes"].trim() : undefined,
  };
}

function readOptionalBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  return undefined;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function normalizeSectionKeys(value: unknown) {
  return normalizeStringArray(value)
    .map((item) => normalizeSectionKey(item))
    .filter((item): item is SectionKey => Boolean(item));
}

function normalizeSectionKey(value: unknown): SectionKey | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "finances") return "financial";
  if (normalized === "vault/digital" || normalized === "digital") return "digital";
  if (normalized === "settings" || normalized === "account") return "settings";
  if (normalized === "profile" || normalized === "dashboard" || normalized === "personal" || normalized === "financial" || normalized === "legal" || normalized === "property" || normalized === "business") {
    return normalized as SectionKey;
  }
  return null;
}

async function loadRecordSectionKeys(client: AnySupabaseClient, ownerUserId: string, recordIds: string[]) {
  const result = await client
    .from("records")
    .select("section_key")
    .eq("owner_user_id", ownerUserId)
    .in("id", recordIds);
  if (result.error) return [];
  return ((result.data ?? []) as Array<{ section_key?: string | null }>)
    .map((row) => normalizeSectionKey(row.section_key))
    .filter((value): value is SectionKey => Boolean(value));
}
