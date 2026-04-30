import AdminPrototypeShell from "@/components/admin/prototype/AdminPrototypeShell";
import AdminStatusBadge from "@/components/admin/prototype/AdminStatusBadge";
import { findCase } from "@/components/admin/prototype/mockData";
import type { CSSProperties } from "react";

type AdminCaseDetailPageProps = {
  params: Promise<{ caseId: string }>;
};

export default async function AdminCaseDetailPage({ params }: AdminCaseDetailPageProps) {
  const { caseId } = await params;
  const item = findCase(caseId);

  return (
    <AdminPrototypeShell
      title={item.userName}
      description={`${item.id} · ${item.caseType} · submitted by ${item.submittedBy}`}
    >
      <section style={caseHeaderStyle}>
        <div style={{ display: "grid", gap: 6 }}>
          <AdminStatusBadge status={item.status} />
          <div style={{ color: "#64748b", fontSize: 13 }}>Assigned reviewer: <strong>{item.assignedAdmin}</strong></div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" disabled style={disabledButtonStyle}>Approve</button>
          <button type="button" disabled style={disabledButtonStyle}>Reject</button>
          <button type="button" disabled style={disabledButtonStyle}>Escalate</button>
        </div>
      </section>

      <section style={detailGridStyle}>
        <section style={panelStyle}>
          <h2 style={h2Style}>Evidence preview</h2>
          <div style={documentPreviewStyle}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Death certificate</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#334155" }}>Certificate placeholder</div>
            <div style={{ color: "#64748b", fontSize: 13 }}>Submitted 30 Apr 2026 · PDF · mocked preview</div>
          </div>
          <div style={infoListStyle}>
            <Info label="Vault owner" value={item.userName} />
            <Info label="Requester" value={item.submittedBy} />
            <Info label="Last activity" value={item.lastActivity} />
            <Info label="Priority" value={item.priority} />
          </div>
        </section>

        <section style={panelStyle}>
          <h2 style={h2Style}>Review checklist</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {["Certificate is legible", "Requester identity reviewed", "Relationship confirmed", "Vault owner details match"].map((label, index) => (
              <div key={label} style={checkRowStyle}>
                <span style={checkMarkStyle}>{index < 2 ? "✓" : "—"}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <section style={decisionPanelStyle}>
            <strong>Decision panel</strong>
            <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
              Actions are disabled in this prototype. Future implementation should require decision notes, role checks, and audit logging before any unlock.
            </p>
            <textarea disabled value="Reviewer notes will appear here." style={textareaStyle} readOnly />
          </section>
        </section>
      </section>
    </AdminPrototypeShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ display: "block", color: "#64748b", fontSize: 12, fontWeight: 800 }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const caseHeaderStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const detailGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)",
  gap: 14,
};

const panelStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 16,
  display: "grid",
  gap: 14,
};

const h2Style: CSSProperties = {
  margin: 0,
  fontSize: 17,
};

const documentPreviewStyle: CSSProperties = {
  minHeight: 300,
  border: "1px dashed #cbd5e1",
  borderRadius: 10,
  background: "#f8fafc",
  display: "grid",
  placeContent: "center",
  textAlign: "center",
  gap: 8,
};

const infoListStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
};

const disabledButtonStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  background: "#f3f4f6",
  color: "#6b7280",
  padding: "9px 12px",
  fontWeight: 800,
};

const checkRowStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  border: "1px solid #f1f5f9",
  borderRadius: 8,
  padding: 10,
};

const checkMarkStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 999,
  background: "#f1f5f9",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
};

const decisionPanelStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 12,
  display: "grid",
  gap: 8,
  background: "#fafafa",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 90,
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: 10,
  color: "#64748b",
  resize: "vertical",
};
