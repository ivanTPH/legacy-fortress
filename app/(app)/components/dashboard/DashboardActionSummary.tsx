"use client";

import Link from "next/link";
import type { BlockingItem } from "../../../../lib/workflow/blockingModel";
import type { GuidanceItem } from "../../../../lib/readiness/guidance";
import Icon from "../../../../components/ui/Icon";
import {
  buildActionCentrePreview,
  getActionCentreActionCount,
  type ActionCentreContext,
} from "./ActionQueuePanel";

type DashboardActionSummaryProps = {
  items: BlockingItem[];
  context?: ActionCentreContext;
  guidanceItems: GuidanceItem[];
  onAction: (actionKey: string) => void;
};

export default function DashboardActionSummary({ items, context, guidanceItems, onAction }: DashboardActionSummaryProps) {
  const count = getActionCentreActionCount(items, context, guidanceItems);
  if (!count) return null;

  const preview = buildActionCentrePreview(items, context, guidanceItems, 3);

  return (
    <section id="action-centre" className="lf-dashboard-action-summary" aria-label="Things worth your attention">
      <div className="lf-dashboard-action-summary-heading">
        <div>
          <p className="lf-dashboard-action-summary-eyebrow">Next useful steps</p>
          <h2>Things worth your attention</h2>
        </div>
        <span className="lf-dashboard-action-summary-count" aria-label={`${count} actionable items`}>{count}</span>
      </div>
      <div className="lf-dashboard-action-summary-list">
        {preview.map((item) => (
          <button key={item.key} type="button" className="lf-dashboard-action-summary-item" onClick={() => onAction(item.actionKey)}>
            <span>
              <strong>{item.title}</strong>
              <small>{item.blockerLabel}</small>
            </span>
            <Icon name="arrow_forward" size={18} aria-hidden />
          </button>
        ))}
      </div>
      <Link className="lf-dashboard-action-summary-link" href="/action-centre">
        View {count > 3 ? `all ${count}` : "Action Centre"}
        <Icon name="arrow_forward" size={16} aria-hidden />
      </Link>
    </section>
  );
}
