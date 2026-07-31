export type AdminNavigationItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
  capability?: string;
};

export type AdminNavigationGroup = {
  label: string;
  items: AdminNavigationItem[];
};

export const PLATFORM_ADMIN_NAVIGATION: AdminNavigationGroup[] = [
  {
    label: "Platform Administration",
    items: [
      { key: "overview", label: "Overview", href: "/admin", icon: "space_dashboard", capability: "admin.dashboard.read" },
      { key: "users", label: "Users", href: "/admin/users", icon: "manage_accounts", capability: "users:lookup" },
      { key: "admin-users", label: "Admin users", href: "/admin/admin-users", icon: "admin_panel_settings", capability: "admin_users:manage" },
      { key: "invitations", label: "Invitations", href: "/admin/invitations", icon: "forward_to_inbox", capability: "support:read" },
      { key: "access", label: "Access requests", href: "/admin/access", icon: "vpn_key", capability: "support:read" },
      { key: "support", label: "Support", href: "/admin/support", icon: "support_agent", capability: "support:read" },
    ],
  },
  {
    label: "Enterprise Operations",
    items: [
      { key: "enterprise", label: "Enterprise workspace", href: "/application/enterprise", icon: "corporate_fare", capability: "organisation:view" },
      { key: "enterprise-organisations", label: "Organisations", href: "/application/enterprise?tab=organisations", icon: "domain", capability: "organisation:view" },
      { key: "enterprise-licences", label: "Licences", href: "/application/enterprise?tab=licences", icon: "license", capability: "licence:view" },
      { key: "enterprise-reports", label: "Reports", href: "/application/enterprise?tab=reports", icon: "analytics", capability: "enterprise.report.read" },
    ],
  },
  {
    label: "Probate Review",
    items: [
      { key: "probate", label: "Probate queue", href: "/admin/probate", icon: "gavel", capability: "probate:read" },
      { key: "verification", label: "Verification", href: "/admin/verification", icon: "fact_check", capability: "verification:read" },
    ],
  },
  {
    label: "Oversight",
    items: [
      { key: "audit", label: "Audit", href: "/admin/audit", icon: "history", capability: "audit:read" },
      { key: "system-health", label: "System health", href: "/admin/system-health", icon: "monitor_heart", capability: "admin.dashboard.read" },
      { key: "settings", label: "Settings", href: "/admin/settings", icon: "settings", capability: "admin_shell:view" },
    ],
  },
];

export const ENTERPRISE_ADMIN_NAVIGATION: AdminNavigationGroup[] = [
  {
    label: "Enterprise Operations",
    items: [
      { key: "enterprise-overview", label: "Overview", href: "/application/enterprise", icon: "space_dashboard", capability: "enterprise.workspace.access" },
      { key: "enterprise-organisations", label: "Organisations", href: "/application/enterprise?tab=organisations", icon: "domain", capability: "organisation:view" },
      { key: "enterprise-licences", label: "Licences", href: "/application/enterprise?tab=licences", icon: "license", capability: "licence:view" },
      { key: "enterprise-users", label: "Users and seats", href: "/application/enterprise?tab=users", icon: "groups", capability: "enterprise.membership.read" },
      { key: "enterprise-invitations", label: "Invitations", href: "/application/enterprise?tab=invitations", icon: "forward_to_inbox", capability: "enterprise.invitation.manage" },
      { key: "enterprise-reports", label: "Reports", href: "/application/enterprise?tab=reports", icon: "analytics", capability: "enterprise.report.read" },
    ],
  },
  {
    label: "Related Workspaces",
    items: [
      { key: "platform-admin", label: "Platform Administration", href: "/admin", icon: "admin_panel_settings", capability: "admin.dashboard.read" },
      { key: "probate", label: "Probate Review", href: "/admin/probate", icon: "gavel", capability: "probate:read" },
      { key: "audit", label: "Audit", href: "/admin/audit", icon: "history", capability: "audit:read" },
    ],
  },
];

export function filterAdminNavigation(groups: AdminNavigationGroup[], capabilities: string[]) {
  const capabilitySet = new Set(capabilities);
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.capability || capabilitySet.has(item.capability)),
    }))
    .filter((group) => group.items.length > 0);
}
