"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Icon from "../../ui/Icon";
import AdminStatusBadge from "./AdminStatusBadge";
import {
  getAdminPrototypeRoleForTestPersona,
  isTestPersonaAccessEnabled,
  TEST_PERSONA_STORAGE_KEY,
} from "../../../lib/testPersonas";
import {
  adminPrototypeUsers,
  type AdminPrototypeCapability,
  type AdminPrototypeRole,
} from "./mockData";

type AdminPrototypeShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

type AdminPrototypeNavItem = {
  href: string;
  label: string;
  icon: string;
  capability?: AdminPrototypeCapability;
  exact?: boolean;
};

type AdminPrototypeNavSection = {
  label: string;
  capability: AdminPrototypeCapability;
  items: AdminPrototypeNavItem[];
};

const navItems: AdminPrototypeNavSection[] = [
  {
    label: "Probate Review",
    capability: "probate_review" as const,
    items: [
      { href: "/internal/admin/prototype/cases", label: "Cases", icon: "folder_managed" },
      { href: "/internal/admin/prototype/verifications", label: "Verifications", icon: "verified_user" },
      { href: "/internal/admin/prototype/users", label: "Users", icon: "group" },
      { href: "/internal/admin/prototype/access", label: "Access", icon: "admin_panel_settings" },
      { href: "/internal/admin/prototype/audit", label: "Audit", icon: "history" },
    ],
  },
  {
    label: "Enterprise & Licensing",
    capability: "enterprise" as const,
    items: [
      { href: "/internal/admin/prototype/enterprise", label: "Enterprise dashboard", icon: "space_dashboard", exact: true },
      { href: "/internal/admin/prototype/organisations", label: "Organisations", icon: "corporate_fare" },
      { href: "/internal/admin/prototype/licences", label: "Licences", icon: "license" },
      { href: "/internal/admin/prototype/reports", label: "Reports", icon: "bar_chart", exact: true },
      { href: "/internal/admin/prototype/reports/client-insights", label: "Client insights", icon: "insights" },
      { href: "/internal/admin/prototype/campaigns", label: "Campaigns", icon: "campaign" },
    ],
  },
];

export default function AdminPrototypeShell({ title, description, children }: AdminPrototypeShellProps) {
  const pathname = usePathname();
  const [roleParam, setRoleParam] = useState<string | null>(null);
  useEffect(() => {
    const explicitRole = new URLSearchParams(window.location.search).get("role");
    if (explicitRole) {
      setRoleParam(explicitRole);
      return;
    }

    if (isTestPersonaAccessEnabled()) {
      setRoleParam(getAdminPrototypeRoleForTestPersona(window.localStorage.getItem(TEST_PERSONA_STORAGE_KEY)));
    }
  }, []);
  const mockAdmin = resolveMockAdmin(roleParam);
  const requiredCapability = getRequiredCapabilityForPath(pathname);
  const hasAccess = !requiredCapability || hasCapability(mockAdmin, requiredCapability);
  const context = getAdminPrototypeContext(pathname);
  const prototypeLabel = context.mode === "enterprise"
    ? "Enterprise prototype — static mock data"
    : "Admin prototype — static mock data";

  return (
    <main className="lf-admin-prototype-shell" style={shellStyle}>
      <aside className="lf-admin-prototype-sidebar" style={sidebarStyle}>
        <Link href="/internal/admin/prototype" style={brandStyle}>
          <span style={brandMarkStyle}>LF</span>
          <span>
            <strong>Legacy Fortress</strong>
            <span style={brandSubStyle}>Operations prototype</span>
          </span>
        </Link>
        <nav style={{ display: "grid", gap: 16 }} aria-label="Admin prototype navigation">
          {navItems
            .filter((section) => hasCapability(mockAdmin, section.capability))
            .map((section, index) => (
              <section key={section.label} style={navSectionStyle(index > 0)}>
                <div style={navSectionLabelStyle}>{section.label}</div>
                <div style={{ display: "grid", gap: 4 }}>
                  {section.items
                    .filter((item) => !item.capability || hasCapability(mockAdmin, item.capability))
                    .map((item) => {
                      const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
                      return (
                        <Link
                          key={item.href}
                          href={withRoleParam(item.href, mockAdmin.role)}
                          aria-current={active ? "page" : undefined}
                          style={navItemStyle(active)}
                        >
                          <span style={navIconStyle(active)} aria-hidden="true">
                            <Icon name={item.icon} size={18} />
                          </span>
                          {item.label}
                        </Link>
                      );
                    })}
                </div>
              </section>
            ))}
        </nav>
      </aside>
      <section className="lf-admin-prototype-content" style={contentStyle}>
        <header className="lf-admin-prototype-topbar" style={topbarStyle}>
          <div style={contextIndicatorStyle} aria-label="Admin area context">
            <strong style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Icon name={context.mode === "enterprise" ? "corporate_fare" : "shield_lock"} size={20} />
              {context.label}
            </strong>
            <span>{context.subtitle}</span>
          </div>
          <label style={searchWrapStyle}>
            <Icon name="search" size={18} />
            <input aria-label="Search admin prototype" placeholder={context.searchPlaceholder} style={searchStyle} />
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={roleBadgeStyle}>{formatRoleLabel(mockAdmin.role)}</span>
            <span style={{ color: "var(--lf-text)", fontSize: 13, fontWeight: 700 }}>{mockAdmin.name}</span>
          </div>
        </header>
        <section className="lf-admin-prototype-page-header" style={pageHeaderStyle}>
          <div>
            <span style={contextBadgeStyle}>{context.label}</span>
            <h1 style={{ margin: 0, fontSize: 26, color: "var(--lf-text)" }}>{title}</h1>
            <p style={{ margin: "6px 0 0", color: "var(--lf-text-soft)", fontSize: 14, lineHeight: 1.45 }}>{description}</p>
          </div>
          <AdminStatusBadge status={prototypeLabel === "Enterprise prototype — static mock data" ? "Static mock data" : "Static mock data"} />
        </section>
        {hasAccess ? children : <AccessRestricted requiredCapability={requiredCapability} role={mockAdmin.role} />}
      </section>
    </main>
  );
}

