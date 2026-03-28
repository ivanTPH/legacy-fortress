"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import UniversalRecordWorkspace from "../../../components/records/UniversalRecordWorkspace";
import { useVaultPreferences } from "../../../components/vault/VaultPreferencesContext";
import { BUSINESS_WORKSPACE_CONFIG } from "../../../lib/assets/workspaceCategoryConfig";
import { isVaultSubsectionEnabled } from "../../../lib/vaultPreferences";

export default function BusinessOverviewPage() {
  const { preferences } = useVaultPreferences();
  const showBusinessInterests = isVaultSubsectionEnabled(preferences, "business_interests");
  const showEmployment = isVaultSubsectionEnabled(preferences, "business_employment");

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <p style={{ margin: 0, color: "#6b7280" }}>
          Review business interests first, then open employment records as a related business and workplace sub-category.
        </p>
        {showEmployment ? <Link href="/employment" style={employmentCardStyle}>
          <div style={{ fontWeight: 700 }}>Employment</div>
          <div style={{ color: "#64748b", fontSize: 13 }}>
            Review workplace records, death-in-service details, and employer-linked documents.
          </div>
        </Link> : null}
      </div>

      {showBusinessInterests ? <UniversalRecordWorkspace
        sectionKey={BUSINESS_WORKSPACE_CONFIG.sectionKey}
        categoryKey={BUSINESS_WORKSPACE_CONFIG.categoryKey}
        title={BUSINESS_WORKSPACE_CONFIG.title}
        subtitle={BUSINESS_WORKSPACE_CONFIG.subtitle}
      /> : null}
      {!showBusinessInterests && !showEmployment ? (
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Business subsections are currently hidden by My Vault preferences. Re-enable them in Account / My Vault at any time.
        </div>
      ) : null}
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
