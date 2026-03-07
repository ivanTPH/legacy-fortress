"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

const sections = [
  { label: "Bank", href: "/finances/bank", desc: "Current and savings accounts with provider logos." },
  { label: "Pensions", href: "/finances/pensions", desc: "Track pension providers, values, and notes." },
  { label: "Investments", href: "/finances/investments", desc: "Record portfolios, bonds, and funds." },
  { label: "Insurance", href: "/finances/insurance", desc: "Capture life and protection policy references." },
  { label: "Debts", href: "/finances/debts", desc: "Track liabilities and repayment obligations." },
];

export default function FinancesOverviewPage() {
  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28 }}>Finances</h1>
        <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
          Choose a finance category to add, edit, and manage records.
        </p>
      </div>

      <div className="lf-content-grid">
        {sections.map((item) => (
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

