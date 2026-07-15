"use client";

import CanonicalAssetOverviewGrid, { metadataToken, type CanonicalAssetOverviewTile } from "../../components/dashboard/CanonicalAssetOverviewGrid";

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
  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
          Keep online accounts, subscriptions, platforms, recovery contacts, and access notes clear for trusted people later.
        </p>
      </div>

      <div className="lf-content-grid">
        <CanonicalAssetOverviewGrid tiles={digitalTiles} />
      </div>
    </section>
  );
}
