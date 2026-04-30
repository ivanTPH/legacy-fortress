import Link from "next/link";
import AdminPrototypeShell from "@/components/admin/prototype/AdminPrototypeShell";
import AdminStatusBadge from "@/components/admin/prototype/AdminStatusBadge";
import { adminUsers } from "@/components/admin/prototype/mockData";
import type { CSSProperties, ReactNode } from "react";

export default function AdminUsersPage() {
  return (
    <AdminPrototypeShell
      title="Users"
      description="Read-only mock user directory for operational review. This prototype does not use real user data."
    >
      <section style={toolbarStyle}>
        <input aria-label="Search users" placeholder="Search name, email, or user ID" style={inputStyle} />
        <select aria-label="Vault status" style={selectStyle} defaultValue="all">
          <option value="all">All vault statuses</option>
          <option>Active</option>
          <option>Pending</option>
          <option>Under Review</option>
        </select>
      </section>

      <section style={panelStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th>User</Th>
              <Th>Vault status</Th>
              <Th>Plan</Th>
              <Th>Records</Th>
              <Th>Documents</Th>
              <Th>Last login</Th>
            </tr>
          </thead>
          <tbody>
            {adminUsers.map((item) => (
              <tr key={item.id}>
                <Td>
                  <Link href={`/internal/admin/prototype/users/${item.id}`} style={userLinkStyle}>
                    {item.name}
                    <span style={mutedBlockStyle}>{item.email}</span>
                  </Link>
                </Td>
                <Td><AdminStatusBadge status={item.vaultStatus} /></Td>
                <Td>{item.plan}</Td>
                <Td>{item.records}</Td>
                <Td>{item.documents}</Td>
                <Td>{item.lastLogin}</Td>
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
