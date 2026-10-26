"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import Icon from "../ui/Icon";
import BrandGlyph from "../ui/BrandGlyph";
import FounderTestLauncher from "./FounderTestLauncher";
import {
  extractPlatformRolesFromMetadata,
  normalizePlatformRole,
  type PlatformRole,
} from "../../lib/auth/platformRoles";
import { getMasterAdminRolesForEmail, mergePlatformRoles } from "../../lib/auth/adminRoles";
import {
  getAvailableWorkspaces,
  filterCustomerWorkspaces,
  getCurrentWorkspaceForPath,
  getPrimaryWorkspaceRole,
  type WorkspaceId,
} from "../../lib/workspaces";
import {
  getTestPersona,
  isTestPersonaAccessEnabled,
  TEST_PERSONA_QUERY_PARAM,
  TEST_PERSONA_STORAGE_KEY,
  type TestPersona,
} from "../../lib/testPersonas";
import { supabase } from "../../lib/supabaseClient";
import {
  clearStoredLinkedGrantId,
  selectOwnVault,
  getRoleLabel,
  getLinkedFortressAccessLabel,
  getStoredLinkedGrantId,
  loadLinkedFortressSummaries,
  setStoredLinkedGrantId,
  type LinkedFortressSummary,
} from "../../lib/access-control/viewerAccess";

type WorkspaceSwitcherProps = {
  currentPathname: string;
  adminRole?: PlatformRole | string | null;
  compact?: boolean;
  branded?: boolean;
  mobileContextOnly?: boolean;
  drawerEntry?: boolean;
  showDetails?: boolean;
  governanceContext?: string;
  alwaysShow?: boolean;
  customerOnly?: boolean;
  founderTestLauncherAvailable?: boolean;
  onSelect?: () => void;
};

type WorkspaceSession = {
  userId: string | null;
  displayName: string;
  email: string | null;
  roles: PlatformRole[];
  source: "signed_in_user" | "test_persona" | "query_prototype" | "anonymous";
  persona: TestPersona | null;
  adminFlag: boolean;
  prototypeFlag: boolean;
};

