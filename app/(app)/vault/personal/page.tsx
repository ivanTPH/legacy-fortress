"use client";

import CanonicalAssetOverviewGrid, { metadataToken, type CanonicalAssetOverviewTile } from "../../components/dashboard/CanonicalAssetOverviewGrid";
import Link from "next/link";
import { useViewerAccess } from "../../../../components/access/ViewerAccessContext";
import { PageHeader } from "../../../../components/ui/V3Primitives";

const possessionTiles: CanonicalAssetOverviewTile[] = [
  {
    key: "vehicles",
    title: "Vehicles",
    description: "Cars, motorbikes, registration details, ownership notes and supporting files.",
    href: "/cars-transport",
    addHref: "/cars-transport?add=1",
    icon: "directions_car",
    sectionKey: "personal",
    categoryKey: "possessions",
    match: (row) => metadataToken(row, "category", "possession_category") === "vehicles",
  },
  {
    key: "watches-jewellery",
    title: "Watches & jewellery",
    description: "Watches, jewellery, valuations, certificates, photos and safe locations.",
    href: "/vault/personal/records",
    addHref: "/vault/personal/records?add=1&possessionCategory=watches",
    icon: "watch",
    sectionKey: "personal",
    categoryKey: "possessions",
    match: (row) => metadataToken(row, "category", "possession_category") === "watches",
  },
  {
    key: "art-paintings",
    title: "Art & paintings",
    description: "Paintings, prints, sculpture, provenance, values and specialist contacts.",
    href: "/vault/personal/records",
    addHref: "/vault/personal/records?add=1&possessionCategory=art&possessionSubtype=painting",
    icon: "palette",
    sectionKey: "personal",
    categoryKey: "possessions",
    match: (row) => metadataToken(row, "category", "possession_category") === "art",
  },
  {
    key: "household-contents",
    title: "Household contents",
    description: "Furniture, appliances, decor, collections and practical household items.",
    href: "/vault/personal/records",
    addHref: "/vault/personal/records?add=1&possessionCategory=household_contents",
    icon: "chair",
    sectionKey: "personal",
    categoryKey: "possessions",
    match: (row) => metadataToken(row, "category", "possession_category") === "household_contents",
  },
  {
    key: "collections",
    title: "Collections",
    description: "Coins, stamps, memorabilia, cameras, electronics and other collections.",
    href: "/vault/personal/records",
    addHref: "/vault/personal/records?add=1&possessionCategory=collectibles",
    icon: "collections_bookmark",
    sectionKey: "personal",
    categoryKey: "possessions",
    match: (row) => metadataToken(row, "category", "possession_category") === "collectibles",
  },
  {
    key: "other-possession",
    title: "Other possession",
    description: "Add your own possession type when it does not fit another category.",
    href: "/vault/personal/records",
    addHref: "/vault/personal/records?add=1&possessionCategory=other",
    icon: "add_circle",
    sectionKey: "personal",
    categoryKey: "possessions",
    match: (row) => {
      const token = metadataToken(row, "category", "possession_category");
      return token === "other" || !["vehicles", "watches", "art", "household_contents", "collectibles"].includes(token);
    },
  },
];

export default function PersonalPossessionsOverviewPage() {
  const { viewer } = useViewerAccess();
  return (
    <section className="lf-v3-area-page">
      <PageHeader title="Possessions" description="Capture personal possessions with values, references, locations, attachments and photos."
        action={viewer.mode === "linked" ? undefined : <Link className="lf-v3-button lf-v3-button--primary" href={possessionTiles[0].addHref}>Add record</Link>} />
      <CanonicalAssetOverviewGrid tiles={possessionTiles} />
    </section>
  );
}
