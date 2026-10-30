export type WorkspaceAccountContext = "vault" | "admin" | "partner";

export type WorkspaceAccountLink = { href: string; label: string; icon: string };

export type VerifiedAdminSession = {
  isMasterAdmin?: boolean;
  role?: string | null;
  capabilities?: readonly string[];
} | null;

const PARTNER_CAPABILITIES = new Set(["organisation:view", "enterprise.workspace.access", "enterprise_dashboard", "enterprise_reports"]);
const PLATFORM_ROLES = new Set(["super_admin", "support_agent", "auditor", "probate_reviewer", "verification_reviewer"]);

/**
 * Pure rule for the account-menu workspace links. Only a server-verified admin
 * session can add Admin or Partner links; the Vault link is offered from the
 * Admin and Partner shells because every signed-in person can open their own Vault.
 */
export function resolveWorkspaceAccountLinks(current: WorkspaceAccountContext, admin: VerifiedAdminSession): WorkspaceAccountLink[] {
  const links: WorkspaceAccountLink[] = [];
  if (current !== "vault") links.push({ href: "/dashboard", label: "My Vault", icon: "account_balance_wallet" });
  if (!admin) return links;
  const capabilities = new Set(admin.capabilities ?? []);
  const platform = Boolean(admin.isMasterAdmin) || PLATFORM_ROLES.has(String(admin.role ?? ""));
  const partner = Boolean(admin.isMasterAdmin) || [...capabilities].some((capability) => PARTNER_CAPABILITIES.has(capability));
  if (platform && current !== "admin") links.push({ href: "/admin", label: "Platform Admin", icon: "admin_panel_settings" });
  if (partner && current !== "partner") links.push({ href: "/enterprise", label: "Partner Portal", icon: "domain" });
  return links;
}