function resolveMockAdmin(roleParam: string | null) {
  const requestedRole = roleParam?.trim() as AdminPrototypeRole | undefined;
  return adminPrototypeUsers.find((user) => user.role === requestedRole) ?? adminPrototypeUsers[0];
}

function hasCapability(user: { capabilities: AdminPrototypeCapability[] }, capability: AdminPrototypeCapability) {
  return user.capabilities.includes(capability);
}

function isEnterprisePath(pathname: string) {
  return (
    pathname.startsWith("/internal/admin/prototype/organisations") ||
    pathname.startsWith("/internal/admin/prototype/enterprise") ||
    pathname.startsWith("/internal/admin/prototype/licences") ||
    pathname.startsWith("/internal/admin/prototype/campaigns") ||
    pathname.startsWith("/internal/admin/prototype/reports")
  );
}

function getAdminPrototypeContext(pathname: string) {
  if (isEnterprisePath(pathname)) {
    return {
      mode: "enterprise" as const,
      label: "Enterprise & Licensing",
      subtitle: "Organisation licensing, client portfolio insights, and reporting",
      searchPlaceholder: "Search organisations, licences, reports",
    };
  }

  return {
    mode: "probate" as const,
    label: "Probate Operations",
    subtitle: "Operational case management and verification workflows",
    searchPlaceholder: "Search cases, verifications, users",
  };
}

function getRequiredCapabilityForPath(pathname: string): AdminPrototypeCapability | null {
  if (pathname.startsWith("/internal/admin/prototype/enterprise")) return "enterprise";
  if (pathname.startsWith("/internal/admin/prototype/campaigns")) return "enterprise";
  if (pathname.startsWith("/internal/admin/prototype/licences")) return "enterprise";
  if (pathname.startsWith("/internal/admin/prototype/reports")) return "reports";
  if (pathname.startsWith("/internal/admin/prototype/organisations")) return "enterprise";
  if (
    pathname.startsWith("/internal/admin/prototype/cases") ||
    pathname.startsWith("/internal/admin/prototype/verifications") ||
    pathname.startsWith("/internal/admin/prototype/users") ||
    pathname.startsWith("/internal/admin/prototype/access") ||
    pathname.startsWith("/internal/admin/prototype/audit")
  ) {
    return "probate_review";
  }
  return null;
}

function withRoleParam(href: string, role: AdminPrototypeRole) {
  return `${href}?role=${role}`;
}

