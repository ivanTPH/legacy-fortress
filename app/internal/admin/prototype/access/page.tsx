import AdminPrototypeShell from "@/components/admin/prototype/AdminPrototypeShell";
import AdminStatusBadge from "@/components/admin/prototype/AdminStatusBadge";
import { PlatformNotice } from "@/components/ui/PlatformPrimitives";
import type { CSSProperties, ReactNode } from "react";

const accessRows = [
  { name: "Thomas Ellis", role: "Executor", status: "Pending" as const, scope: "Death certificate submitted; identity and relationship still under review", decision: "Validate evidence" },
  { name: "Helen Haines", role: "Trusted contact", status: "Active" as const, scope: "Owner-invited read-only sections; managed by account owner", decision: "Owner managed" },
  { name: "Anika Shah", role: "Executor", status: "Access Unlock Pending" as const, scope: "Certificate verified; unlock requires final confirmation and audit event", decision: "Confirm unlock" },
  { name: "Mark Bennett", role: "Advisor", status: "Rejected" as const, scope: "Legal/probate access rejected; no vault edit rights granted", decision: "Rejected" },
];

export default function AdminAccessPage() {
  return (
    <AdminPrototypeShell
      title="Access control"
      description="Static control panel separating owner-invited vault access from death-certificate probate unlock decisions."
    >
      <section style={flowGridStyle} aria-label="Access governance flow">
        <section style={flowCardStyle}>
          <strong>1. Owner invitation</strong>
          <span>The individual account owner invites executors, trusted contacts, family viewers, or sub-admins into their own vault.</span>
        </section>
        <section style={flowCardStyle}>
          <strong>2. Death certificate submission</strong>
          <span>Probate access starts only when evidence is submitted and attached to a review case.</span>
        </section>
        <section style={flowCardStyle}>
          <strong>3. Validation and unlock</strong>
          <span>Admins validate evidence, confirm relationship, then grant limited read-only executor access with audit capture.</span>
        </section>
      </section>

      <section style={panelStyle}>
        <PlatformNotice icon="admin_panel_settings">
          Admins can review and validate access requests, but they cannot directly edit an individual vault. Unlock decisions require certificate validation, confirmation, reason capture, and audit logging.
        </PlatformNotice>
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th>Person</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Scope</Th>
              <Th>Decision path</Th>
            </tr>
          </thead>
          <tbody>
            {accessRows.map((row) => (
              <tr key={row.name}>
                <Td><strong>{row.name}</strong></Td>
                <Td>{row.role}</Td>
                <Td><AdminStatusBadge status={row.status} /></Td>
                <Td>{row.scope}</Td>
                <Td><button type="button" disabled style={disabledButtonStyle}>{row.decision}</button></Td>
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
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  overflow: "hidden",
};

const flowGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const flowCardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: 12,
  display: "grid",
  gap: 6,
  color: "var(--lf-text)",
  fontSize: 13,
  lineHeight: 1.45,
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
};

const tdStyle: CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #f1ece8",
};

const disabledButtonStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  background: "var(--lf-surface-muted)",
  color: "var(--lf-text-soft)",
  padding: "7px 10px",
  fontWeight: 800,
};