export default function WorkspaceSwitcher({
  currentPathname,
  adminRole = null,
  compact = false,
  branded = false,
  mobileContextOnly = false,
  drawerEntry = false,
  showDetails = false,
  governanceContext = "workspace route guard",
  alwaysShow = false,
  customerOnly = false,
  founderTestLauncherAvailable = false,
  onSelect,
}: WorkspaceSwitcherProps) {
  const [session, setSession] = useState<WorkspaceSession | null>(null);
  const [linkedFortresses, setLinkedFortresses] = useState<LinkedFortressSummary[]>([]);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const focusOnOpenRef = useRef<"first" | "last" | null>(null);
  const menuId = useId();

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      const prototypeEnabled = isTestPersonaAccessEnabled();
      const url = new URL(window.location.href);
      const queryRole = prototypeEnabled ? normalizePlatformRole(url.searchParams.get("role")) : null;
      const urlPersona = prototypeEnabled ? getTestPersona(url.searchParams.get(TEST_PERSONA_QUERY_PARAM)) : null;
      const storedPersona = prototypeEnabled ? getTestPersona(window.localStorage.getItem(TEST_PERSONA_STORAGE_KEY)) : null;
      const persona = urlPersona ?? storedPersona;
      const adminFlag = prototypeEnabled && url.searchParams.get("admin") === "true";
      const prototypeFlag = prototypeEnabled && url.searchParams.get("prototype") === "true";
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;
      const metadataRoles = user
        ? [
            ...extractPlatformRolesFromMetadata(user.app_metadata),
          ]
        : [];
      const adminRoles = user && data.session?.access_token
        ? await loadAdminPermissionRoles(data.session.access_token)
        : [];
      const masterAdminRoles = user ? getMasterAdminRolesForEmail(user.email) : [];
      const signedInRoles = mergePlatformRoles(metadataRoles, adminRoles, masterAdminRoles);
      const roles = signedInRoles.length
        ? signedInRoles
        : persona?.roles.length
          ? persona.roles
          : queryRole && adminFlag && prototypeFlag
            ? [queryRole]
            : [];

      if (!mounted) return;
      setSession({
        userId: user?.id ?? null,
        displayName: String(user?.user_metadata?.full_name ?? user?.email ?? persona?.label ?? "Secure account"),
        email: user?.email ?? null,
        roles,
        source: user ? "signed_in_user" : persona ? "test_persona" : queryRole ? "query_prototype" : "anonymous",
        persona,
        adminFlag,
        prototypeFlag,
      });
      try {
        const linked = await loadLinkedFortressSummaries(supabase, user?.id ?? "");
        if (mounted) setLinkedFortresses(linked);
      } catch {
        if (mounted) setLinkedFortresses([]);
      }
    }

    void refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("lf-test-persona-change", refresh);
    return () => {
      mounted = false;
      window.removeEventListener("storage", refresh);
      window.removeEventListener("lf-test-persona-change", refresh);
    };
  }, []);

  const roleOverride = normalizePlatformRole(String(adminRole ?? ""));
  const effectiveRoles = useMemo(() => {
    if (roleOverride) return [roleOverride];
    return session?.roles ?? [];
  }, [roleOverride, session?.roles]);
  const primaryRole = getPrimaryWorkspaceRole(effectiveRoles);
  const workspaces = useMemo(() => {
    const available = getAvailableWorkspaces(effectiveRoles, { prototype: isTestPersonaAccessEnabled() && session?.source !== "signed_in_user", currentRole: primaryRole, includeDisabled: false });
    return customerOnly ? filterCustomerWorkspaces(available) : available;
  }, [customerOnly, effectiveRoles, primaryRole, session?.source]);
  const currentWorkspace = getCurrentWorkspaceForPath(currentPathname);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspace)
    ?? workspaces.find((workspace) => workspace.id === "application")
    ?? workspaces[0];
  const activeLinkedFortress = (currentPathname.startsWith("/contact-wallet") || currentPathname.startsWith("/linked-fortresses/"))
    ? linkedFortresses.find((linked) => linked.grantId === getStoredLinkedGrantId())
    : null;
  const hasMultipleContexts = workspaces.length > 1;
  const singleCustomerContext = customerOnly && !hasMultipleContexts && linkedFortresses.length === 0;
  const plainCurrentContext = singleCustomerContext && !founderTestLauncherAvailable && !mobileContextOnly;
  const activeRole = activeWorkspace?.roleContext ?? primaryRole;

  useEffect(() => {
    queueMicrotask(() => setOpen(false));
  }, [currentPathname]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if ((event.target as Element).closest?.(".lf-founder-launcher-overlay")) return;
      if (menuRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (document.querySelector(".lf-founder-launcher-overlay")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }

    function onOtherMenuOpen(event: Event) {
      if ((event as CustomEvent).detail?.source === menuId) return;
      setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("lf-admin-menu-open", onOtherMenuOpen);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("lf-admin-menu-open", onOtherMenuOpen);
    };
  }, [menuId, open]);

  useEffect(() => {
    if (!open || !focusOnOpenRef.current) return;
    const links = menuRef.current?.querySelectorAll<HTMLElement>(".lf-workspace-links a, .lf-workspace-links button:not([disabled])");
    const target = focusOnOpenRef.current === "last" ? links?.[links.length - 1] : links?.[0];
    focusOnOpenRef.current = null;
    target?.focus();
  }, [open]);

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    focusOnOpenRef.current = event.key === "ArrowUp" ? "last" : "first";
    if (!open) toggleOpen();
    else {
      const links = menuRef.current?.querySelectorAll<HTMLElement>(".lf-workspace-links a, .lf-workspace-links button:not([disabled])");
      (focusOnOpenRef.current === "last" ? links?.[links.length - 1] : links?.[0])?.focus();
      focusOnOpenRef.current = null;
    }
  }

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Tab") {
      const links = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("a, button:not([disabled])"));
      if (!links.length) return;
      if (event.shiftKey && document.activeElement === links[0]) {
        event.preventDefault();
        links[links.length - 1]?.focus();
      } else if (!event.shiftKey && document.activeElement === links[links.length - 1]) {
        event.preventDefault();
        links[0]?.focus();
      }
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const links = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("a, button:not([disabled])"));
    if (!links.length) return;
    event.preventDefault();
    const currentIndex = links.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1
      : event.key === "ArrowDown" ? (currentIndex + 1) % links.length
      : (currentIndex - 1 + links.length) % links.length;
    links[nextIndex]?.focus();
  }

  function toggleOpen() {
    setOpen((current) => {
      const next = !current;
      if (next) {
        window.dispatchEvent(new CustomEvent("lf-admin-menu-open", { detail: { source: menuId } }));
      }
      return next;
    });
  }

  function closeAfterSelection() {
    setOpen(false);
    onSelect?.();
  }

  function openOwnVault(event: ReactMouseEvent<HTMLAnchorElement>, href: string) {
    if (!session?.userId) {
      clearStoredLinkedGrantId();
      closeAfterSelection();
      return;
    }
    event.preventDefault();
    selectOwnVault(session.userId);
    closeAfterSelection();
    window.location.assign(href);
  }

  if ((!session && !alwaysShow) || (session && !hasMultipleContexts && linkedFortresses.length === 0 && !alwaysShow)) return null;

  const currentContent = <>
    {mobileContextOnly ? null : branded ? <BrandGlyph /> : <span className="lf-workspace-icon" aria-hidden="true"><Icon name={iconForWorkspace(activeWorkspace?.id ?? "application")} size={16} /></span>}
    <span className="lf-workspace-current-copy">
      {mobileContextOnly ? null : branded ? <span className="lf-workspace-brand-name">Legacy Fortress</span>
        : <span className="lf-workspace-label">{activeLinkedFortress ? "Linked Fortress" : "Workspace"}</span>}
      <strong>{drawerEntry ? "Switch" : activeLinkedFortress?.ownerName ?? (customerOnly && activeWorkspace?.id === "application" ? "My Vault" : activeWorkspace?.label) ?? "Personal Vault"}</strong>
    </span>
  </>;

  return (
    <section
      ref={menuRef}
      className={["lf-workspace-switcher", compact && "compact", branded && "branded", mobileContextOnly && "mobile-context-only", drawerEntry && "drawer-entry"].filter(Boolean).join(" ")}
      aria-label={plainCurrentContext ? "Current Vault" : founderTestLauncherAvailable ? "Vault contexts and TEST interfaces" : "Switch Vault"}
    >
      <div className="lf-workspace-menu">
        {plainCurrentContext ? <div className="lf-workspace-current lf-workspace-current-label" aria-label="My Vault">{currentContent}</div> : <button
          ref={triggerRef}
          type="button"
          className="lf-workspace-current"
          aria-label={founderTestLauncherAvailable ? `Open Vault contexts and TEST interfaces, current ${activeLinkedFortress?.ownerName ?? "My Vault"}` : `Switch Vault, current ${activeLinkedFortress?.ownerName ?? activeWorkspace?.label ?? "Personal Vault"}`}
          aria-expanded={open}
          aria-controls={menuId}
          aria-busy={!session}
          disabled={!session}
          onClick={toggleOpen}
          onKeyDown={onTriggerKeyDown}
        >
          {currentContent}
          <Icon name={branded ? "unfold_more" : "expand_more"} size={18} />
        </button>}
        {open && session ? (
          <><button type="button" tabIndex={-1} className="lf-workspace-scrim" aria-label="Close workspace menu" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} />
          <nav id={menuId} className="lf-workspace-links" aria-label="Available workspaces" onKeyDown={onMenuKeyDown}>
            {mobileContextOnly ? <div className="lf-workspace-mobile-back"><button type="button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}><Icon name="chevron_left" size={20} /> {drawerEntry ? "Menu" : "My Vault"}</button></div> : null}
            <div className="lf-workspace-menu-heading">
              <span>{customerOnly ? "Switch Vault" : "Switch context"}</span>
              <small>{customerOnly ? `${linkedFortresses.length} linked` : `${workspaces.length + linkedFortresses.length} available`}</small>
            </div>
            {!customerOnly ? <div className="lf-workspace-session-summary">
              <span>Signed in as <strong>{session.displayName}</strong></span>
              <span>Role: <strong>{formatRole(activeRole)}</strong></span>
            </div> : null}
            {customerOnly ? <div className="lf-workspace-linked-group">
              <div className="lf-workspace-menu-heading"><span>Your Vault</span></div>
              {workspaces.some((workspace) => workspace.id === "application") ? <Link href="/dashboard" className={!activeLinkedFortress ? "is-active" : ""} aria-current={!activeLinkedFortress ? "page" : undefined} onClick={(event) => openOwnVault(event, "/dashboard")}>
                <Icon name="home" size={20} />
                <span><strong>My Vault</strong><small>Owner</small></span>
                {!activeLinkedFortress ? <Icon name="check_circle" size={20} /> : null}
              </Link> : null}
              {linkedFortresses.length ? <div className="lf-workspace-menu-heading"><span>Fortresses you&apos;re linked to</span></div> : null}
              {linkedFortresses.map((linked) => (
                <Link key={linked.grantId} href={`/contact-wallet?grant=${encodeURIComponent(linked.grantId)}`} className={activeLinkedFortress?.grantId === linked.grantId ? "is-active" : ""} aria-current={activeLinkedFortress?.grantId === linked.grantId ? "page" : undefined} onClick={() => { setStoredLinkedGrantId(linked.grantId); closeAfterSelection(); }}>
                  <Icon name={linked.accessState === "estate_locked" ? "lock" : "verified_user"} size={20} />
                  <span><strong>{linked.ownerName}&apos;s Fortress</strong><small>{getRoleLabel(linked.role)} · {getLinkedFortressAccessLabel(linked)}</small></span>
                  {activeLinkedFortress?.grantId === linked.grantId ? <Icon name="check_circle" size={20} /> : null}
                </Link>
              ))}
              <p className="lf-workspace-customer-note">Linked Vault access is separate from Admin and Partner sign-ins.</p>
            </div> : workspaces.map((workspace) => (
              <Link
                key={workspace.id}
                href={workspace.href}
                className={workspace.id === currentWorkspace ? "is-active" : ""}
                aria-current={workspace.id === currentWorkspace ? "page" : undefined}
                onClick={(event) => workspace.id === "application" ? openOwnVault(event, workspace.href) : closeAfterSelection()}
              >
                <Icon name={iconForWorkspace(workspace.id)} size={15} />
                <span>
                  <strong>{workspace.label}</strong>
                  <small>{workspace.description}</small>
                </span>
                <span className="lf-workspace-route-meta">{workspace.shortLabel}</span>
              </Link>
            ))}
            {!customerOnly && linkedFortresses.length ? (
              <div className="lf-workspace-linked-group">
                <div className="lf-workspace-menu-heading"><span>Linked Fortresses</span></div>
                <Link href="/dashboard" onClick={(event) => openOwnVault(event, "/dashboard")}>
                  <Icon name="home" size={15} />
                  <span><strong>My Fortress</strong><small>My Personal Vault</small></span>
                </Link>
                {linkedFortresses.map((linked) => (
                  <Link
                    key={linked.grantId}
                    href={`/contact-wallet?grant=${encodeURIComponent(linked.grantId)}`}
                    onClick={() => { setStoredLinkedGrantId(linked.grantId); closeAfterSelection(); }}
                  >
                    <Icon name="verified_user" size={15} />
                    <span><strong>{linked.ownerName}</strong><small>{getRoleLabel(linked.role)} · {getLinkedFortressAccessLabel(linked)}</small></span>
                  </Link>
                ))}
              </div>
            ) : null}
            {founderTestLauncherAvailable ? <div className="lf-workspace-test-group" aria-label="TEST interfaces">
              <strong>TEST interfaces</strong>
              <FounderTestLauncher current="vault" available />
            </div> : null}
          </nav></>
        ) : null}
      </div>
      {showDetails && session ? (
        <details className="lf-workspace-details">
          <summary>Prototype session</summary>
          <dl>
            <div><dt>Identity</dt><dd>{session.displayName}</dd></div>
            <div><dt>Email</dt><dd>{session.email ?? "Not signed in"}</dd></div>
            <div><dt>Roles</dt><dd>{effectiveRoles.join(", ") || "consumer_user / anonymous"}</dd></div>
            <div><dt>Source</dt><dd>{formatSource(session.source)}</dd></div>
            <div><dt>Flags</dt><dd>admin={session.adminFlag ? "true" : "false"} · prototype={session.prototypeFlag ? "true" : "false"}</dd></div>
            <div><dt>Governance</dt><dd>{governanceContext}</dd></div>
            <div><dt>Restricted actions</dt><dd>Exports, campaigns, billing, and production admin bypasses remain disabled.</dd></div>
          </dl>
          {isTestPersonaAccessEnabled() ? <Link href="/internal/test-login">Switch role preview</Link> : null}
        </details>
      ) : null}
    </section>
  );
}

