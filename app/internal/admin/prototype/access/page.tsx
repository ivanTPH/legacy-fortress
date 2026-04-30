import AdminPrototypeShell from "@/components/admin/prototype/AdminPrototypeShell";
import AdminStatusBadge from "@/components/admin/prototype/AdminStatusBadge";
import type { CSSProperties, ReactNode } from "react";

const accessRows = [
  { name: "Thomas Ellis", role: "Executor", status: "Pending" as const, scope: "Verification review" },
  { name: "Helen Haines", role: "Trusted contact", status: "Active" as const, scope: "Read-only shared sections" },
  { name: "Anika Shah", role: "Executor", status: "Access Unlock Pending" as const, scope: "Approved post-verification access" },
  { name: "Mark Bennett", role: "Advisor", status: "Rejected" as const, scope: "Revoked legal access" },
];

export default function AdminAccessPage() {
  return (
    <AdminPrototypeShell
      title="Access control"
      description="Static control panel showing who can access a vault, their role, and pending administrative decisions."
    >
      <section style={panelStyle}>
        <div style={noticeStyle}>
          Actions are disabled in this prototype. Future access changes should require role checks, confirmation, reason capture, and audit logging.
        </div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th>Person</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Scope</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {accessRows.map((row) => (
              <tr key={row.name}>
                <Td><strong>{row.name}</strong></Td>
                <Td>{row.role}</Td>
                <Td><AdminStatusBadge status={row.status} /></Td>
                <Td>{row.scope}</Td>
                <Td><button type="button" disabled style={disabledButtonStyle}>Review</button></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AdminPrototypeShell>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th style={thStyle}>{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td style={tdStyle}>{children}</td>;
}

const panelStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  overflow: "hidden",
};

const noticeStyle: CSSProperties = {
  padding: 12,
  borderBottom: "1px solid #e5e7eb",
  color: "#475569",
  background: "#f8fafc",
  fontSize: 13,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "11px 12px",
  borderBottom: "1px solid #e5e7eb",
  color: "#64748b",
  fontSize: 12,
  textTransform: "uppercase",
};

const tdStyle: CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #f1f5f9",
};

const disabledButtonStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  background: "#f3f4f6",
  color: "#6b7280",
  padding: "7px 10px",
  fontWeight: 800,
};
