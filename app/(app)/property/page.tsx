"use client";

import { useMemo } from "react";
import CanonicalAssetOverviewGrid, { type CanonicalAssetOverviewTile } from "../components/dashboard/CanonicalAssetOverviewGrid";
import { PageHeader } from "../../../components/ui/V3Primitives";
import { AddAssetLink } from "../../../components/ui/LFDesignSystem";
import { useViewerAccess } from "../../../components/access/ViewerAccessContext";
import { useVaultPreferences } from "../../../components/vault/VaultPreferencesContext";
import { isVaultSubsectionEnabled, type VaultSubsectionKey } from "../../../lib/vaultPreferences";

const items = [
  { href: "/vault/property", label: "Property Records", desc: "Manage owned properties, deeds, valuations, mortgages, and ownership notes.", icon: "home", preferenceKey: "property_records" as VaultSubsectionKey },
  { href: "/property/documents", label: "Property Documents", desc: "Store property-specific files, references, photos, and supporting paperwork.", icon: "folder", preferenceKey: "property_documents" as VaultSubsectionKey },
];

export default function PropertyOverviewPage() {
  const { viewer } = useViewerAccess();
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
    <section className="lf-v3-area-page">
      <PageHeader title="Property" description="Record properties, deeds, valuations and supporting documents for your estate."
        action={viewer.mode === "linked" || !propertyRecordTiles.length ? undefined : <AddAssetLink href={propertyRecordTiles[0].addHref} />} />
      {visibleItems.length ? (
      <CanonicalAssetOverviewGrid tiles={propertyRecordTiles} extraSections={visibleItems.filter((item) => item.href !== "/vault/property").map((item) => ({
        key: item.href, title: item.label, icon: item.icon, href: item.href, count: null, description: "Browse supporting files",
      }))} />
      ) : (
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Property subsections are currently hidden by My Vault preferences. Re-enable them in Account / My Vault at any time.
        </div>
      )}
    </section>
  );
}
