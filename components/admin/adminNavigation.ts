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
    label: "Platform Enterprise",
    items: [
      { key: "organisations", label: "Organisations", href: "/admin/organisations", icon: "domain", capability: "organisation:view" },
      { key: "licences", label: "Licences", href: "/admin/licences", icon: "license", capability: "licence:view" },
      { key: "enterprise-audit", label: "Enterprise audit", href: "/admin/audit?scope=enterprise", icon: "history", capability: "enterprise.report.read" },
    ],
  },
  {
    label: "Platform Probate",
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
      { key: "enterprise-overview", label: "Overview", href: "/enterprise", icon: "space_dashboard", capability: "enterprise.workspace.access" },
      { key: "enterprise-organisations", label: "Organisations", href: "/enterprise?tab=organisations", icon: "domain", capability: "organisation:view" },
      { key: "enterprise-licences", label: "Licences", href: "/enterprise?tab=licences", icon: "license", capability: "licence:view" },
      { key: "enterprise-users", label: "Users and seats", href: "/enterprise?tab=users", icon: "groups", capability: "enterprise.membership.read" },
      { key: "enterprise-invitations", label: "Invitations", href: "/enterprise?tab=invitations", icon: "forward_to_inbox", capability: "enterprise.invitation.manage" },
      { key: "enterprise-registration-links", label: "Registration links", href: "/enterprise?tab=registration-links", icon: "link", capability: "enterprise.enrolment_link.manage" },
      { key: "enterprise-reports", label: "Reports", href: "/enterprise?tab=reports", icon: "analytics", capability: "enterprise.report.read" },
    ],
  },
];

export const PROBATE_REVIEW_NAVIGATION: AdminNavigationGroup[] = [
  {
    label: "Probate Review",
    items: [
      { key: "probate", label: "Review queue", href: "/admin/probate", icon: "gavel", capability: "probate:read" },
      { key: "verification", label: "Verification / evidence", href: "/admin/verification", icon: "fact_check", capability: "verification:read" },
      { key: "probate-audit", label: "Probate audit", href: "/admin/audit?scope=probate", icon: "history", capability: "audit:read" },
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
