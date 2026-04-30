import AdminPrototypeShell from "@/components/admin/prototype/AdminPrototypeShell";
import AdminStatusBadge from "@/components/admin/prototype/AdminStatusBadge";
import { auditEvents } from "@/components/admin/prototype/mockData";
import type { CSSProperties, ReactNode } from "react";

export default function AdminAuditPage() {
  return (
    <AdminPrototypeShell
      title="Audit log"
      description="Static action history showing actor, role, timestamp, target, and result for administrative review."
    >
      <section style={toolbarStyle}>
        <input aria-label="Search audit log" placeholder="Search actor, target, or action" style={inputStyle} />
        <select aria-label="Filter actor role" style={selectStyle} defaultValue="all">
          <option value="all">All roles</option>
          <option>Admin</option>
          <option>Reviewer</option>
          <option>Support</option>
          <option>System</option>
        </select>
        <select aria-label="Filter result" style={selectStyle} defaultValue="all">
          <option value="all">All results</option>
          <option>Success</option>
          <option>Pending</option>
          <option>Rejected</option>
        </select>
      </section>

      <section style={panelStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th>Timestamp</Th>
              <Th>Actor</Th>
              <Th>Action</Th>
              <Th>Target</Th>
              <Th>Result</Th>
            </tr>
          </thead>
          <tbody>
            {auditEvents.map((item) => (
              <tr key={item.id}>
                <Td>{item.timestamp}</Td>
                <Td>
                  <strong>{item.actor}</strong>
                  <span style={mutedBlockStyle}>{item.role}</span>
                </Td>
                <Td>{item.action}</Td>
                <Td>{item.target}</Td>
                <Td><AdminStatusBadge status={item.result} /></Td>
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

const mutedBlockStyle: CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: 12,
  fontWeight: 500,
  marginTop: 2,
};
