"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

const items = [
  { href: "/vault/personal", label: "Possessions", desc: "Manage physical possessions and values." },
  { href: "/personal/subscriptions", label: "Subscriptions", desc: "Track paid subscriptions and renewal details." },
  { href: "/vault/digital", label: "Social / Digital Accounts", desc: "Record digital access references and instructions." },
  { href: "/personal/wishes", label: "Personal Wishes", desc: "Capture personal wishes and guidance notes." },
];

export default function PersonalOverviewPage() {
  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28 }}>Personal</h1>
        <p style={{ margin: "6px 0 0", color: "#6b7280" }}>Choose a personal area to manage records and files.</p>
      </div>
      <div className="lf-content-grid">
        {items.map((item) => (
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

