"use client";

import { useMemo } from "react";
import Link from "next/link";
import CanonicalAssetOverviewGrid, { type CanonicalAssetOverviewTile } from "../components/dashboard/CanonicalAssetOverviewGrid";
import { IconTile, PageHeader } from "../../../components/ui/V3Primitives";
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
        action={viewer.mode === "linked" || !businessTiles.length ? undefined : <Link className="lf-v3-button lf-v3-button--primary" href={businessTiles[0].addHref}>Add record</Link>} />

      {showBusinessInterests || showEmployment ? (
        <><CanonicalAssetOverviewGrid tiles={businessTiles} />
          {showEmployment && viewer.mode !== "linked" ? <div className="lf-v3-area-extra"><Link href="/employment" className="lf-v3-area-empty-tile"><IconTile icon="work" size={32} /><strong>Employment</strong><small>Workplace records, death-in-service details and employer-linked documents.</small><span aria-hidden="true">›</span></Link></div> : null}</>
      ) : null}
      {!showBusinessInterests && !showEmployment ? (
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Business subsections are currently hidden by My Vault preferences. Re-enable them in Account / My Vault at any time.
        </div>
      ) : null}
    </section>
  );
}
