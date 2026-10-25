"use client";

import { Card, PageHeader } from "../../../../components/ui/V3Primitives";
import { AddAssetLink } from "../../../../components/ui/LFDesignSystem";
import VaultSectionGrid from "../../../../components/vault/VaultSectionGrid";

export type VaultAreaSummary = {
  title: string;
  icon: string;
  href: string;
  count: number;
  value?: string;
  updatedAt?: string | null;
};

type Props = {
  loading: boolean;
  areas: VaultAreaSummary[];
  recordCount: number;
  peopleCount?: number;
  recordedValue: string;
  actionCount?: number;
  canAddRecords?: boolean;
};

export default function V3DashboardOverview({ loading, areas, recordCount, peopleCount, recordedValue, actionCount, canAddRecords = true }: Props) {
  const count = (value: number) => loading ? "…" : value;

  return <div className="lf-v3-screen-overview is-dashboard">
    <div className="lf-v3-dashboard-pageheader"><PageHeader
      title="Dashboard"
      description="Your recorded information, in one place."
      action={canAddRecords ? <AddAssetLink href="/add" /> : undefined}
    /></div>
    <Card className="lf-v3-stats-strip" aria-label="Vault summary">
      <div><span>Total recorded value</span><strong>{loading ? "…" : recordedValue}</strong></div>
      <div><span>Records</span><strong>{count(recordCount)}</strong></div>
      {peopleCount !== undefined ? <div><span>People</span><strong>{count(peopleCount)}</strong></div> : null}
      {actionCount !== undefined ? <div><span>To do</span><strong>{count(actionCount)}</strong></div> : null}
    </Card>
    <Card className="lf-v3-mobile-value" aria-label="Total recorded value">
      <span>Total recorded value</span><strong>{loading ? "…" : recordedValue}</strong>
    </Card>
    <section aria-label="Vault areas" className="lf-v3-vault-overview">
      <VaultSectionGrid sections={areas.map((area) => ({
        key: area.href, title: area.title, icon: area.icon, href: area.href,
        count: loading ? null : area.count, value: area.value, updatedAt: area.updatedAt,
        description: "Loading records…", addHref: canAddRecords ? `/add?area=${area.title.toLowerCase()}` : undefined,
      }))} />
    </section>
  </div>;
}
