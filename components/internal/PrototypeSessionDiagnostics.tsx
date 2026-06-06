"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { extractPlatformRolesFromMetadata, getDefaultLandingForRoles, normalizePlatformRole, type PlatformRole } from "../../lib/auth/platformRoles";
import {
  getPrototypeDashboardLinks,
  getTestPersona,
  isTestPersonaAccessEnabled,
  TEST_PERSONA_QUERY_PARAM,
  TEST_PERSONA_STORAGE_KEY,
  type TestPersona,
} from "../../lib/testPersonas";
import { supabase } from "../../lib/supabaseClient";

type PrototypeSessionDiagnosticsProps = {
  compact?: boolean;
  adminRole?: string | null;
  governanceContext?: string;
};

type SessionState = {
  email: string | null;
  userName: string;
  roles: PlatformRole[];
  source: "signed_in_user" | "test_persona" | "query_prototype" | "anonymous";
  persona: TestPersona | null;
  adminFlag: boolean;
  prototypeFlag: boolean;
  queryRole: PlatformRole | null;
};

export default function PrototypeSessionDiagnostics({
  compact = false,
  adminRole = null,
  governanceContext = "consumer/prototype route",
}: PrototypeSessionDiagnosticsProps) {
  const [session, setSession] = useState<SessionState | null>(null);

  useEffect(() => {
    if (!isTestPersonaAccessEnabled()) return;

    let mounted = true;
    async function refresh() {
      const url = new URL(window.location.href);
      const urlPersona = getTestPersona(url.searchParams.get(TEST_PERSONA_QUERY_PARAM));
      const storedPersona = getTestPersona(window.localStorage.getItem(TEST_PERSONA_STORAGE_KEY));
      const persona = urlPersona ?? storedPersona;
      const queryRole = normalizePlatformRole(url.searchParams.get("role"));
      const adminFlag = url.searchParams.get("admin") === "true";
      const prototypeFlag = url.searchParams.get("prototype") === "true";
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;
      const metadataRoles = user
        ? [
            ...extractPlatformRolesFromMetadata(user.app_metadata),
            ...extractPlatformRolesFromMetadata(user.user_metadata),
          ]
        : [];
      const roles = metadataRoles.length > 0
        ? metadataRoles
        : persona?.roles.length
          ? persona.roles
          : queryRole && adminFlag && prototypeFlag
            ? [queryRole]
            : [];

      if (!mounted) return;
      setSession({
        email: user?.email ?? null,
        userName: String(user?.user_metadata?.full_name ?? user?.email ?? persona?.label ?? "Not signed in"),
        roles,
        source: user ? "signed_in_user" : persona ? "test_persona" : queryRole ? "query_prototype" : "anonymous",
        persona,
        adminFlag,
        prototypeFlag,
        queryRole,
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

  const effectiveRoles = useMemo(() => {
    if (adminRole) {
      const normalized = normalizePlatformRole(adminRole);
      if (normalized) return [normalized];
    }
    return session?.roles ?? [];
  }, [adminRole, session?.roles]);
  const dashboardLinks = useMemo(() => getPrototypeDashboardLinks(effectiveRoles), [effectiveRoles]);
  const resolvedRoute = effectiveRoles.length > 0 ? getDefaultLandingForRoles(effectiveRoles) : "/dashboard";
  const superAdminActive = effectiveRoles.includes("super_admin");
  const namedIvyNotice = session?.email?.toLowerCase().includes("ivanyardley")
    ? superAdminActive
      ? "ivanyardley is currently in a super_admin context."
      : "ivanyardley is not super_admin in this session unless a trusted role or Super admin test persona is active."
    : null;

  if (!isTestPersonaAccessEnabled() || !session) return null;

  return (
    <section style={compact ? compactPanelStyle : panelStyle} aria-label="Prototype session diagnostics">
      <div style={headingRowStyle}>
        <div>
          <span style={badgeStyle}>Prototype session diagnostics</span>
          <h2 style={titleStyle}>Current access context</h2>
        </div>
        <Link href="/internal/test-login" style={switchLinkStyle}>Switch role</Link>
      </div>
      <div style={metaGridStyle}>
        <Diagnostic label="User/persona" value={session.userName} />
        <Diagnostic label="Email" value={session.email ?? "Not signed in"} />
        <Diagnostic label="Active role" value={effectiveRoles[0] ?? "consumer_user / anonymous"} />
        <Diagnostic label="All roles" value={effectiveRoles.join(", ") || "No admin roles assigned"} />
        <Diagnostic label="Admin/prototype flags" value={`admin=${session.adminFlag ? "true" : "false"} · prototype=${session.prototypeFlag ? "true" : "false"}`} />
        <Diagnostic label="Resolved dashboard route" value={resolvedRoute} />
        <Diagnostic label="Super admin access" value={superAdminActive ? "Active" : "Not active"} />
        <Diagnostic label="Auth source" value={session.source === "signed_in_user" ? "Signed-in user metadata" : session.source === "test_persona" ? "Prototype/mock persona" : session.source === "query_prototype" ? "Local prototype query context" : "Anonymous"} />
        <Diagnostic label="Governance context" value={governanceContext} />
        <Diagnostic label="Restricted/export status" value="Exports, campaigns, billing, and production admin bypasses remain disabled." />
      </div>
      {namedIvyNotice ? <p style={noticeStyle}>{namedIvyNotice}</p> : null}
      <div style={buttonGridStyle} aria-label="Role-aware dashboard routes">
        {dashboardLinks.map((link) => link.enabled ? (
          <Link key={link.id} href={link.href} style={enabledButtonStyle}>{link.label}</Link>
        ) : (
          <button key={link.id} type="button" disabled title={`Requires ${link.requiredRole}`} style={disabledButtonStyle}>
            {link.label}
            <span style={buttonHintStyle}>Requires {link.requiredRole}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Diagnostic({ label, value }: { label: string; value: string }) {
  return (
    <div style={diagnosticStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const panelStyle = {
  border: "1px solid var(--lf-border)",
  borderRadius: 12,
  background: "var(--lf-surface)",
  padding: 16,
  display: "grid",
  gap: 14,
  boxShadow: "0 12px 34px rgba(31, 23, 18, 0.05)",
} as const;

const compactPanelStyle = {
  ...panelStyle,
  padding: 12,
  boxShadow: "none",
} as const;

const headingRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "start",
  flexWrap: "wrap",
} as const;

const badgeStyle = {
  display: "inline-flex",
  width: "fit-content",
  border: "1px solid var(--lf-border)",
  borderRadius: 999,
  padding: "4px 9px",
  color: "var(--lf-text-soft)",
  background: "var(--lf-surface-muted)",
  fontSize: 12,
  fontWeight: 800,
} as const;

const titleStyle = {
  margin: "6px 0 0",
  fontSize: 18,
} as const;

const switchLinkStyle = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  minHeight: 36,
  padding: "0 12px",
  display: "inline-flex",
  alignItems: "center",
  color: "var(--lf-text)",
  textDecoration: "none",
  fontWeight: 800,
  fontSize: 13,
} as const;

const metaGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 8,
} as const;

const diagnosticStyle = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: 10,
  background: "#fffefd",
  display: "grid",
  gap: 4,
  fontSize: 12,
  color: "var(--lf-text-soft)",
} as const;

const noticeStyle = {
  margin: 0,
  color: "var(--lf-text)",
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: 8,
  padding: 10,
  fontSize: 13,
  lineHeight: 1.45,
} as const;

const buttonGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 8,
} as const;

const enabledButtonStyle = {
  border: "1px solid var(--lf-bronze-strong)",
  borderRadius: 8,
  minHeight: 42,
  padding: "0 12px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  background: "var(--lf-bronze-strong)",
  textDecoration: "none",
  fontWeight: 800,
  fontSize: 13,
} as const;

const disabledButtonStyle = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  minHeight: 42,
  padding: "7px 10px",
  display: "grid",
  placeItems: "center",
  color: "var(--lf-text-soft)",
  background: "var(--lf-surface-muted)",
  fontWeight: 800,
  fontSize: 13,
} as const;

const buttonHintStyle = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
} as const;
