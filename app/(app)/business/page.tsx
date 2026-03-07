"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

export default function BusinessOverviewPage() {
  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28 }}>Business</h1>
        <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
          Manage business interests and supporting records.
        </p>
      </div>
      <Link href="/vault/business" style={cardStyle}>
        <div style={{ fontWeight: 700 }}>Business Interests</div>
        <div style={{ color: "#64748b", fontSize: 13 }}>Add, edit, and track business entity records.</div>
      </Link>
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
  maxWidth: 420,
};

