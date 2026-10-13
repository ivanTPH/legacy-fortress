"use client";

import { VaultAreaOverview, type VaultAreaTile } from "../../../components/vault/VaultAreaOverview";
import { useVaultPreferences } from "../../../components/vault/VaultPreferencesContext";
import { isVaultSubsectionEnabled } from "../../../lib/vaultPreferences";

// CanonicalAssetOverviewGrid remains the shared data projection for populated
// business records; the overview shell now uses the approved shared tile.

export default function BusinessOverviewPage() {
  const { preferences } = useVaultPreferences();
  const showBusinessInterests = isVaultSubsectionEnabled(preferences, "business_interests");
  const showEmployment = isVaultSubsectionEnabled(preferences, "business_employment");
  const businessTiles: VaultAreaTile[] = [
    ...(showBusinessInterests ? [{ key: "business-interests", title: "Business interests", description: "Manage business ownership, registrations, advisers, values, and supporting files.", href: "/vault/business", addHref: "/vault/business?add=1", icon: "work" }] : []),
    ...(showEmployment ? [{ key: "employment", title: "Employment", description: "Review workplace records, death-in-service details, and employer-linked documents.", href: "/employment", addHref: "/employment?add=1", icon: "work" }] : []),
  ];

  return (
    <>
      <VaultAreaOverview title="Business" description="Keep your business interests, workplace records, and supporting documents clear for future review." addHref="/vault/business?add=1" tiles={businessTiles} />
      {!businessTiles.length ? <div style={{ color: "#64748b", fontSize: 13 }}>Business subsections are currently hidden by My Vault preferences. Re-enable them in Account / My Vault at any time.</div> : null}
    </>
  );
}
