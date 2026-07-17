"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Icon from "../ui/Icon";
import {
  extractPlatformRolesFromMetadata,
  normalizePlatformRole,
  type PlatformRole,
} from "../../lib/auth/platformRoles";
import { getMasterAdminRolesForEmail, mergePlatformRoles } from "../../lib/auth/adminRoles";
import {
  getAvailableWorkspaces,
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

type WorkspaceSwitcherProps = {
  currentPathname: string;
  adminRole?: PlatformRole | string | null;
  compact?: boolean;
  showDetails?: boolean;
  governanceContext?: string;
  alwaysShow?: boolean;
};

type WorkspaceSession = {
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
  showDetails = false,
  governanceContext = "workspace route guard",
  alwaysShow = false,
}: WorkspaceSwitcherProps) {
  const [session, setSession] = useState<WorkspaceSession | null>(null);

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
            ...extractPlatformRolesFromMetadata(user.user_metadata),
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
        displayName: String(user?.user_metadata?.full_name ?? user?.email ?? persona?.label ?? "Secure account"),
        email: user?.email ?? null,
        roles,
        source: user ? "signed_in_user" : persona ? "test_persona" : queryRole ? "query_prototype" : "anonymous",
        persona,
        adminFlag,
        prototypeFlag,
      });
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
  const workspaces = useMemo(
    () => getAvailableWorkspaces(effectiveRoles, { prototype: isTestPersonaAccessEnabled(), currentRole: primaryRole, includeDisabled: false }),
    [effectiveRoles, primaryRole],
  );
  const currentWorkspace = getCurrentWorkspaceForPath(currentPathname);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspace)
    ?? workspaces.find((workspace) => workspace.id === "application")
    ?? workspaces[0];
  const hasMultipleContexts = workspaces.length > 1;

  if (!session || (!hasMultipleContexts && !alwaysShow)) return null;

  return (
    <section className={compact ? "lf-workspace-switcher compact" : "lf-workspace-switcher"} aria-label="Workspace switcher">
      <details className="lf-workspace-menu">
        <summary className="lf-workspace-current">
          <span className="lf-workspace-icon" aria-hidden="true">
            <Icon name={iconForWorkspace(activeWorkspace?.id ?? "application")} size={16} />
          </span>
          <span className="lf-workspace-current-copy">
            <span className="lf-workspace-label">Workspace</span>
            <strong>{activeWorkspace?.label ?? "Personal Vault"}</strong>
          </span>
          <Icon name="expand_more" size={18} />
        </summary>
        <nav className="lf-workspace-links" aria-label="Available workspaces">
          <div className="lf-workspace-menu-heading">
            <span>Switch workspace</span>
            <small>{workspaces.length} available</small>
          </div>
          {workspaces.map((workspace) => (
            <Link
              key={workspace.id}
              href={workspace.href}
              className={workspace.id === currentWorkspace ? "is-active" : ""}
              aria-current={workspace.id === currentWorkspace ? "page" : undefined}
            >
              <Icon name={iconForWorkspace(workspace.id)} size={15} />
              <span>
                <strong>{workspace.label}</strong>
                <small>{workspace.description}</small>
              </span>
              <span className="lf-workspace-route-meta">{workspace.shortLabel}</span>
            </Link>
          ))}
        </nav>
      </details>
      {showDetails ? (
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

async function loadAdminPermissionRoles(token: string): Promise<PlatformRole[]> {
  const response = await fetch("/api/internal/admin/session", {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return [];
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    admin?: { isMasterAdmin?: boolean };
  } | null;
  if (!payload?.ok || !payload.admin) return [];
  return payload.admin.isMasterAdmin ? ["super_admin"] : ["enterprise_admin"];
}
