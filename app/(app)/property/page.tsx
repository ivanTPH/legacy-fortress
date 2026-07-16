"use client";

import { useMemo } from "react";
import CanonicalAssetOverviewGrid, { type CanonicalAssetOverviewTile } from "../components/dashboard/CanonicalAssetOverviewGrid";
import DashboardAssetSummaryCard from "../components/dashboard/DashboardAssetSummaryCard";
import Icon from "../../../components/ui/Icon";
import { useVaultPreferences } from "../../../components/vault/VaultPreferencesContext";
import { isVaultSubsectionEnabled, type VaultSubsectionKey } from "../../../lib/vaultPreferences";

const items = [
  { href: "/vault/property", label: "Property Records", desc: "Manage owned properties, deeds, valuations, mortgages, and ownership notes.", icon: "home", preferenceKey: "property_records" as VaultSubsectionKey },
  { href: "/property/documents", label: "Property Documents", desc: "Store property-specific files, references, photos, and supporting paperwork.", icon: "folder", preferenceKey: "property_documents" as VaultSubsectionKey },
];

export default function PropertyOverviewPage() {
  const { preferences } = useVaultPreferences();
  const visibleItems = items.filter((item) => isVaultSubsectionEnabled(preferences, item.preferenceKey));
  const propertyRecordTiles: CanonicalAssetOverviewTile[] = useMemo(() => (
    isVaultSubsectionEnabled(preferences, "property_records")
      ? [{
        key: "property-records",
        title: "Property Records",
        description: "Manage owned properties, deeds, valuations, mortgages, and ownership notes.",
        icon: "home",
        href: "/vault/property",
        addHref: "/vault/property?add=1",
        sectionKey: "property",
        categoryKey: "property",
      }]
      : []
  ), [preferences]);

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <p style={{ margin: "6px 0 0", color: "#6b7280" }}>Record your properties, deeds, valuations, and supporting documents for your estate.</p>
      </div>
      {visibleItems.length ? (
      <div className="lf-content-grid">
        <CanonicalAssetOverviewGrid tiles={propertyRecordTiles} />
        {visibleItems.filter((item) => item.href !== "/vault/property").map((item) => (
          <div key={item.href} className="lf-finance-summary-tile">
            <DashboardAssetSummaryCard
              icon={<Icon name={item.icon} size={13} />}
              title={item.label}
              href={`${item.href}?add=1`}
              value="No records yet"
              detail={item.desc}
              items={[]}
              emptyActionLabel="Add record"
              emptyState
            />
          </div>
        ))}
      </div>
      ) : (
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Property subsections are currently hidden by My Vault preferences. Re-enable them in Account / My Vault at any time.
        </div>
      )}
    </section>
  );
}
