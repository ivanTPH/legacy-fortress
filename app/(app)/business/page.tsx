"use client";

import { useMemo } from "react";
import CanonicalAssetOverviewGrid, { type CanonicalAssetOverviewTile } from "../components/dashboard/CanonicalAssetOverviewGrid";
import { PageHeader } from "../../../components/ui/V3Primitives";
import { AddAssetLink } from "../../../components/ui/LFDesignSystem";
import { useViewerAccess } from "../../../components/access/ViewerAccessContext";
import { useVaultPreferences } from "../../../components/vault/VaultPreferencesContext";
import { isVaultSubsectionEnabled } from "../../../lib/vaultPreferences";

export default function BusinessOverviewPage() {
  const { viewer } = useViewerAccess();
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
    <section className="lf-v3-area-page">
      <PageHeader title="Business" description="Keep business interests, workplace records and supporting documents clear for future review."
        action={viewer.mode === "linked" || !businessTiles.length ? undefined : <AddAssetLink href={businessTiles[0].addHref} />} />

      {showBusinessInterests || showEmployment ? (
        <CanonicalAssetOverviewGrid tiles={businessTiles} extraSections={showEmployment ? [{ key: "employment", title: "Employment", icon: "work", href: "/employment", count: null, description: "Workplace records and benefits" }] : []} />
      ) : null}
      {!showBusinessInterests && !showEmployment ? (
        <div style={{ color: "var(--lf-text-secondary)", fontSize: 13 }}>
          Business subsections are currently hidden by My Vault preferences. Re-enable them in Account / My Vault at any time.
        </div>
      ) : null}
    </section>
  );
}
