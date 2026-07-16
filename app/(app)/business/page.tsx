"use client";

import { useMemo } from "react";
import CanonicalAssetOverviewGrid, { type CanonicalAssetOverviewTile } from "../components/dashboard/CanonicalAssetOverviewGrid";
import DashboardAssetSummaryCard from "../components/dashboard/DashboardAssetSummaryCard";
import Icon from "../../../components/ui/Icon";
import { useVaultPreferences } from "../../../components/vault/VaultPreferencesContext";
import { isVaultSubsectionEnabled } from "../../../lib/vaultPreferences";

export default function BusinessOverviewPage() {
  const { preferences } = useVaultPreferences();
  const showBusinessInterests = isVaultSubsectionEnabled(preferences, "business_interests");
  const showEmployment = isVaultSubsectionEnabled(preferences, "business_employment");
  const businessTiles: CanonicalAssetOverviewTile[] = useMemo(() => (
    showBusinessInterests
      ? [{
        key: "business-interests",
        title: "Business Interests",
        description: "Manage business ownership, registrations, advisers, values, and supporting files.",
        href: "/vault/business",
        addHref: "/vault/business?add=1",
        icon: "business_center",
        sectionKey: "business",
        categoryKey: "business",
      }]
      : []
  ), [showBusinessInterests]);

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <p style={{ margin: 0, color: "#6b7280" }}>
          Keep your business interests, workplace records, and supporting documents clear for future review.
        </p>
      </div>

      {showBusinessInterests || showEmployment ? (
        <div className="lf-content-grid">
          <CanonicalAssetOverviewGrid tiles={businessTiles} />
          {showEmployment ? (
            <BusinessSummaryTile
              title="Employment"
              description="Review workplace records, death-in-service details, and employer-linked documents."
              href="/employment"
              icon="work"
            />
          ) : null}
        </div>
      ) : null}
      {!showBusinessInterests && !showEmployment ? (
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Business subsections are currently hidden by My Vault preferences. Re-enable them in Account / My Vault at any time.
        </div>
      ) : null}
    </section>
  );
}

function BusinessSummaryTile({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: string;
}) {
  return (
    <div className="lf-finance-summary-tile">
      <DashboardAssetSummaryCard
        icon={<Icon name={icon} size={13} />}
        title={title}
        href={`${href}?add=1`}
        value="No records yet"
        detail={description}
        items={[]}
        emptyActionLabel="Add record"
        emptyState
      />
    </div>
  );
}
