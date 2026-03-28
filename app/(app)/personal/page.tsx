"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import Icon from "../../../components/ui/Icon";

const items = [
  { href: "/vault/personal", label: "Possessions", desc: "Keep household items, keepsakes, and practical belongings visible with photos, notes, and supporting documents.", icon: "inventory_2" },
  { href: "/personal/subscriptions", label: "Subscriptions", desc: "Track recurring services, renewal dates, and provider details that someone may need to stop or transfer later.", icon: "subscriptions" },
  { href: "/personal/social-media", label: "Social media", desc: "Record social platforms, digital identities, and related account details in one place.", icon: "alternate_email" },
  { href: "/personal/wishes", label: "Personal wishes", desc: "Capture personal guidance, funeral wishes, and other instructions that help people act with confidence.", icon: "favorite" },
  { href: "/personal/tasks", label: "Tasks & follow-up", desc: "Track the practical actions that still need attention so executor readiness does not rely on memory alone.", icon: "task" },
];

export default function PersonalOverviewPage() {
  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
          Keep the personal records that make day-to-day life easier to understand, review, and hand over when needed.
        </p>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>
          This area focuses on possessions, subscriptions, social accounts, wishes, and follow-up work. Contacts, next of kin, executors, and advisers now live in the shared contacts network.
        </p>
      </div>
      <section style={introPanelStyle}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Contacts and access are managed separately</div>
          <div style={{ color: "#64748b", fontSize: 13 }}>
            Review next of kin, executors, trustees, advisers, and invitation status from the dedicated contacts network so roles stay clear and consistent.
          </div>
        </div>
        <Link href="/contacts" style={secondaryLinkStyle}>
          <Icon name="contact_phone" size={16} />
          Open contacts
        </Link>
      </section>
      <div className="lf-content-grid">
        {items.map((item) => (
          <Link key={item.href} href={item.href} style={cardStyle}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
              <Icon name={item.icon} size={18} />
              {item.label}
            </div>
            <div style={{ color: "#64748b", fontSize: 13 }}>{item.desc}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

const introPanelStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  background: "#fff",
  padding: 14,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const cardStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 14,
  background: "#fff",
  textDecoration: "none",
  color: "#111827",
  display: "grid",
  gap: 8,
};

const secondaryLinkStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  padding: "8px 12px",
  textDecoration: "none",
  color: "#0f172a",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 600,
};
