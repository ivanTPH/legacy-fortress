"use client";

import { Card, PageHeader } from "../../../../components/ui/V3Primitives";
import { AddAssetLink } from "../../../../components/ui/LFDesignSystem";
import Link from "next/link";
import Icon from "../../../../components/ui/Icon";
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
  /** Life cover, shown beside the estimated value rather than in it. */
  lifeCover?: string | null;
  actionCount?: number;
  canAddRecords?: boolean;
  /** Your next steps, the same calm list as To do (UX review, 10 Nov 2026). */
  nextSteps?: { key: string; title: string; href: string; actionLabel: string }[];
};

export default function V3DashboardOverview({ loading, areas, recordCount, peopleCount, recordedValue, lifeCover, actionCount, canAddRecords = true, nextSteps }: Props) {
  const count = (value: number) => loading ? "…" : value;

  return <div className="lf-v3-screen-overview is-dashboard">
    <div className="lf-v3-dashboard-pageheader"><PageHeader
      title="Dashboard"
      description="Your recorded information, in one place."
      action={canAddRecords ? <AddAssetLink href="/add" /> : undefined}
    /></div>
    <Card className="lf-v3-stats-strip" aria-label="Vault summary">
      <div><span>Estimated value</span><strong>{loading ? "…" : recordedValue}</strong>{!loading && lifeCover ? <small className="lf-v3-life-cover">Plus {lifeCover} life cover</small> : null}</div>
      <div><span>Records</span><strong>{count(recordCount)}</strong></div>
      {peopleCount !== undefined ? <div><span>People</span><strong>{count(peopleCount)}</strong></div> : null}
      {actionCount !== undefined ? <div><span>To do</span><strong>{count(actionCount)}</strong></div> : null}
    </Card>
    <Card className="lf-v3-mobile-value" aria-label="Estimated value">
      <span>Estimated value</span><strong>{loading ? "…" : recordedValue}</strong>{!loading && lifeCover ? <small className="lf-v3-life-cover">Plus {lifeCover} life cover</small> : null}
    </Card>
    {!loading && nextSteps && nextSteps.length ? <section className="lf-v3-next-steps" aria-labelledby="lf-next-steps-title">
      <div className="lf-v3-next-steps-head"><h2 id="lf-next-steps-title">Your next steps</h2><Link href="/action-centre">See all</Link></div>
      <ul>
        {nextSteps.map((step) => <li key={step.key}><Link href={step.href}>
          <span className="lf-v3-next-step-title">{step.title}</span>
          <span className="lf-v3-next-step-action">{step.actionLabel}<Icon name="chevron_right" size={18} /></span>
        </Link></li>)}
      </ul>
    </section> : null}
    <section aria-label="Vault areas" className="lf-v3-vault-overview">
      <VaultSectionGrid sections={areas.map((area) => ({
        key: area.href, title: area.title, icon: area.icon, href: area.href,
        count: loading ? null : area.count, value: area.value, updatedAt: area.updatedAt,
        description: "Loading records…", addHref: canAddRecords ? `/add?area=${area.title.toLowerCase()}` : undefined,
      }))} />
    </section>
  </div>;
}
