"use client";

import type { ReactNode } from "react";
import { Card, PageHeader } from "../../../../components/ui/V3Primitives";
import { AddAssetLink } from "../../../../components/ui/LFDesignSystem";
import VaultSectionGrid from "../../../../components/vault/VaultSectionGrid";

export type VaultAreaSummary = {
  title: string;
  icon: string;
  href: string;
  count: number;
  value?: string;
  owed?: string | null;
  updatedAt?: string | null;
};

type Props = {
  loading: boolean;
  areas: VaultAreaSummary[];
  recordCount: number;
  peopleCount?: number;
  recordedValue: string;
  /** Life cover, shown beside the estimated value rather than in it. */
  lifeCover?: string | null;
  /** "£737,300 assets · −£185,000 owed" when anything is owed: the headline is then a net figure (27 Nov 2026). */
  valueBreakdown?: { assets: string; owed: string } | null;
  actionCount?: number;
  canAddRecords?: boolean;
  /** Readiness score card (owner only), shown above the areas so it's seen first (owner, 18 Nov 2026). */
  readiness?: ReactNode;
  /** Shown at the bottom of Home when the owner has hidden the readiness card (27 Nov 2026). */
  readinessFooter?: ReactNode;
};

export default function V3DashboardOverview({ loading, areas, recordCount, peopleCount, recordedValue, lifeCover, valueBreakdown, actionCount, canAddRecords = true, readiness, readinessFooter }: Props) {
  const count = (value: number) => loading ? "…" : value;

  return <div className="lf-v3-screen-overview is-dashboard">
    <div className="lf-v3-dashboard-pageheader"><PageHeader
      title="Home"
      description="Your recorded information, in one place."
      action={canAddRecords ? <AddAssetLink href="/add" label="Add to my Vault" /> : undefined}
    /></div>
    <Card className="lf-v3-stats-strip" aria-label="Vault summary">
      <div><span>{!loading && valueBreakdown ? "Estimated net value" : "Estimated value"}</span><strong>{loading ? "…" : recordedValue}</strong>{!loading && valueBreakdown ? <small className="lf-v3-value-breakdown">{valueBreakdown.assets} assets · <span className="lf-amount-owed">{valueBreakdown.owed}</span></small> : null}{!loading && lifeCover ? <small className="lf-v3-life-cover">Plus {lifeCover} life cover</small> : null}</div>
      <div><span>Records</span><strong>{count(recordCount)}</strong></div>
      {peopleCount !== undefined ? <div><span>People</span><strong>{count(peopleCount)}</strong></div> : null}
      {actionCount !== undefined ? <div><span>Inbox</span><strong>{count(actionCount)}</strong></div> : null}
    </Card>
    <Card className="lf-v3-mobile-value" aria-label="Estimated value">
      <span>{!loading && valueBreakdown ? "Estimated net value" : "Estimated value"}</span><strong>{loading ? "…" : recordedValue}</strong>{!loading && valueBreakdown ? <small className="lf-v3-value-breakdown">{valueBreakdown.assets} assets · <span className="lf-amount-owed is-on-dark">{valueBreakdown.owed}</span></small> : null}{!loading && lifeCover ? <small className="lf-v3-life-cover">Plus {lifeCover} life cover</small> : null}
    </Card>
    {readiness}
    {/* Prompts live only in the Inbox (owner, 10 Nov 2026): on Home they repeated it and confused what it is for. */}
    <section aria-label="Vault areas" className="lf-v3-vault-overview">
      <VaultSectionGrid sections={areas.map((area) => ({
        key: area.href, title: area.title, icon: area.icon, href: area.href,
        count: loading ? null : area.count, value: area.value, owed: area.owed, updatedAt: area.updatedAt,
        description: "Loading records…", addHref: canAddRecords ? `/add?area=${area.title.toLowerCase()}` : undefined,
      }))} />
    </section>
    {readinessFooter}
  </div>;
}
