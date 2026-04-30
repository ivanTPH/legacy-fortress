import Link from "next/link";
import AdminPrototypeShell from "@/components/admin/prototype/AdminPrototypeShell";
import AdminStatusBadge from "@/components/admin/prototype/AdminStatusBadge";
import { adminCases } from "@/components/admin/prototype/mockData";
import type { CSSProperties } from "react";

export default function AdminVerificationsPage() {
  const groups = [
    { title: "Pending evidence review", rows: adminCases.filter((item) => item.status === "Pending") },
    { title: "Under review", rows: adminCases.filter((item) => item.status === "Under Review") },
    { title: "Approved, unlock pending", rows: adminCases.filter((item) => item.status === "Access Unlock Pending") },
  ];

  return (
    <AdminPrototypeShell
      title="Verification queue"
      description="Static workflow view for death certificate review, evidence checks, and access unlock readiness."
    >
      <section style={workflowStyle}>
        <span>Executor submits certificate</span>
        <span>→</span>
        <span>Reviewer checks evidence</span>
        <span>→</span>
        <span>Approve / reject</span>
        <span>→</span>
        <span>Access unlock queued</span>
      </section>

      <section style={{ display: "grid", gap: 14 }}>
        {groups.map((group) => (
          <section key={group.title} style={panelStyle}>
            <div style={panelHeaderStyle}>
              <h2 style={h2Style}>{group.title}</h2>
              <span style={countStyle}>{group.rows.length}</span>
            </div>
            {group.rows.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {group.rows.map((item) => (
                  <Link key={item.id} href={`/internal/admin/prototype/cases/${item.id}`} style={queueCardStyle}>
                    <span>
                      <strong>{item.userName}</strong>
                      <span style={mutedBlockStyle}>{item.caseType} · submitted by {item.submittedBy}</span>
                    </span>
                    <AdminStatusBadge status={item.status} />
                  </Link>
                ))}
              </div>
            ) : (
              <div style={emptyStyle}>No cases in this group.</div>
            )}
          </section>
        ))}
      </section>
    </AdminPrototypeShell>
  );
}

const workflowStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 14,
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  color: "#475569",
  fontSize: 13,
  fontWeight: 800,
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
  alignItems: "center",
  gap: 12,
};

const h2Style: CSSProperties = {
  margin: 0,
  fontSize: 17,
};

const countStyle: CSSProperties = {
  borderRadius: 999,
  background: "#f1f5f9",
  color: "#475569",
  padding: "4px 9px",
  fontSize: 12,
  fontWeight: 800,
};

const queueCardStyle: CSSProperties = {
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

const mutedBlockStyle: CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: 13,
  fontWeight: 500,
  marginTop: 3,
};

const emptyStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
};
