"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useVaultPreferences } from "../../../components/vault/VaultPreferencesContext";
import { isVaultSubsectionEnabled, type VaultSubsectionKey } from "../../../lib/vaultPreferences";

const items = [
  { href: "/vault/property", label: "Property Records", desc: "Manage owned properties and liabilities.", preferenceKey: "property_records" as VaultSubsectionKey },
  { href: "/property/documents", label: "Property Documents", desc: "Store property-specific files and references.", preferenceKey: "property_documents" as VaultSubsectionKey },
];

export default function PropertyOverviewPage() {
  const { preferences } = useVaultPreferences();
  const visibleItems = items.filter((item) => isVaultSubsectionEnabled(preferences, item.preferenceKey));

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <p style={{ margin: "6px 0 0", color: "#6b7280" }}>Manage records and supporting property documentation.</p>
      </div>
      {visibleItems.length ? (
      <div className="lf-content-grid">
        {visibleItems.map((item) => (
          <Link key={item.href} href={item.href} style={cardStyle}>
            <div style={{ fontWeight: 700 }}>{item.label}</div>
            <div style={{ color: "#64748b", fontSize: 13 }}>{item.desc}</div>
          </Link>
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

const cardStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 14,
  background: "#fff",
  textDecoration: "none",
  color: "#111827",
  display: "grid",
  gap: 8,
};