function formatRoleLabel(role: AdminPrototypeRole) {
  return role.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function AccessRestricted({
  requiredCapability,
  role,
}: {
  requiredCapability: AdminPrototypeCapability | null;
  role: AdminPrototypeRole;
}) {
  return (
    <section style={restrictedStyle} role="status" aria-live="polite">
      <AdminStatusBadge status="Restricted" />
      <strong>Access restricted</strong>
      <span>
        This static prototype page requires {requiredCapability ? requiredCapability.replace(/_/g, " ") : "additional"} permission.
        Current mock role: {formatRoleLabel(role)}.
      </span>
      <span>No live operations, user vault data, or enterprise records are exposed.</span>
    </section>
  );
}

const shellStyle: CSSProperties = {
  minHeight: "100vh",
  background: "var(--lf-bg)",
  display: "grid",
  gridTemplateColumns: "286px minmax(0, 1fr)",
  color: "var(--lf-text)",
};

const sidebarStyle: CSSProperties = {
  background: "var(--lf-surface)",
  color: "var(--lf-text)",
  borderRight: "1px solid var(--lf-border)",
  padding: "20px 16px 16px",
  display: "grid",
  alignContent: "start",
  gap: 14,
};

const brandStyle: CSSProperties = {
  color: "var(--lf-text)",
  textDecoration: "none",
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "2px 4px",
};

const brandMarkStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 8,
  background: "linear-gradient(180deg, var(--lf-bronze) 0%, var(--lf-bronze-strong) 100%)",
  color: "#fff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  fontWeight: 800,
};

const brandSubStyle: CSSProperties = {
  display: "block",
  color: "#81766f",
  fontSize: 12,
  fontWeight: 500,
};

function navSectionStyle(divided: boolean): CSSProperties {
  return {
    display: "grid",
    gap: 7,
    borderTop: divided ? "1px solid var(--lf-border)" : "none",
    paddingTop: divided ? 16 : 0,
  };
}

const navSectionLabelStyle: CSSProperties = {
  color: "#81766f",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: "uppercase",
  padding: "0 4px",
};

function navItemStyle(active: boolean): CSSProperties {
  return {
    color: active ? "#fff" : "#364152",
    background: active ? "linear-gradient(180deg, var(--lf-bronze) 0%, var(--lf-bronze-strong) 100%)" : "transparent",
    border: active ? "1px solid #2b1812" : "1px solid transparent",
    boxShadow: active ? "inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 8px 18px rgba(33, 17, 13, 0.16)" : "none",
    borderRadius: 8,
    padding: "10px 11px",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: active ? 700 : 500,
    display: "flex",
    alignItems: "center",
    gap: 12,
  };
}

function navIconStyle(active: boolean): CSSProperties {
  return {
    width: 30,
    height: 30,
    borderRadius: 9,
    border: active ? "1px solid rgba(255, 255, 255, 0.2)" : "1px solid transparent",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: active ? "#fff" : "currentColor",
    background: active ? "rgba(255, 255, 255, 0.12)" : "#f3f1ee",
    flex: "0 0 auto",
  };
}

const contentStyle: CSSProperties = {
  minWidth: 0,
  display: "grid",
  alignContent: "start",
  gap: 18,
  padding: 32,
};

const topbarStyle: CSSProperties = {
  minHeight: 58,
  background: "var(--lf-surface)",
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: "8px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const contextIndicatorStyle: CSSProperties = {
  display: "grid",
  gap: 2,
  minWidth: 250,
  color: "var(--lf-text)",
};

const contextBadgeStyle: CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  border: "1px solid #d8cec3",
  borderRadius: 999,
  background: "#f5f1ec",
  color: "var(--lf-bronze)",
  padding: "4px 9px",
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 8,
};

const searchWrapStyle: CSSProperties = {
  width: "min(460px, 100%)",
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: "0 10px",
  minHeight: 40,
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#6b5a4c",
  background: "#fffefd",
};

const searchStyle: CSSProperties = {
  width: "100%",
  border: 0,
  outline: 0,
  background: "transparent",
  fontSize: 14,
};

const roleBadgeStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 999,
  padding: "5px 10px",
  color: "var(--lf-text)",
  background: "var(--lf-surface-muted)",
  fontSize: 12,
  fontWeight: 800,
};

const pageHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "start",
};

const restrictedStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e1d5cd",
  borderRadius: 8,
  color: "var(--lf-bronze)",
  padding: 18,
  display: "grid",
  gap: 8,
  fontSize: 14,
};
