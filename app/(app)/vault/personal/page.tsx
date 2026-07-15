"use client";

import CanonicalAssetOverviewGrid, { metadataToken, type CanonicalAssetOverviewTile } from "../../components/dashboard/CanonicalAssetOverviewGrid";

const possessionTiles: CanonicalAssetOverviewTile[] = [
  {
    key: "vehicles",
    title: "Vehicles",
    description: "Cars, motorbikes, registration details, ownership notes and supporting files.",
    href: "/cars-transport?add=1",
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
  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
          Capture personal possessions with values, references, locations, attachments, and photos.
        </p>
      </div>

      <div className="lf-content-grid">
        <CanonicalAssetOverviewGrid tiles={possessionTiles} />
      </div>
    </section>
  );
}
