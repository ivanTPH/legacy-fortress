import AdminPrototypeShell from "@/components/admin/prototype/AdminPrototypeShell";
import AdminStatusBadge from "@/components/admin/prototype/AdminStatusBadge";
import { auditEvents, findUser } from "@/components/admin/prototype/mockData";
import type { CSSProperties, ReactNode } from "react";

type AdminUserDetailPageProps = {
  params: Promise<{ userId: string }>;
};

export default async function AdminUserDetailPage({ params }: AdminUserDetailPageProps) {
  const { userId } = await params;
  const user = findUser(userId);

  return (
    <AdminPrototypeShell
      title={user.name}
      description={`${user.id} · ${user.email}`}
    >
      <section style={readOnlyBannerStyle}>
        <strong>Read-only admin view</strong>
        <span>Financial and identity values are masked. Prototype actions are disabled.</span>
      </section>

      <section style={gridStyle}>
        <section style={panelStyle}>
          <h2 style={h2Style}>User summary</h2>
          <Info label="Vault status" value={<AdminStatusBadge status={user.vaultStatus} />} />
          <Info label="Plan" value={user.plan} />
          <Info label="Last login" value={user.lastLogin} />
          <Info label="Records" value={`${user.records} records · ${user.documents} documents · ${user.contacts} contacts`} />
        </section>

        <section style={panelStyle}>
          <h2 style={h2Style}>Masked vault data</h2>
          <Info label="Primary bank account" value="HSBC Current · ****5678" />
          <Info label="National Insurance" value="Protected" />
          <Info label="Property address" value="22 Market Street · partially masked" />
          <Info label="Document preview" value="Available only after elevated approval" />
        </section>
      </section>

      <section style={panelStyle}>
        <h2 style={h2Style}>Recent audit activity</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {auditEvents.slice(0, 3).map((event) => (
            <div key={event.id} style={auditRowStyle}>
              <span>
                <strong>{event.action}</strong>
                <span style={mutedBlockStyle}>{event.actor} · {event.timestamp}</span>
              </span>
              <AdminStatusBadge status={event.result} />
            </div>
          ))}
        </div>
      </section>
    </AdminPrototypeShell>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={infoStyle}>
      <span style={{ color: "#64748b", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>{label}</span>
      <span style={{ color: "#0f172a", fontWeight: 700 }}>{value}</span>
    </div>
  );
}

const readOnlyBannerStyle: CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e3a8a",
  borderRadius: 10,
  padding: 14,
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  fontSize: 13,
};

const gridStyle: CSSProperties = {
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

const h2Style: CSSProperties = {
  margin: 0,
  fontSize: 17,
};

const infoStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  borderBottom: "1px solid #f1f5f9",
  paddingBottom: 10,
};

const auditRowStyle: CSSProperties = {
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
