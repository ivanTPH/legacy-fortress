import Link from "next/link";
import AdminPrototypeShell from "@/components/admin/prototype/AdminPrototypeShell";
import AdminStatusBadge from "@/components/admin/prototype/AdminStatusBadge";
import { adminCases, adminUsers, auditEvents } from "@/components/admin/prototype/mockData";
import type { CSSProperties } from "react";

export default function InternalAdminPage() {
  const awaitingReview = adminCases.filter((item) => item.status === "Pending" || item.status === "Under Review").length;
  const unlockPending = adminCases.filter((item) => item.status === "Access Unlock Pending").length;

  return (
    <AdminPrototypeShell
      title="Admin overview"
      description="Static operations prototype for case management, verification review, access control, and audit visibility."
    >
      <section style={metricsGridStyle}>
        <MetricCard label="Open cases" value={String(adminCases.filter((item) => item.status !== "Closed").length)} />
        <MetricCard label="Awaiting review" value={String(awaitingReview)} />
        <MetricCard label="Unlock pending" value={String(unlockPending)} />
        <MetricCard label="Users in review" value={String(adminUsers.filter((item) => item.vaultStatus !== "Active").length)} />
      </section>

      <section style={twoColumnStyle}>
        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <h2 style={h2Style}>Priority cases</h2>
            <Link href="/internal/admin/prototype/cases" style={textLinkStyle}>View all</Link>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {adminCases.slice(0, 3).map((item) => (
              <Link key={item.id} href={`/internal/admin/prototype/cases/${item.id}`} style={rowLinkStyle}>
                <span>
                  <strong>{item.userName}</strong>
                  <span style={mutedBlockStyle}>{item.caseType}</span>
                </span>
                <AdminStatusBadge status={item.status} />
              </Link>
            ))}
          </div>
        </section>

        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <h2 style={h2Style}>Recent audit events</h2>
            <Link href="/internal/admin/prototype/audit" style={textLinkStyle}>Open audit</Link>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {auditEvents.slice(0, 3).map((item) => (
              <div key={item.id} style={auditMiniRowStyle}>
                <span>
                  <strong>{item.action}</strong>
                  <span style={mutedBlockStyle}>{item.actor} · {item.timestamp}</span>
                </span>
                <AdminStatusBadge status={item.result} />
              </div>
            ))}
          </div>
        </section>
      </section>
    </AdminPrototypeShell>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <section style={metricCardStyle}>
      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: "#0f172a", fontSize: 28, fontWeight: 800 }}>{value}</div>
    </section>
  );
}

const metricsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const metricCardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 16,
  display: "grid",
  gap: 6,
};

const twoColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 14,
};

const panelStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 16,
  display: "grid",
  gap: 12,
};

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
};

const h2Style: CSSProperties = {
  margin: 0,
  fontSize: 17,
};

const rowLinkStyle: CSSProperties = {
  textDecoration: "none",
  color: "#0f172a",
  border: "1px solid #f1f5f9",
  borderRadius: 8,
  padding: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const auditMiniRowStyle: CSSProperties = {
  ...rowLinkStyle,
};

const mutedBlockStyle: CSSProperties = {
  display: "block",
  marginTop: 3,
  color: "#64748b",
  fontSize: 13,
  fontWeight: 500,
};

const textLinkStyle: CSSProperties = {
  color: "#334155",
  fontSize: 13,
  fontWeight: 800,
  textDecoration: "none",
};
