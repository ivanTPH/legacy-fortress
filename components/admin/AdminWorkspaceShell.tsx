"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import WorkspaceSwitcher from "@/components/navigation/WorkspaceSwitcher";
import Icon from "@/components/ui/Icon";
import type { AdminNavigationGroup } from "./adminNavigation";

type AdminWorkspaceShellProps = {
  workspaceLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  currentPathname: string;
  navigation: AdminNavigationGroup[];
  children: ReactNode;
  onSignOut: () => void;
  identityLabel?: string;
  identityDetail?: string;
  primaryAction?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  stagingLabel?: string;
};

export default function AdminWorkspaceShell({
  workspaceLabel,
  eyebrow,
  title,
  description,
  currentPathname,
  navigation,
  children,
  onSignOut,
  identityLabel = "Secure account",
  identityDetail,
  primaryAction,
  breadcrumbs = [],
  stagingLabel = "STAGING",
}: AdminWorkspaceShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const sidebar = (
    <aside className="lf-admin-shell-sidebar" aria-label={`${workspaceLabel} navigation`}>
      <Link href="/admin" className="lf-admin-shell-brand" prefetch={false}>
        <span className="lf-admin-shell-brand-mark">LF</span>
        <span>
          <strong>Legacy Fortress</strong>
          <small>{workspaceLabel}</small>
        </span>
      </Link>
      <nav className="lf-admin-shell-nav">
        {navigation.map((group) => (
          <section key={group.label} className="lf-admin-shell-nav-group">
            <div className="lf-admin-shell-nav-label">{group.label}</div>
            {group.items.map((item) => {
              const active = isActivePath(currentPathname, item.href);
              return (
                <Link key={item.key} href={item.href} className={active ? "lf-admin-shell-nav-link active" : "lf-admin-shell-nav-link"} onClick={() => setMenuOpen(false)} prefetch={false}>
                  <Icon name={item.icon} size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </section>
        ))}
      </nav>
    </aside>
  );

  const signOutButton = (className = "lf-admin-shell-secondary") => (
    <button type="button" className={className} aria-label="Sign out of Legacy Fortress" onClick={onSignOut}>
      Sign out
    </button>
  );

  return (
    <main className="lf-admin-shell">
      <button type="button" className="lf-admin-shell-mobile-toggle" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} aria-controls="admin-mobile-navigation">
        <Icon name="menu" size={20} />
        Menu
      </button>
      {sidebar}
      {menuOpen ? (
        <div className="lf-admin-shell-drawer" id="admin-mobile-navigation" role="dialog" aria-modal="true" aria-label={`${workspaceLabel} menu`}>
          <div className="lf-admin-shell-drawer-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="lf-admin-shell-drawer-panel">
            <button type="button" className="lf-admin-shell-drawer-close" onClick={() => setMenuOpen(false)}>
              <Icon name="close" size={18} />
              Close
            </button>
            <div className="lf-admin-shell-drawer-account">
              <div className="lf-admin-shell-identity" title={identityDetail ?? identityLabel}>
                <Icon name="account_circle" size={22} />
                <span>
                  <strong>{identityLabel}</strong>
                  {identityDetail ? <small>{identityDetail}</small> : null}
                </span>
              </div>
              {signOutButton("lf-admin-shell-secondary lf-admin-shell-drawer-signout")}
            </div>
            {sidebar}
          </div>
        </div>
      ) : null}
      <section className="lf-admin-shell-content">
        <header className="lf-admin-shell-header">
          <div className="lf-admin-shell-title">
            <p className="lf-admin-shell-eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
            {breadcrumbs.length ? (
              <nav className="lf-admin-shell-breadcrumb" aria-label="Breadcrumb">
                {breadcrumbs.map((item, index) => (
                  <span key={`${item.label}-${index}`}>
                    {item.href ? <Link href={item.href} prefetch={false}>{item.label}</Link> : item.label}
                  </span>
                ))}
              </nav>
            ) : null}
          </div>
          <div className="lf-admin-shell-actions">
            {stagingLabel ? <span className="lf-admin-shell-stage">{stagingLabel}</span> : null}
            {primaryAction}
            <WorkspaceSwitcher currentPathname={currentPathname} alwaysShow compact />
            <Link href="/dashboard" className="lf-admin-shell-secondary" prefetch={false}>Personal Vault</Link>
            <div className="lf-admin-shell-identity" title={identityDetail ?? identityLabel}>
              <Icon name="account_circle" size={22} />
              <span>
                <strong>{identityLabel}</strong>
                {identityDetail ? <small>{identityDetail}</small> : null}
              </span>
            </div>
            {signOutButton()}
          </div>
        </header>
        {children}
      </section>
      <style jsx global>{adminShellCss}</style>
    </main>
  );
}

function isActivePath(currentPathname: string, href: string) {
  const [hrefPath, hrefQuery] = href.split("?");
  const [currentPath, currentQuery = ""] = currentPathname.split("?");
  if (hrefQuery) return currentPath === hrefPath && currentQuery.includes(hrefQuery);
  if (hrefPath === "/admin") return currentPath === "/admin";
  if (hrefPath === "/application/enterprise") return currentPath === "/application/enterprise" && !currentQuery;
  return currentPath === hrefPath || currentPath.startsWith(`${hrefPath}/`);
}

const adminShellCss = `
  .lf-admin-shell {
    min-height: 100dvh;
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
    background: #f4f6f8;
    color: #0f172a;
  }
  .lf-admin-shell-sidebar {
    position: sticky;
    top: 0;
    height: 100dvh;
    overflow: auto;
    background: #111827;
    color: #f8fafc;
    padding: 20px;
    display: grid;
    align-content: start;
    gap: 24px;
  }
  .lf-admin-shell-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    color: inherit;
    text-decoration: none;
    min-width: 0;
  }
  .lf-admin-shell-brand-mark {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    background: #e5e7eb;
    color: #111827;
    font-weight: 800;
    flex: 0 0 auto;
  }
  .lf-admin-shell-brand small,
  .lf-admin-shell-identity small {
    display: block;
    color: #94a3b8;
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  .lf-admin-shell-nav,
  .lf-admin-shell-nav-group {
    display: grid;
    gap: 8px;
  }
  .lf-admin-shell-nav {
    gap: 18px;
  }
  .lf-admin-shell-nav-label {
    font-size: 11px;
    text-transform: uppercase;
    color: #94a3b8;
    font-weight: 800;
  }
  .lf-admin-shell-nav-link {
    display: flex;
    align-items: center;
    gap: 9px;
    color: #cbd5e1;
    text-decoration: none;
    padding: 9px 10px;
    border-radius: 6px;
    font-weight: 700;
    min-height: 40px;
  }
  .lf-admin-shell-nav-link.active {
    background: #f8fafc;
    color: #111827;
  }
  .lf-admin-shell-content {
    min-width: 0;
    padding: 28px;
    display: grid;
    gap: 18px;
    align-content: start;
  }
  .lf-admin-shell-header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    flex-wrap: wrap;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px;
  }
  .lf-admin-shell-title {
    display: grid;
    gap: 6px;
    min-width: 0;
    flex: 1 1 360px;
  }
  .lf-admin-shell-title h1 {
    margin: 0;
    font-size: 28px;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }
  .lf-admin-shell-title p {
    margin: 0;
    color: #64748b;
    line-height: 1.45;
  }
  .lf-admin-shell-eyebrow {
    color: #64748b;
    text-transform: uppercase;
    font-size: 12px;
    font-weight: 800;
  }
  .lf-admin-shell-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
    min-width: 0;
    flex: 1 1 420px;
  }
  .lf-admin-shell-secondary {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 9px 12px;
    color: #0f172a;
    text-decoration: none;
    font-weight: 700;
    background: #fff;
    min-height: 40px;
    cursor: pointer;
    white-space: nowrap;
  }
  .lf-admin-shell-stage {
    background: #fff7ed;
    color: #9a3412;
    border: 1px solid #fed7aa;
    border-radius: 6px;
    padding: 7px 10px;
    font-size: 12px;
    font-weight: 900;
    min-height: 34px;
    display: inline-flex;
    align-items: center;
  }
  .lf-admin-shell-identity {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid #dbe3ef;
    border-radius: 6px;
    padding: 7px 10px;
    background: #f8fafc;
    min-width: 0;
    max-width: 260px;
  }
  .lf-admin-shell-identity strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lf-admin-shell-breadcrumb {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 13px;
    color: #64748b;
  }
  .lf-admin-shell-breadcrumb span + span::before {
    content: "/";
    margin-right: 8px;
    color: #94a3b8;
  }
  .lf-admin-shell-mobile-toggle,
  .lf-admin-shell-drawer {
    display: none;
  }
  .lf-admin-shell-drawer-account {
    display: none;
  }
  @media (max-width: 860px) {
    .lf-admin-shell {
      display: block;
    }
    .lf-admin-shell > .lf-admin-shell-sidebar {
      display: none;
    }
    .lf-admin-shell-mobile-toggle {
      position: sticky;
      top: 0;
      z-index: 30;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 12px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      min-height: 44px;
      padding: 10px 12px;
      background: #fff;
      color: #0f172a;
      font-weight: 800;
    }
    .lf-admin-shell-content {
      padding: 12px;
      gap: 12px;
    }
    .lf-admin-shell-header {
      display: grid;
      padding: 16px;
    }
    .lf-admin-shell-actions {
      justify-content: flex-start;
      min-width: 0;
      width: 100%;
      flex: none;
    }
    .lf-admin-shell-title h1 {
      font-size: 24px;
    }
    .lf-admin-shell-identity {
      max-width: 100%;
      flex: 1 1 220px;
    }
    .lf-admin-shell-secondary,
    .lf-admin-shell-stage {
      min-height: 44px;
    }
    .lf-admin-shell-drawer {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 50;
    }
    .lf-admin-shell-drawer-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, .45);
    }
    .lf-admin-shell-drawer-panel {
      position: relative;
      width: min(320px, calc(100vw - 32px));
      min-height: 100dvh;
      background: #111827;
      color: #f8fafc;
      overflow: auto;
    }
    .lf-admin-shell-drawer-panel .lf-admin-shell-sidebar {
      position: static;
      height: auto;
      min-height: 100dvh;
    }
    .lf-admin-shell-drawer-close {
      margin: 12px 12px 0;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid #475569;
      border-radius: 6px;
      background: #1f2937;
      color: #f8fafc;
      padding: 10px 12px;
      font-weight: 800;
    }
    .lf-admin-shell-drawer-account {
      display: grid;
      gap: 10px;
      padding: 12px 20px 20px;
    }
    .lf-admin-shell-drawer-account .lf-admin-shell-identity {
      background: #1f2937;
      border-color: #475569;
      color: #f8fafc;
    }
    .lf-admin-shell-drawer-signout {
      width: 100%;
      background: #f8fafc;
      color: #111827;
      text-align: center;
    }
  }
`;

export const adminPanelStyle = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 18,
  display: "grid",
  gap: 14,
} satisfies CSSProperties;
