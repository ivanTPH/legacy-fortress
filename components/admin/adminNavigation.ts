export type AdminNavigationItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
  capability?: string;
  /** Merged menu item (UX review 2): each tab is its own page and keeps its own capability check. */
  tabs?: AdminNavigationTab[];
};

export type AdminNavigationTab = { key: string; label: string; href: string; capability?: string };

export type AdminNavigationGroup = {
  label: string;
  items: AdminNavigationItem[];
};

// Owner approved 18 Nov 2026 (UX review 2): 15 menu items become 9 by merging duplicate queues. Only the menu
// changes: every page keeps its own route and capability, and a merged item shows its pages as tabs.
export const PLATFORM_ADMIN_NAVIGATION: AdminNavigationGroup[] = [
  {
    label: "",
    items: [
      { key: "inbox", label: "Inbox", href: "/admin/inbox", icon: "inbox", capability: "users:lookup" },
      { key: "overview", label: "Overview", href: "/admin", icon: "space_dashboard", capability: "admin.dashboard.read" },
    ],
  },
  {
    label: "Customers",
    items: [
      { key: "users", label: "Customers", href: "/admin/users", icon: "manage_accounts", capability: "users:lookup" },
      { key: "invitations", label: "Invitations and help", href: "/admin/invitations", icon: "forward_to_inbox", tabs: [
        { key: "invitations", label: "Invitations", href: "/admin/invitations", capability: "support:read" },
        { key: "support", label: "Help and support", href: "/admin/support", capability: "support:read" },
      ] },
      { key: "probate", label: "Cases", href: "/admin/probate", icon: "gavel", tabs: [
        { key: "probate", label: "Probate cases", href: "/admin/probate", capability: "admin.probate.summary.read" },
        { key: "access", label: "Access requests", href: "/admin/access", capability: "support:read" },
      ] },
      { key: "verification", label: "Checks", href: "/admin/verification", icon: "verified_user", tabs: [
        { key: "verification", label: "ID checks", href: "/admin/verification", capability: "verification:read" },
        { key: "authorities", label: "Powers of Attorney", href: "/admin/authorities", capability: "verification:read" },
      ] },
    ],
  },
  {
    label: "Partners",
    items: [
      { key: "organisations", label: "Partners", href: "/admin/organisations", icon: "domain", tabs: [
        { key: "organisations", label: "Organisations", href: "/admin/organisations", capability: "organisation:view" },
        { key: "licences", label: "Licences", href: "/admin/licences", capability: "licence:view" },
      ] },
    ],
  },
  {
    label: "Oversight",
    items: [
      { key: "audit", label: "Audit and health", href: "/admin/audit", icon: "receipt_long", tabs: [
        { key: "audit", label: "Audit", href: "/admin/audit", capability: "audit:read" },
        { key: "enterprise-audit", label: "Partner audit", href: "/admin/audit?scope=enterprise", capability: "enterprise.report.read" },
        { key: "probate-audit", label: "Probate audit", href: "/admin/audit?scope=probate", capability: "audit:read" },
        { key: "system-health", label: "System health", href: "/admin/system-health", capability: "admin.dashboard.read" },
      ] },
      { key: "admin-users", label: "Team and settings", href: "/admin/admin-users", icon: "admin_panel_settings", tabs: [
        { key: "admin-users", label: "Admin users", href: "/admin/admin-users", capability: "admin_users:manage" },
        { key: "settings", label: "Settings", href: "/admin/settings", capability: "admin_shell:view" },
      ] },
    ],
  },
];

export const ENTERPRISE_ADMIN_NAVIGATION: AdminNavigationGroup[] = [
  {
    label: "Enterprise operations",
    items: [
      { key: "enterprise-overview", label: "Overview", href: "/enterprise", icon: "space_dashboard", capability: "enterprise.workspace.access" },
      { key: "enterprise-organisations", label: "Organisations", href: "/enterprise?tab=organisations", icon: "domain", capability: "organisation:view" },
      { key: "enterprise-licences", label: "Licences", href: "/enterprise?tab=licences", icon: "license", capability: "licence:view" },
      { key: "enterprise-users", label: "Users and seats", href: "/enterprise?tab=users", icon: "groups", capability: "enterprise.membership.read" },
      { key: "enterprise-invitations", label: "Invitations", href: "/enterprise?tab=invitations", icon: "forward_to_inbox", capability: "enterprise.invitation.manage" },
      { key: "enterprise-registration-links", label: "Registration links", href: "/enterprise?tab=registration-links", icon: "link", capability: "enterprise.enrolment_link.manage" },
      { key: "enterprise-reports", label: "Reports", href: "/enterprise?tab=reports", icon: "analytics", capability: "enterprise.report.read" },
      { key: "enterprise-settings", label: "Organisation settings", href: "/enterprise?tab=settings", icon: "settings", capability: "enterprise.workspace.access" },
      { key: "enterprise-help", label: "Help", href: "/enterprise?tab=help", icon: "help", capability: "enterprise.workspace.access" },
    ],
  },
];

export const PROBATE_REVIEW_NAVIGATION: AdminNavigationGroup[] = [
  {
    label: "Probate review",
    items: [
      { key: "probate", label: "Review queue", href: "/admin/probate", icon: "gavel", capability: "admin.probate.summary.read" },
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
      items: group.items
        .map((item) => {
          if (!item.tabs) return item;
          const tabs = item.tabs.filter((tab) => !tab.capability || capabilitySet.has(tab.capability));
          // The menu item opens the first page this role may see.
          return tabs.length ? { ...item, href: tabs[0].href, tabs } : null;
        })
        .filter((item): item is AdminNavigationItem => item !== null && (!item.capability || capabilitySet.has(item.capability))),
    }))
    .filter((group) => group.items.length > 0);
}

export function labelPartnerNavigation(groups: AdminNavigationGroup[]): AdminNavigationGroup[] {
  return groups.map((group) => ({
    ...group,
    label: "Partner Portal",
    items: group.items.map((item) => ({
      ...item,
      label: item.key === "enterprise-users" ? "Team & seats" : item.key === "enterprise-licences" ? "Licence" : item.label,
    })),
  }));
}
