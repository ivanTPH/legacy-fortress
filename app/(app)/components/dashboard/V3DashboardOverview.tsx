"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, EmptyState, IconTile, PageHeader, Row } from "../../../../components/ui/V3Primitives";
import { AddAssetLink } from "../../../../components/ui/LFDesignSystem";
import type { BlockingItem } from "../../../../lib/workflow/blockingModel";
import type { ActionCentreTask } from "./ActionQueuePanel";

export type VaultAreaSummary = {
  title: string;
  icon: string;
  href: string;
  count: number;
  updatedAt?: string | null;
};

type Props = {
  mode: "dashboard" | "actions";
  loading: boolean;
  areas: VaultAreaSummary[];
  recordCount: number;
  peopleCount?: number;
  recordedValue: string;
  actions: BlockingItem[];
  tasks: ActionCentreTask[];
  showActions?: boolean;
  actionCount?: number;
  canAddRecords?: boolean;
  onAction?: (key: string) => void;
};

function updatedLabel(value?: string | null) {
  if (!value) return "Add first record";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Updated recently" : `Updated ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date)}`;
}

export default function V3DashboardOverview({ mode, loading, areas, recordCount, peopleCount, recordedValue, actions, tasks, showActions = true, actionCount, canAddRecords = true, onAction }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const activeTasks = tasks.filter((task) => !["complete", "completed", "done"].includes(task.status.toLowerCase()));
  const displayedActionCount = actionCount ?? actions.length + activeTasks.length;
  const actionRows = [
    ...actions.map((action) => ({ id: action.actionKey, title: action.stageName, description: action.blockerLabel, href: action.href, actionKey: action.actionKey })),
    ...activeTasks.map((task) => ({ id: `task:${task.id}`, title: task.title, description: task.description || task.relatedEntity || "Review this task", href: task.href, actionKey: "" })),
  ];
  const dashboard = mode === "dashboard";
  const visibleActions = dashboard ? actionRows.slice(0, 3) : actionRows;
  const currentStep = actionRows.length ? actionRows[stepIndex % actionRows.length] : null;
  const populatedAreaCount = areas.filter((area) => area.count > 0).length;
  const latestUpdate = areas.map((area) => area.updatedAt).filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

  return <div className={`lf-v3-screen-overview ${dashboard ? "is-dashboard" : "is-actions"}`}>
    <div className={dashboard ? "lf-v3-dashboard-pageheader" : ""}><PageHeader
      title={dashboard ? "Dashboard" : "Action Centre"}
      description={dashboard ? "Your recorded information, in one place." : "Open an item to understand why it is here and choose what to do next."}
      action={dashboard && canAddRecords ? <AddAssetLink href="/add" /> : undefined}
    /></div>
    {dashboard ? <>
      <Card className="lf-v3-stats-strip" aria-label="Vault summary">
        <div><span>Records</span><strong>{loading ? "…" : recordCount}</strong><small>across {populatedAreaCount} {populatedAreaCount === 1 ? "area" : "areas"}</small></div>
        {peopleCount !== undefined ? <div><span>People</span><strong>{loading ? "…" : peopleCount}</strong><small>trusted contacts</small></div> : null}
        {actionCount !== undefined || showActions ? <div><span>Open actions</span><strong>{loading ? "…" : displayedActionCount}</strong><small>to review</small></div> : null}
      </Card>
      <Card className="lf-v3-mobile-value" aria-label="Total recorded value"><span>Total recorded value</span><strong>{loading ? "…" : recordedValue}</strong><small>{updatedLabel(latestUpdate)}</small></Card>
      <div className="lf-v3-mobile-kpis" aria-label="Vault at a glance">
        <Link href="/account/my-vault"><span>Records</span><strong>{loading ? "…" : recordCount}</strong></Link>
        {peopleCount !== undefined ? <Link href="/people-access"><span>People</span><strong>{loading ? "…" : peopleCount}</strong></Link> : null}
        {actionCount !== undefined || showActions ? <Link href="/actions"><span>Actions</span><strong>{loading ? "…" : displayedActionCount}</strong></Link> : null}
      </div>
      {showActions ? <Card className="lf-v3-next-step">
        <header><strong>Next step</strong><span>{currentStep ? `${stepIndex % actionRows.length + 1} of ${actionRows.length}` : "All clear"}</span></header>
        {loading ? <p role="status">Loading actions…</p> : currentStep ? <><h2>{currentStep.title}</h2><p>{currentStep.description}</p>
          <div><Link className="lf-v3-button lf-v3-button--primary" href={currentStep.href}>Open action</Link>
            {actionRows.length > 1 ? <button type="button" onClick={() => setStepIndex((index) => index + 1)}>Not now</button> : null}</div>
          <footer><span aria-hidden="true">{actionRows.slice(0, Math.min(actionRows.length, 5)).map((action, index) => <i key={action.id} className={index === stepIndex % actionRows.length ? "is-current" : ""} />)}</span><Link href="/actions">See all</Link></footer>
        </> : <p>No open actions right now.</p>}
      </Card> : null}
      <section aria-labelledby="lf-v3-vault-heading" className="lf-v3-vault-overview">
        <h2 id="lf-v3-vault-heading">Your vault</h2>
        <div className="lf-v3-vault-grid">{areas.map((area) => <Link key={area.href} href={area.href} className="lf-v3-vault-tile">
          <span className="lf-v3-vault-tile-heading"><IconTile icon={area.icon} /><strong>{area.title}</strong><span aria-hidden="true">›</span></span>
          <span className="lf-v3-vault-tile-meta"><strong>{loading ? "Loading" : area.count ? `${area.count} record${area.count === 1 ? "" : "s"}` : "Nothing yet"}</strong><small>{area.count ? updatedLabel(area.updatedAt) : "Add first record"}</small></span>
        </Link>)}</div>
      </section>
      {!showActions && actionCount !== undefined ? <Link className="lf-v3-mobile-next-steps" href="/actions">
        <span><strong>Next steps</strong><small>{loading ? "Loading actions…" : displayedActionCount ? `${displayedActionCount} to review` : "All up to date"}</small></span>
        <span>See all actions</span>
      </Link> : null}
    </> : null}
    {showActions ? <Card className="lf-v3-actions-list" aria-label={dashboard ? "Things worth your attention" : "Action Centre items"}>
      <header><h2>{dashboard ? "Things worth your attention" : "Your actions"}</h2>{dashboard ? <Link href="/actions">View Action Centre</Link> : !loading ? <span>{actionRows.length} open</span> : null}</header>
      {loading ? <p role="status">Loading actions…</p> : visibleActions.length ? visibleActions.map((action) => <Row
        key={action.id}
        icon="task_alt"
        title={action.title}
        description={action.description}
        href={action.href}
        action={!dashboard ? action.actionKey && onAction ? <Button variant="secondary" onClick={() => onAction(action.actionKey)}>Review</Button>
          : <Link className="lf-v3-button lf-v3-button--secondary" href={action.href}>Review</Link> : undefined}
      />) : <EmptyState icon="task_alt" title="All up to date" description="There are no open actions in your vault right now." />}
    </Card> : null}
  </div>;
}
