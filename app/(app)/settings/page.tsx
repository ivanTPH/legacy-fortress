"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

const settingsLinks = [
  { href: "/account/security", label: "Security", desc: "Password, recovery, and mobile verification controls." },
  { href: "/account/billing", label: "Billing and Account", desc: "Plan status and payment configuration." },
  { href: "/account/terms", label: "Terms and Conditions", desc: "Current terms and acceptance history." },
  { href: "/account/communications-preferences", label: "Communications Preferences", desc: "Message channel controls." },
  { href: "/account/reminder-preferences", label: "Reminder Preferences", desc: "Recurring reminder schedules and notice periods." },
];

export default function SettingsOverviewPage() {
  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28 }}>Settings</h1>
        <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
          Manage security, billing, terms, communications, and reminder controls.
        </p>
      </div>
      <div className="lf-content-grid">
        {settingsLinks.map((item) => (
          <Link key={item.href} href={item.href} style={cardStyle}>
            <div style={{ fontWeight: 700 }}>{item.label}</div>
            <div style={{ color: "#64748b", fontSize: 13 }}>{item.desc}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

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

