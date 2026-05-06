import Link from "next/link";
import AdminPrototypeShell from "@/components/admin/prototype/AdminPrototypeShell";
import AdminStatusBadge from "@/components/admin/prototype/AdminStatusBadge";
import { organisations } from "@/components/admin/prototype/mockData";
import type { CSSProperties, ReactNode } from "react";

export default function OrganisationPrototypePage() {
  return (
    <AdminPrototypeShell
      title="Organisation management"
      description="Static licensing prototype for professional firms, client seats, renewal status, and portfolio-level review signals."
    >
      <section style={noticeStyle}>
        Static prototype — mock data. Sensitive fields are shown as bands only. Only clients linked to an organisation would be visible.
      </section>

      <section style={toolbarStyle}>
        <input aria-label="Search organisations" placeholder="Search organisation, owner, or licence type" style={inputStyle} />
        <select aria-label="Licence status" style={selectStyle} defaultValue="all">
          <option value="all">All statuses</option>
          <option>Active</option>
          <option>Pending</option>
          <option>Review</option>
        </select>
        <select aria-label="Organisation type" style={selectStyle} defaultValue="all">
          <option value="all">All organisation types</option>
          <option>IFA</option>
          <option>Solicitors</option>
          <option>Accountancy</option>
          <option>Enterprise</option>
        </select>
      </section>

      <section style={panelStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th>Organisation</Th>
              <Th>Licence</Th>
              <Th>Seats</Th>
              <Th>Active clients</Th>
              <Th>Pending invites</Th>
              <Th>Renewal</Th>
              <Th>Owner</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {organisations.map((org) => (
              <tr key={org.id}>
                <Td>
                  <Link href={`/internal/admin/prototype/organisations/${org.id}`} style={linkStyle}>
                    {org.name}
                    <span style={mutedBlockStyle}>{org.type} · {org.id}</span>
                  </Link>
                </Td>
                <Td>{org.licenceType}</Td>
                <Td>{org.activeClients}/{org.clientSeats}</Td>
                <Td>{org.activeClients}</Td>
                <Td>{org.pendingInvitations}</Td>
                <Td>{org.renewalDate}</Td>
                <Td>{org.accountOwner}</Td>
                <Td><AdminStatusBadge status={org.status === "Review" ? "Pending" : org.status} /></Td>
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

const noticeStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  background: "var(--lf-surface-muted)",
  color: "var(--lf-bronze)",
  borderRadius: 8,
  padding: 12,
  fontSize: 13,
  fontWeight: 700,
};

const toolbarStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: 12,
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};

const inputStyle: CSSProperties = {
  minWidth: 280,
  flex: 1,
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: "9px 11px",
};

const selectStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: "9px 11px",
  background: "#fff",
};

const panelStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  overflow: "auto",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "11px 12px",
  borderBottom: "1px solid var(--lf-border)",
  color: "var(--lf-text-soft)",
  fontSize: 12,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #f1ece8",
  verticalAlign: "top",
  whiteSpace: "nowrap",
};

const linkStyle: CSSProperties = {
  color: "var(--lf-text)",
  fontWeight: 800,
  textDecoration: "none",
};

const mutedBlockStyle: CSSProperties = {
  display: "block",
  color: "var(--lf-text-soft)",
  fontSize: 12,
  fontWeight: 500,
  marginTop: 2,
};
