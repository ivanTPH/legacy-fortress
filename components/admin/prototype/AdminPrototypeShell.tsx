"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Icon from "../../ui/Icon";
import { PlatformRestrictedState } from "../../ui/PlatformPrimitives";
import WorkspaceSwitcher from "../../navigation/WorkspaceSwitcher";
import AdminStatusBadge from "./AdminStatusBadge";
import { waitForActiveUser } from "../../../lib/auth/session";
import { canRoleAccessPath } from "../../../lib/accessModel";
import { getMasterAdminRolesForEmail, mergePlatformRoles } from "../../../lib/auth/adminRoles";
import { extractPlatformRolesFromMetadata } from "../../../lib/auth/platformRoles";
import { supabase } from "../../../lib/supabaseClient";
import {
  buildPrototypePreviewHref,
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
  visible?: (user: { role: AdminPrototypeRole; capabilities: AdminPrototypeCapability[] }) => boolean;
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
      { href: "/internal/admin/prototype/access", label: "Access", icon: "admin_panel_settings" },
      { href: "/internal/admin/prototype/audit", label: "Audit", icon: "history" },
    ],
  },
  {
    label: "Enterprise & Licensing",
    capability: "enterprise" as const,
    items: [
      { href: "/internal/admin/prototype/enterprise", label: "Overview", icon: "space_dashboard", exact: true },
      { href: "/internal/admin/prototype/users", label: "Users & Permissions", icon: "manage_accounts", visible: canViewUsersAndPermissions },
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
  const router = useRouter();
  const [roleParam] = useState<string | null>(() => getInitialRoleParam());
  const [permissionState, setPermissionState] = useState<"checking" | "allowed" | "denied">("checking");
  const [permissionMessage, setPermissionMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function verifyAdminPermission() {
      const user = await waitForActiveUser(supabase, { attempts: 4, delayMs: 120 });
      if (!mounted) return;
      if (!user) {
        const currentSearch = typeof window === "undefined" ? "" : window.location.search;
        const requestedPath = `${pathname}${currentSearch}`;
        router.replace(`/sign-in?next=${encodeURIComponent(requestedPath)}`);
        return;
      }

      const userRoles = mergePlatformRoles(
        extractPlatformRolesFromMetadata(user.app_metadata),
        extractPlatformRolesFromMetadata(user.user_metadata),
        getMasterAdminRolesForEmail(user.email),
      );
      if (canRoleAccessPath(userRoles, pathname)) {
        setPermissionState("allowed");
        return;
      }

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token ?? "";
      const response = await fetch("/api/internal/admin/session", {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!mounted) return;
      if (!response.ok || !payload.ok) {
        setPermissionState("denied");
        setPermissionMessage(payload.message || "Admin access is restricted.");
        return;
      }
      setPermissionState("allowed");
    }

    void verifyAdminPermission();
    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  const mockAdmin = resolveMockAdmin(roleParam);
  const requiredCapability = getRequiredCapabilityForPath(pathname);
  const requiresUsersAndPermissions = pathname.startsWith("/internal/admin/prototype/users");
  const hasAccess = requiresUsersAndPermissions
    ? canViewUsersAndPermissions(mockAdmin)
    : !requiredCapability || hasCapability(mockAdmin, requiredCapability);
  const context = getAdminPrototypeContext(pathname);
  const prototypeLabel = context.mode === "enterprise"
    ? "Enterprise prototype — static mock data"
    : "Admin prototype — static mock data";

  if (permissionState === "checking") {
    return (
      <main className="lf-admin-prototype-shell" style={restrictedShellStyle}>
        <section style={restrictedPanelStyle}>Checking admin permissions...</section>
      </main>
    );
  }

  if (permissionState === "denied") {
    return (
      <main className="lf-admin-prototype-shell" style={restrictedShellStyle}>
        <section style={restrictedPanelStyle}>
          <h1 style={{ margin: 0, fontSize: 24 }}>Access denied</h1>
          <p style={{ margin: 0, color: "var(--lf-text-soft)", lineHeight: 1.5 }}>
            {permissionMessage || "This dashboard is controlled by owner-granted admin permissions."}
          </p>
          <Link href="/dashboard" style={primaryCtaStyle}>Return to dashboard</Link>
        </section>
      </main>
    );
  }

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
        <nav style={{ display: "grid", gap: 18 }} aria-label="Admin prototype navigation">
          {navItems
            .filter((section) => hasCapability(mockAdmin, section.capability))
            .map((section, index) => (
              <section key={section.label} style={navSectionStyle(index > 0)}>
                <div style={navSectionLabelStyle}>{section.label}</div>
                <div style={{ display: "grid", gap: 4 }}>
                  {section.items
                    .filter((item) => (!item.capability || hasCapability(mockAdmin, item.capability)) && (!item.visible || item.visible(mockAdmin)))
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
                          <span className="lf-admin-nav-label">{item.label}</span>
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
          <div style={topbarActionsStyle}>
            <WorkspaceSwitcher
              compact
              adminRole={mockAdmin.role}
              currentPathname={pathname}
              governanceContext={`${context.label} · prototype route guard · ${hasAccess ? "allowed" : "restricted"}`}
            />
            <span className="lf-admin-user-name" style={{ color: "var(--lf-text)", fontSize: 13, fontWeight: 700 }}>{mockAdmin.name}</span>
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
        <details className="lf-prototype-session-details">
          <summary>Prototype session</summary>
          <span>{formatRoleLabel(mockAdmin.role)} · {mockAdmin.name} · {hasAccess ? "allowed" : "restricted"} · exports and production bypasses disabled</span>
        </details>
        {hasAccess ? children : <AccessRestricted requiredCapability={requiredCapability} role={mockAdmin.role} usersAndPermissions={requiresUsersAndPermissions} />}
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

function getInitialRoleParam() {
  if (typeof window === "undefined") return null;
  const explicitRole = new URLSearchParams(window.location.search).get("role");
  if (explicitRole) return explicitRole;
  if (!isTestPersonaAccessEnabled()) return null;
  return getAdminPrototypeRoleForTestPersona(window.localStorage.getItem(TEST_PERSONA_STORAGE_KEY));
}

function canViewUsersAndPermissions(user: { role: AdminPrototypeRole; capabilities: AdminPrototypeCapability[] }) {
  return user.role === "super_admin" && hasCapability(user, "probate_review");
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
  return buildPrototypePreviewHref(href, role);
}

function formatRoleLabel(role: AdminPrototypeRole) {
  return role.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function AccessRestricted({
  requiredCapability,
  role,
  usersAndPermissions = false,
}: {
  requiredCapability: AdminPrototypeCapability | null;
  role: AdminPrototypeRole;
  usersAndPermissions?: boolean;
}) {
  return (
    <PlatformRestrictedState
      title="Access restricted"
      detail={`This static prototype page requires ${usersAndPermissions ? "super admin Users & Permissions" : requiredCapability ? requiredCapability.replace(/_/g, " ") : "additional"} permission. Current mock role: ${formatRoleLabel(role)}.`}
      meta="No live operations, user vault data, or enterprise records are exposed."
    />
  );
}

const restrictedShellStyle: CSSProperties = {
  minHeight: "100vh",
  background: "var(--lf-bg)",
  color: "var(--lf-text)",
  display: "grid",
  placeItems: "center",
  padding: 24,
};

const restrictedPanelStyle: CSSProperties = {
  width: "min(100%, 560px)",
  background: "var(--lf-surface)",
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: 24,
  display: "grid",
  gap: 12,
  boxShadow: "0 16px 36px rgba(31, 23, 18, 0.08)",
};

const primaryCtaStyle: CSSProperties = {
  width: "fit-content",
  border: "1px solid #15110f",
  borderRadius: 8,
  background: "#15110f",
  color: "#fff",
  padding: "10px 14px",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 800,
};

const shellStyle: CSSProperties = {
  minHeight: "100vh",
  background: "var(--lf-bg)",
  display: "grid",
  gridTemplateColumns: "var(--lf-shell-sidebar-width) minmax(0, 1fr)",
  color: "var(--lf-text)",
};

const sidebarStyle: CSSProperties = {
  background: "var(--lf-surface)",
  color: "var(--lf-text)",
  borderRight: "1px solid var(--lf-border)",
  padding: "22px 18px 18px",
  display: "grid",
  alignContent: "start",
  gap: 18,
  position: "sticky",
  top: 0,
  height: "100dvh",
  overflow: "hidden",
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
    gap: 8,
    borderTop: divided ? "1px solid var(--lf-border)" : "none",
    paddingTop: divided ? 18 : 0,
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
    background: active ? "linear-gradient(180deg, var(--lf-bronze) 0%, var(--lf-bronze-strong) 100%)" : "#fffefd",
    border: active ? "1px solid #2b1812" : "1px solid transparent",
    boxShadow: active ? "inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 8px 18px rgba(33, 17, 13, 0.13)" : "none",
    borderRadius: 8,
    padding: "8px 10px",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: active ? 750 : 600,
    display: "flex",
    alignItems: "center",
    gap: 11,
    minHeight: 46,
    transition: "background-color 140ms ease, border-color 140ms ease, color 140ms ease, box-shadow 140ms ease",
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
  width: "100%",
  maxWidth: "calc(var(--lf-shell-content-max-width) + 64px)",
  margin: "0 auto",
};

const topbarStyle: CSSProperties = {
  minHeight: "var(--lf-shell-header-min-height)",
  background: "var(--lf-surface)",
  borderBottom: "1px solid var(--lf-border)",
  padding: "18px 22px",
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

const topbarActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 8,
  flexWrap: "wrap",
};

const pageHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "start",
};
