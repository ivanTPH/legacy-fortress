"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import UniversalRecordWorkspace from "../../../components/records/UniversalRecordWorkspace";
import { BUSINESS_WORKSPACE_CONFIG } from "../../../lib/assets/workspaceCategoryConfig";

export default function BusinessOverviewPage() {
  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Business</h1>
          <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
            Review business interests first, then open employment records as a related business and workplace sub-category.
          </p>
        </div>
        <Link href="/employment" style={employmentCardStyle}>
          <div style={{ fontWeight: 700 }}>Employment</div>
          <div style={{ color: "#64748b", fontSize: 13 }}>
            Review workplace records, death-in-service details, and employer-linked documents.
          </div>
        </Link>
      </div>

      <UniversalRecordWorkspace
        sectionKey={BUSINESS_WORKSPACE_CONFIG.sectionKey}
        categoryKey={BUSINESS_WORKSPACE_CONFIG.categoryKey}
        title={BUSINESS_WORKSPACE_CONFIG.title}
        subtitle={BUSINESS_WORKSPACE_CONFIG.subtitle}
      />
    </section>
  );
}

const employmentCardStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 14,
  background: "#fff",
  textDecoration: "none",
  color: "#111827",
  display: "grid",
  gap: 8,
};
