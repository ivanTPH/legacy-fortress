"use client";

import DashboardAssetSummaryCard from "../components/dashboard/DashboardAssetSummaryCard";
import Icon from "../../../components/ui/Icon";
import { useVaultPreferences } from "../../../components/vault/VaultPreferencesContext";
import { isVaultSubsectionEnabled, type VaultSubsectionKey } from "../../../lib/vaultPreferences";

const items = [
  { href: "/vault/personal", addHref: "/vault/personal", label: "Possessions", desc: "Keep household items, keepsakes, and practical belongings visible with photos, notes, and supporting documents.", icon: "inventory_2", preferenceKey: "personal_possessions" as VaultSubsectionKey },
  { href: "/personal/subscriptions", label: "Subscriptions", desc: "Track recurring services, renewal dates, and provider details that someone may need to stop or transfer later.", icon: "subscriptions", preferenceKey: "personal_subscriptions" as VaultSubsectionKey },
  { href: "/personal/social-media", label: "Social media", desc: "Record social platforms, digital identities, and related account details in one place.", icon: "alternate_email", preferenceKey: "personal_social_media" as VaultSubsectionKey },
  { href: "/personal/wishes", label: "Personal wishes", desc: "Capture personal guidance, funeral wishes, and other instructions that help people act with confidence.", icon: "favorite", preferenceKey: "personal_wishes" as VaultSubsectionKey },
  { href: "/personal/tasks", label: "Tasks & follow-up", desc: "Track the practical actions that still need attention so executor readiness does not rely on memory alone.", icon: "task", preferenceKey: "tasks_follow_up" as VaultSubsectionKey },
];

export default function PersonalOverviewPage() {
  const { preferences } = useVaultPreferences();
  const visibleItems = items.filter((item) => isVaultSubsectionEnabled(preferences, item.preferenceKey));

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
          Store and manage your personal accounts, subscriptions, wishes, and digital access in one trusted place.
        </p>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>
          This area focuses on possessions, subscriptions, social accounts, wishes, and follow-up work. Contacts, next of kin, executors, and advisers now live in the shared contacts network.
        </p>
        <div style={progressCueStyle}>
          {visibleItems.length} of {items.length} personal areas visible
        </div>
      </div>
      {visibleItems.length ? (
      <div className="lf-content-grid">
        {visibleItems.map((item) => (
          <div key={item.href} className="lf-finance-summary-tile">
            <DashboardAssetSummaryCard
              icon={<Icon name={item.icon} size={13} />}
              title={item.label}
              href={item.addHref ?? `${item.href}?add=1`}
              value="No records yet"
              detail={item.desc}
              items={[]}
              emptyActionLabel="Add record"
              emptyState
            />
          </div>
        ))}
      </div>
      ) : (
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Personal subsections are currently hidden by My Vault preferences. Re-enable them in Account / My Vault at any time.
        </div>
      )}
    </section>
  );
}

const progressCueStyle = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 600,
} as const;
