import Link from "next/link";
import AdminPrototypeShell from "@/components/admin/prototype/AdminPrototypeShell";
import AdminStatusBadge from "@/components/admin/prototype/AdminStatusBadge";
import { adminCases } from "@/components/admin/prototype/mockData";
import type { CSSProperties, ReactNode } from "react";

export default function AdminCasesPage() {
  return (
    <AdminPrototypeShell
      title="Cases"
      description="Static case management list for verification, support, and controlled access workflows."
    >
      <section style={toolbarStyle}>
        <input aria-label="Search cases" placeholder="Search by user, case ID, or email" style={inputStyle} />
        <select aria-label="Filter by status" style={selectStyle} defaultValue="all">
          <option value="all">All statuses</option>
          <option>Pending</option>
          <option>Under Review</option>
          <option>Access Unlock Pending</option>
          <option>Closed</option>
        </select>
        <select aria-label="Filter by assignee" style={selectStyle} defaultValue="all">
          <option value="all">All assignees</option>
          <option>Assigned to me</option>
          <option>Unassigned</option>
        </select>
      </section>

      <section style={panelStyle}>
        <div style={statusGroupStyle}>
          <span>Pending review: 2</span>
          <span>Under review: 1</span>
          <span>Unlock pending: 1</span>
        </div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th>User</Th>
              <Th>Status</Th>
              <Th>Case type</Th>
              <Th>Last activity</Th>
              <Th>Assigned admin</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {adminCases.map((item) => (
              <tr key={item.id}>
                <Td>
                  <Link href={`/internal/admin/prototype/cases/${item.id}`} style={userLinkStyle}>
                    {item.userName}
                    <span style={mutedBlockStyle}>{item.userEmail}</span>
                  </Link>
                </Td>
                <Td><AdminStatusBadge status={item.status} /></Td>
                <Td>{item.caseType}</Td>
                <Td>{item.lastActivity}</Td>
                <Td>{item.assignedAdmin}</Td>
                <Td><Link href={`/internal/admin/prototype/cases/${item.id}`} style={actionLinkStyle}>Open case</Link></Td>
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

const toolbarStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 12,
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};

const inputStyle: CSSProperties = {
  minWidth: 260,
  flex: 1,
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: "9px 11px",
};

const selectStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: "9px 11px",
  background: "#fff",
};

const panelStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  overflow: "hidden",
};

const statusGroupStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  padding: 12,
  borderBottom: "1px solid #e5e7eb",
  color: "#475569",
  fontSize: 13,
  fontWeight: 700,
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
  verticalAlign: "top",
};

const userLinkStyle: CSSProperties = {
  color: "#0f172a",
  fontWeight: 800,
  textDecoration: "none",
};

const mutedBlockStyle: CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: 12,
  fontWeight: 500,
  marginTop: 2,
};

const actionLinkStyle: CSSProperties = {
  color: "#1f2937",
  fontWeight: 800,
  textDecoration: "none",
};
