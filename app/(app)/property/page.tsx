"use client";

import { VaultAreaOverview, type VaultAreaTile } from "../../../components/vault/VaultAreaOverview";
import { useVaultPreferences } from "../../../components/vault/VaultPreferencesContext";
import { isVaultSubsectionEnabled, type VaultSubsectionKey } from "../../../lib/vaultPreferences";

// CanonicalAssetOverviewGrid remains the canonical populated-record projection;
// this page uses the shared overview primitive for its presentation shell.

const items = [
  { href: "/vault/property", label: "Property Records", desc: "Manage owned properties, deeds, valuations, mortgages, and ownership notes.", icon: "home", preferenceKey: "property_records" as VaultSubsectionKey },
  { href: "/property/documents", label: "Property Documents", desc: "Store property-specific files, references, photos, and supporting paperwork.", icon: "folder", preferenceKey: "property_documents" as VaultSubsectionKey },
];

export default function PropertyOverviewPage() {
  const { preferences } = useVaultPreferences();
  const visibleItems = items.filter((item) => isVaultSubsectionEnabled(preferences, item.preferenceKey));
  const propertyTiles: VaultAreaTile[] = [
    ...(isVaultSubsectionEnabled(preferences, "property_records") ? [{ key: "property-records", title: "Property records", description: "Manage owned properties, deeds, valuations, mortgages, and ownership notes.", icon: "home", href: "/vault/property", addHref: "/vault/property?add=1" }] : []),
    ...(isVaultSubsectionEnabled(preferences, "property_documents") ? [{ key: "property-documents", title: "Property documents", description: "Store property-specific files, references, photos, and supporting paperwork.", icon: "description", href: "/property/documents", addHref: "/property/documents?add=1" }] : []),
  ];

  return (
    <>
      <VaultAreaOverview title="Property" description="Record your properties, deeds, valuations, and supporting documents for your estate." addHref="/vault/property?add=1" tiles={propertyTiles} />
      {!visibleItems.length ? <div style={{ color: "#64748b", fontSize: 13 }}>Property subsections are currently hidden by My Vault preferences. Re-enable them in Account / My Vault at any time.</div> : null}
    </>
  );
}
