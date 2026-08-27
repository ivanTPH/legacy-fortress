"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
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
  identityAvatarUrl?: string;
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
  identityAvatarUrl = "",
  primaryAction,
  breadcrumbs = [],
  stagingLabel = "STAGING",
}: AdminWorkspaceShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const accountTriggerRef = useRef<HTMLButtonElement | null>(null);
  const accountMenuId = useId();

  useEffect(() => {
    queueMicrotask(() => {
      setAccountMenuOpen(false);
      setMenuOpen(false);
    });
  }, [currentPathname]);

  useEffect(() => {
    if (!menuOpen && !accountMenuOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (accountMenuOpen) {
        setAccountMenuOpen(false);
        accountTriggerRef.current?.focus();
      }
      if (menuOpen) setMenuOpen(false);
    }

    function onOtherMenuOpen(event: Event) {
      if ((event as CustomEvent).detail?.source === accountMenuId) return;
      setAccountMenuOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("lf-admin-menu-open", onOtherMenuOpen);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("lf-admin-menu-open", onOtherMenuOpen);
    };
  }, [accountMenuId, accountMenuOpen, menuOpen]);

  useEffect(() => {
    if (!accountMenuOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (accountMenuRef.current?.contains(event.target as Node)) return;
      setAccountMenuOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [accountMenuOpen]);

  function toggleAccountMenu() {
    setAccountMenuOpen((current) => {
      const next = !current;
      if (next) {
        window.dispatchEvent(new CustomEvent("lf-admin-menu-open", { detail: { source: accountMenuId } }));
      }
      return next;
    });
  }

  const workspaceHome = workspaceLabel === "Enterprise Operations" ? "/enterprise" : workspaceLabel === "Platform Probate Review" ? "/admin/probate" : "/admin";
  const sidebar = (
    <aside className="lf-admin-shell-sidebar" aria-label={`${workspaceLabel} navigation`}>
      <Link href={workspaceHome} className="lf-admin-shell-brand" prefetch={false}>
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

  const initials = getInitials(identityLabel);
  const accountIdentity = splitIdentityDetail(identityDetail);
  const closedAccountMeta = accountIdentity.role || accountIdentity.context || "Secure account";

  const accountMenu = (
    <div ref={accountMenuRef} className="lf-admin-shell-account-menu">
      <button
        ref={accountTriggerRef}
        type="button"
        className="lf-admin-shell-account-trigger"
        aria-label={`Open account menu for ${identityLabel}`}
        aria-expanded={accountMenuOpen}
        aria-controls={accountMenuId}
        aria-haspopup="menu"
        onClick={toggleAccountMenu}
      >
        <AccountAvatar label={identityLabel} initials={initials} avatarUrl={identityAvatarUrl} />
        <span className="lf-admin-shell-account-copy">
          <strong>{identityLabel}</strong>
          <small>{closedAccountMeta}</small>
        </span>
        <Icon name="expand_more" size={18} />
      </button>
      {accountMenuOpen ? (
        <div id={accountMenuId} className="lf-admin-shell-account-popover" role="menu" aria-label="Account menu">
          <div className="lf-admin-shell-account-summary">
            <AccountAvatar label={identityLabel} initials={initials} avatarUrl={identityAvatarUrl} />
            <div className="lf-admin-shell-account-summary-copy">
              <strong>{identityLabel}</strong>
              {accountIdentity.email ? <span className="lf-admin-shell-account-email">{accountIdentity.email}</span> : null}
              {accountIdentity.role ? <span className="lf-admin-shell-account-role">{accountIdentity.role}</span> : null}
              {!accountIdentity.email && accountIdentity.context ? <span className="lf-admin-shell-account-role">{accountIdentity.context}</span> : null}
            </div>
          </div>
          <div className="lf-admin-shell-account-menu-section" role="none">
            <Link href="/profile" role="menuitem" onClick={() => setAccountMenuOpen(false)} prefetch={false}>
              <Icon name="account_circle" size={17} />
              <span>Profile</span>
            </Link>
            <Link href="/account/security" role="menuitem" onClick={() => setAccountMenuOpen(false)} prefetch={false}>
              <Icon name="shield_lock" size={17} />
              <span>Account security</span>
            </Link>
          </div>
          <div className="lf-admin-shell-account-menu-section" role="none">
            <button type="button" role="menuitem" className="lf-admin-shell-account-signout" onClick={() => { setAccountMenuOpen(false); onSignOut(); }}>
              <Icon name="logout" size={17} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
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
            <WorkspaceSwitcher currentPathname={currentPathname} compact />
            {accountMenu}
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
  if (hrefPath === "/enterprise") return currentPath === "/enterprise" && !currentQuery;
  return currentPath === hrefPath || currentPath.startsWith(`${hrefPath}/`);
}

function getInitials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "L";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1];
  return `${first}${second ?? "F"}`.toUpperCase();
}

function AccountAvatar({ label, initials, avatarUrl }: { label: string; initials: string; avatarUrl?: string }) {
  const ready = Boolean(avatarUrl);
  return (
    <span
      className="lf-admin-shell-avatar lf-topbar-user-avatar"
      aria-label={`Signed-in account picture for ${label}`}
      role="img"
      data-avatar-ready={ready ? "true" : "false"}
    >
      {ready ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="lf-topbar-user-avatar-img" src={avatarUrl} alt="" aria-hidden="true" />
      ) : null}
      <span className="lf-topbar-user-avatar-fallback">{initials || "LF"}</span>
    </span>
  );
}

function splitIdentityDetail(detail?: string) {
  const raw = String(detail ?? "").trim();
  if (!raw) return { role: "", email: "", context: "" };
  const parts = raw.split("·").map((part) => part.trim()).filter(Boolean);
  const email = parts.find((part) => /@/.test(part)) ?? (/@/.test(raw) ? raw : "");
  const role = parts.find((part) => part !== email && !/@/.test(part)) ?? "";
  return {
    role: role ? toDisplayRole(role) : "",
    email,
    context: !role && !email ? raw : "",
  };
}

function toDisplayRole(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
    overflow-wrap: break-word;
    word-break: normal;
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
    overflow-x: hidden;
  }
  .lf-admin-shell-content section,
  .lf-admin-shell-content article,
  .lf-admin-shell-content div,
  .lf-admin-shell-content dl,
  .lf-admin-shell-content form,
  .lf-admin-shell-content nav {
    max-width: 100%;
  }
  .lf-admin-shell-content h2,
  .lf-admin-shell-content h3,
  .lf-admin-shell-content p,
  .lf-admin-shell-content dd,
  .lf-admin-shell-content dt,
  .lf-admin-shell-content label {
    overflow-wrap: break-word;
    word-break: normal;
  }
  .lf-admin-shell-content td {
    overflow-wrap: break-word;
    word-break: normal;
  }
  .lf-admin-shell-content th {
    overflow-wrap: normal;
    white-space: nowrap;
    word-break: keep-all;
  }
  .lf-admin-shell-content table {
    width: 100%;
    max-width: 100%;
    border-collapse: collapse;
    table-layout: auto;
  }
  .lf-admin-shell-content th,
  .lf-admin-shell-content td {
    padding: 10px;
    vertical-align: top;
  }
  .lf-admin-shell-content input,
  .lf-admin-shell-content select,
  .lf-admin-shell-content textarea {
    appearance: auto;
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    color: #0f172a;
    min-height: 40px;
    padding: 9px 10px;
    width: 100%;
  }
  .lf-admin-shell-content textarea {
    min-height: 96px;
  }
  .lf-admin-shell-content input:focus,
  .lf-admin-shell-content select:focus,
  .lf-admin-shell-content textarea:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, .18);
    outline: none;
  }
  .lf-admin-shell-content input:disabled,
  .lf-admin-shell-content select:disabled,
  .lf-admin-shell-content textarea:disabled {
    background: #f1f5f9;
    color: #64748b;
  }
  .lf-admin-shell-content button,
  .lf-admin-shell-content a {
    overflow-wrap: normal;
    word-break: normal;
  }
  .lf-admin-shell-content input,
  .lf-admin-shell-content select,
  .lf-admin-shell-content textarea,
  .lf-admin-shell-content button {
    max-width: 100%;
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
    overflow-wrap: break-word;
    word-break: normal;
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
  .lf-admin-shell-actions > .lf-workspace-switcher {
    width: min(260px, 100%);
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
  .lf-admin-shell-account-menu {
    position: relative;
    min-width: 0;
  }
  .lf-admin-shell-account-trigger {
    align-items: center;
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    color: #0f172a;
    cursor: pointer;
    display: inline-flex;
    gap: 10px;
    min-height: 46px;
    max-width: 280px;
    padding: 4px 9px 4px 4px;
    text-align: left;
  }
  .lf-admin-shell-account-trigger:focus-visible {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, .18);
    outline: none;
  }
  .lf-admin-shell-avatar {
    align-items: center;
    background: #f8fafc;
    border: 1px solid #d1d5db;
    border-radius: 999px;
    color: #334155;
    display: inline-flex;
    flex: 0 0 auto;
    font-size: 13px;
    font-weight: 800;
    height: 38px;
    justify-content: center;
    overflow: hidden;
    position: relative;
    width: 38px;
  }
  .lf-admin-shell-account-copy {
    display: grid;
    gap: 2px;
    justify-items: start;
    min-width: 0;
  }
  .lf-admin-shell-account-copy strong {
    display: block;
    font-size: 13px;
    font-weight: 800;
    line-height: 1.1;
    max-width: 158px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lf-admin-shell-account-copy small {
    color: #64748b;
    font-size: 11px;
    font-weight: 700;
    line-height: 1.1;
    display: block;
    max-width: 158px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lf-admin-shell-account-popover {
    background: #fff;
    border: 1px solid #dbe3ef;
    border-radius: 12px;
    box-shadow: 0 20px 48px rgba(15, 23, 42, .14);
    display: grid;
    gap: 0;
    padding: 8px;
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    width: min(280px, calc(100vw - 32px));
    z-index: 70;
  }
  .lf-admin-shell-account-summary {
    align-items: center;
    color: #0f172a;
    display: grid;
    gap: 10px;
    grid-template-columns: auto minmax(0, 1fr);
    padding: 8px 8px 12px;
  }
  .lf-admin-shell-account-summary-copy {
    display: grid;
    gap: 3px;
    min-width: 0;
  }
  .lf-admin-shell-account-summary strong,
  .lf-admin-shell-account-email,
  .lf-admin-shell-account-role {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lf-admin-shell-account-summary strong {
    color: #0f172a;
    font-size: 14px;
    font-weight: 850;
    line-height: 1.15;
  }
  .lf-admin-shell-account-email,
  .lf-admin-shell-account-role {
    color: #64748b;
    font-size: 12px;
    line-height: 1.3;
  }
  .lf-admin-shell-account-role {
    color: #475569;
    font-weight: 750;
  }
  .lf-admin-shell-account-menu-section {
    border-top: 1px solid #e2e8f0;
    display: grid;
    gap: 3px;
    padding: 7px 0 0;
  }
  .lf-admin-shell-account-menu-section + .lf-admin-shell-account-menu-section {
    margin-top: 7px;
  }
  .lf-admin-shell-account-popover a,
  .lf-admin-shell-account-popover button {
    align-items: center;
    background: #fff;
    border: 1px solid transparent;
    border-radius: 8px;
    color: #0f172a;
    cursor: pointer;
    display: flex;
    font: inherit;
    font-size: 13px;
    font-weight: 800;
    gap: 8px;
    min-height: 40px;
    padding: 8px 9px;
    text-align: left;
    text-decoration: none;
    width: 100%;
  }
  .lf-admin-shell-account-popover a > span,
  .lf-admin-shell-account-popover button > span {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lf-admin-shell-account-popover a:hover,
  .lf-admin-shell-account-popover a:focus-visible,
  .lf-admin-shell-account-popover button:hover,
  .lf-admin-shell-account-popover button:focus-visible {
    background: #f8fafc;
    border-color: #cbd5e1;
    outline: none;
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
      overflow-x: clip;
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
    .lf-admin-shell-actions > .lf-workspace-switcher,
    .lf-admin-shell-account-menu,
    .lf-admin-shell-account-trigger {
      width: 100%;
      max-width: 100%;
    }
    .lf-admin-shell-account-popover {
      left: 0;
      right: auto;
      width: min(320px, calc(100vw - 32px));
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
    .lf-admin-shell-content table {
      display: block;
      overflow-x: auto;
      white-space: normal;
      -webkit-overflow-scrolling: touch;
    }
    .lf-admin-shell-content th,
    .lf-admin-shell-content td {
      min-width: 128px;
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