function iconForWorkspace(workspace: WorkspaceId) {
  if (workspace === "super_admin") return "admin_panel_settings";
  if (workspace === "enterprise_admin") return "corporate_fare";
  if (workspace === "probate_admin") return "shield_lock";
  if (workspace === "contact_wallet") return "verified_user";
  return "apps";
}

function formatSource(source: WorkspaceSession["source"]) {
  if (source === "signed_in_user") return "Signed-in user metadata";
  if (source === "test_persona") return "Prototype persona";
  if (source === "query_prototype") return "Local prototype query context";
  return "Anonymous";
}

function formatRole(role: PlatformRole | null) {
  if (!role) return "Personal Vault user";
  return role.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function loadAdminPermissionRoles(token: string): Promise<PlatformRole[]> {
  const response = await fetch("/api/internal/admin/session", {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return [];
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    admin?: { isMasterAdmin?: boolean; role?: string; capabilities?: string[] };
  } | null;
  if (!payload?.ok || !payload.admin) return [];
  const roles: PlatformRole[] = [];
  if (payload.admin.isMasterAdmin) roles.push("super_admin");
  if (payload.admin.role === "enterprise_admin" || payload.admin.capabilities?.some((capability) => ["organisation:manage", "enterprise.workspace.access", "enterprise_dashboard", "enterprise_reports"].includes(capability))) {
    roles.push("enterprise_admin");
  }
  if (payload.admin.role === "probate_reviewer" || payload.admin.role === "verification_reviewer" || payload.admin.capabilities?.includes("probate_operations")) roles.push("probate_admin");
  return [...new Set(roles)];
}
