"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { waitForActiveUser } from "@/lib/auth/session";

type AdminSessionPayload = {
  ok: boolean;
  admin?: {
    email: string;
    role: string;
    capabilities: string[];
    displayName: string;
  };
  message?: string;
};

type AdminDashboardMetric = {
  key: string;
  label: string;
  value: number | null;
  available: boolean;
  status: "ok" | "warning" | "unavailable";
  definition: string;
  source: string;
  updatedAt: string;
  warning?: string;
};

type AdminDashboardSummary = {
  generatedAt: string;
  environment: "Local" | "Staging" | "Production";
  role: string;
  metrics: AdminDashboardMetric[];
};

type LoadState = "checking" | "ready" | "denied" | "error";

const ROLE_OPTIONS = [
  "super_admin",
  "support_agent",
  "probate_reviewer",
  "auditor",
  "enterprise_admin",
  "standard_user",
  "revoked_admin",
];

export default function AdminDashboardWorkspace() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>("checking");
  const [message, setMessage] = useState("");
  const [admin, setAdmin] = useState<AdminSessionPayload["admin"] | null>(null);
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [roleOverride, setRoleOverride] = useState("super_admin");
  const [working, setWorking] = useState(false);

  const authFetch = useCallback(async (input: string, init?: RequestInit) => {
    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data.session?.access_token ?? "";
    const headers = new Headers(init?.headers ?? {});
    if (token) headers.set("authorization", `Bearer ${token}`);
    if (!headers.has("content-type") && init?.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
    return fetch(input, { ...init, headers });
  }, []);

  const loadDashboard = useCallback(async () => {
    setState("checking");
    setMessage("");
    const user = await waitForActiveUser(supabase, { attempts: 4, delayMs: 120 });
    if (!user) {
      router.replace(`/sign-in?next=${encodeURIComponent("/admin")}`);
      return;
    }

    const [sessionRes, summaryRes] = await Promise.all([
      authFetch("/api/internal/admin/session"),
      authFetch("/api/internal/admin/dashboard-summary"),
    ]);

    const sessionJson = (await sessionRes.json().catch(() => ({}))) as AdminSessionPayload;
    const summaryJson = (await summaryRes.json().catch(() => ({}))) as { ok?: boolean; summary?: AdminDashboardSummary; message?: string };

    if (sessionRes.status === 401 || summaryRes.status === 401) {
      router.replace(`/sign-in?next=${encodeURIComponent("/admin")}`);
      return;
    }
    if (sessionRes.status === 403 || summaryRes.status === 403 || !sessionJson.ok || !sessionJson.admin) {
      router.replace("/admin/access-denied");
      return;
    }
    if (!summaryRes.ok || !summaryJson.ok || !summaryJson.summary) {
      setState("error");
      setAdmin(sessionJson.admin);
      setMessage(summaryJson.message || "The admin dashboard summary is unavailable.");
      return;
    }

    setAdmin(sessionJson.admin);
    setSummary(summaryJson.summary);
    setRoleOverride(summaryJson.summary.role);
    setState("ready");
  }, [authFetch, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const canUseRoleHarness = Boolean(admin?.capabilities.includes("admin.roles.test")) && summary?.environment === "Local";
  const lastRefreshed = useMemo(() => summary ? new Date(summary.generatedAt).toLocaleString() : "", [summary]);

  async function setLocalRoleOverride() {
    setWorking(true);
    setMessage("");
    const res = await authFetch("/api/internal/admin/local-role-override", {
      method: "POST",
      body: JSON.stringify({ role: roleOverride }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      setMessage(json.message || "Could not switch local test role.");
      setWorking(false);
      return;
    }
    setWorking(false);
    await loadDashboard();
  }

  async function resetLocalRoleOverride() {
    setWorking(true);
    setMessage("");
    await authFetch("/api/internal/admin/local-role-override", { method: "DELETE" }).catch(() => null);
    setWorking(false);
    await loadDashboard();
  }

  async function signOut() {
    await authFetch("/api/internal/admin/local-role-override", { method: "DELETE" }).catch(() => null);
    await supabase.auth.signOut();
    router.replace("/sign-in");
  }

  if (state === "checking") {
    return (
      <main className="lf-admin-page">
        <section className="lf-admin-panel" aria-live="polite">
          <p className="lf-admin-eyebrow">Legacy Fortress Admin</p>
          <h1>Checking admin access</h1>
          <p>Confirming your signed-in session and server-side role.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="lf-admin-page">
      <header className="lf-admin-header">
        <div>
          <p className="lf-admin-eyebrow">Legacy Fortress Admin / Operations</p>
          <h1>Application command dashboard</h1>
          <p>Privacy-safe operational summary. Customer vault contents, documents, notes and private record details are not shown here.</p>
        </div>
        <div className="lf-admin-header-actions">
          <Link className="lf-admin-secondary-link" href="/dashboard">Return to customer app</Link>
          <button type="button" className="lf-admin-secondary-button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      {admin ? (
        <section className="lf-admin-identity" aria-label="Current admin context">
          <span><strong>{admin.displayName}</strong></span>
          <span>{formatRole(admin.role)}</span>
          <span>{summary?.environment ?? "Unknown"} environment</span>
          <span>Last refreshed {lastRefreshed || "not available"}</span>
        </section>
      ) : null}

      {message ? <div className="lf-admin-alert" role="status">{message}</div> : null}

      {canUseRoleHarness ? (
        <section className="lf-admin-local-harness" aria-label="Local UAT role testing">
          <div>
            <strong>Local UAT role testing</strong>
            <p>Local-only. This temporarily changes the server-resolved role for this browser session and is ignored outside local development.</p>
          </div>
          <div className="lf-admin-filter-row">
            <label>
              Test role
              <select value={roleOverride} onChange={(event) => setRoleOverride(event.target.value)}>
                {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}
              </select>
            </label>
            <button type="button" className="lf-admin-primary-button" onClick={setLocalRoleOverride} disabled={working}>Apply role</button>
            <button type="button" className="lf-admin-secondary-button" onClick={resetLocalRoleOverride} disabled={working}>Reset</button>
          </div>
        </section>
      ) : null}

      {state === "error" ? (
        <section className="lf-admin-panel">
          <h2>Summary unavailable</h2>
          <p>The admin shell loaded, but the aggregate summary could not be generated. This state does not expose private customer data.</p>
          <button type="button" className="lf-admin-primary-button" onClick={loadDashboard}>Retry</button>
        </section>
      ) : null}

      {summary ? (
        <>
          <section className="lf-admin-filter-shell" aria-label="Dashboard filters">
            <label>
              Date range
              <select disabled>
                <option>Last 30 days</option>
              </select>
            </label>
            <label>
              Status
              <select disabled>
                <option>All statuses</option>
              </select>
            </label>
            <label>
              Category
              <select disabled>
                <option>All categories</option>
              </select>
            </label>
            <span>Filter framework only. Disabled until metric-specific filtering is wired server-side.</span>
          </section>

          <section className="lf-admin-grid" aria-label="Operational summary cards">
            {summary.metrics.map((metric) => (
              <article key={metric.key} className={`lf-admin-metric is-${metric.status}`}>
                <div className="lf-admin-metric-header">
                  <h2>{metric.label}</h2>
                  <span>{metric.available ? metric.status : "Unavailable"}</span>
                </div>
                <strong>{metric.available ? metric.value?.toLocaleString() : "Unavailable"}</strong>
                <p>{metric.definition}</p>
                <small>{metric.warning || `Source: ${metric.source}`}</small>
              </article>
            ))}
          </section>

          <section className="lf-admin-panel">
            <h2>Restricted future workspaces</h2>
            <div className="lf-admin-placeholder-grid">
              <AdminPlaceholder title="Probate decisions" text="Future phase. No approve, reject, unlock or revoke action is enabled here." />
              <AdminPlaceholder title="Support actions" text="Future phase. No account restriction, reinstatement or impersonation is enabled here." />
              <AdminPlaceholder title="Enterprise and licences" text="Future phase. Current operational view shows placeholders only unless real schema is approved." />
              <AdminPlaceholder title="Exports" text="Future phase. No CSV, document export or bulk operation is available from this foundation dashboard." />
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

function AdminPlaceholder({ title, text }: { title: string; text: string }) {
  return (
    <div className="lf-admin-placeholder">
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function formatRole(role: string) {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
