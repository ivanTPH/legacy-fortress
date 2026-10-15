"use client";

import CanonicalAssetOverviewGrid, { metadataToken, type CanonicalAssetOverviewTile } from "../../components/dashboard/CanonicalAssetOverviewGrid";
import Link from "next/link";
import { useViewerAccess } from "../../../../components/access/ViewerAccessContext";
import { PageHeader } from "../../../../components/ui/V3Primitives";

const digitalTiles: CanonicalAssetOverviewTile[] = [
  {
    key: "social-media",
    title: "Social media",
    description: "Facebook, LinkedIn, Instagram, X, WhatsApp and other social or messaging profiles.",
    href: "/vault/digital/records",
    addHref: "/vault/digital/records?add=1&digitalType=social_media",
    icon: "alternate_email",
    sectionKey: "digital",
    categoryKey: "digital",
    match: (row) => metadataToken(row, "digital_asset_type", "category") === "social_media",
  },
  {
    key: "subscriptions",
    title: "Subscriptions",
    description: "Netflix, Sky, Spotify, Apple, Amazon and other paid digital services.",
    href: "/vault/digital/records",
    addHref: "/vault/digital/records?add=1&digitalType=subscription",
    icon: "subscriptions",
    sectionKey: "digital",
    categoryKey: "digital",
    match: (row) => metadataToken(row, "digital_asset_type", "category") === "subscription",
  },
  {
    key: "email-cloud",
    title: "Email & cloud",
    description: "Email accounts, iCloud, Google, Microsoft, Dropbox and cloud storage access.",
    href: "/vault/digital/records",
    addHref: "/vault/digital/records?add=1&digitalType=cloud_storage",
    icon: "cloud",
    sectionKey: "digital",
    categoryKey: "digital",
    match: (row) => metadataToken(row, "digital_asset_type", "category") === "cloud_storage",
  },
  {
    key: "domains-websites",
    title: "Domains & websites",
    description: "Domain names, hosting, website admin, creator accounts and online properties.",
    href: "/vault/digital/records",
    addHref: "/vault/digital/records?add=1&digitalType=domain_name",
    icon: "language",
    sectionKey: "digital",
    categoryKey: "digital",
    match: (row) => metadataToken(row, "digital_asset_type", "category") === "domain_name",
  },
  {
    key: "crypto-wallets",
    title: "Crypto & wallets",
    description: "Exchange accounts, custodial wallets, self-custody wallets and recovery notes.",
    href: "/vault/digital/records",
    addHref: "/vault/digital/records?add=1&digitalType=crypto_wallet",
    icon: "account_balance_wallet",
    sectionKey: "digital",
    categoryKey: "digital",
    match: (row) => metadataToken(row, "digital_asset_type", "category") === "crypto_wallet",
  },
  {
    key: "other-digital",
    title: "Other digital record",
    description: "Add another digital account, platform, service or access note.",
    href: "/vault/digital/records",
    addHref: "/vault/digital/records?add=1&digitalType=__other",
    icon: "add_circle",
    sectionKey: "digital",
    categoryKey: "digital",
    match: (row) => {
      const token = metadataToken(row, "digital_asset_type", "category");
      return token === "__other" || !["social_media", "subscription", "cloud_storage", "domain_name", "crypto_wallet"].includes(token);
    },
  },
];

export default function DigitalVaultOverviewPage() {
  const { viewer } = useViewerAccess();
  return (
    <section className="lf-v3-area-page">
      <PageHeader title="Digital" description="Keep online accounts, subscriptions, platforms and recovery contacts clear for trusted people."
        action={viewer.mode === "linked" ? undefined : <Link className="lf-v3-button lf-v3-button--primary" href={digitalTiles[0].addHref}>Add record</Link>} />
      <CanonicalAssetOverviewGrid tiles={digitalTiles} />
    </section>
  );
}
