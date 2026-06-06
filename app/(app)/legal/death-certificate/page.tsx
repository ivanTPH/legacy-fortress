import type { CSSProperties } from "react";

export default function LegacyDeathCertificateRedirectPage() {
  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Death certificate access</h1>
        <p style={{ margin: 0, color: "#6b7280" }}>
          Wallet owners do not submit a death certificate as evidence for their own vault. Add people in Contacts, invite them by email, and choose exactly which wallet categories and records they can view or edit.
        </p>
      </div>
      <section style={panelStyle}>
        <h2 style={{ margin: 0, fontSize: 18 }}>How this flow works</h2>
        <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
          If an invited executor or attorney later requests elevated post-death access, they submit death certificate evidence from their linked access view. That request is routed to the application verification dashboard for document, identity, relationship, and audit checks.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href="/contacts" style={primaryLinkStyle}>Manage contacts and permissions</a>
          <a href="/access-requests" style={secondaryLinkStyle}>View access request status</a>
        </div>
      </section>
    </section>
  );
}

const panelStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#fff",
  padding: 14,
  display: "grid",
  gap: 10,
};

const primaryLinkStyle: CSSProperties = {
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
};

const secondaryLinkStyle: CSSProperties = {
  ...primaryLinkStyle,
  background: "#fff",
  color: "#111827",
  borderColor: "#d1d5db",
};
