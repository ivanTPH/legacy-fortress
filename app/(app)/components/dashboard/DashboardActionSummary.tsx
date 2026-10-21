"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BlockingItem } from "../../../../lib/workflow/blockingModel";
import type { GuidanceItem } from "../../../../lib/readiness/guidance";
import Icon from "../../../../components/ui/Icon";
import {
  buildActionCentrePreview,
  getActionCentreToDoCount,
  type ActionCentreContext,
} from "./ActionQueuePanel";

type DashboardActionSummaryProps = {
  items: BlockingItem[];
  context?: ActionCentreContext;
  guidanceItems: GuidanceItem[];
  onAction: (actionKey: string, href: string) => void;
  excludedActionKeys?: readonly string[];
};

export default function DashboardActionSummary({ items, context, guidanceItems, onAction, excludedActionKeys = [] }: DashboardActionSummaryProps) {
  const router = useRouter();
  const count = getActionCentreToDoCount(items, context, guidanceItems);
  if (!count) return null;

  const preview = buildActionCentrePreview(items, context, guidanceItems, 3, excludedActionKeys, "todo");
  if (!preview.length) return null;

  return (
    <section id="action-centre" className="lf-dashboard-action-summary" aria-label="To do">
      <div className="lf-dashboard-action-summary-heading">
        <div>
          <h2>To do</h2>
        </div>
        <Link className="lf-dashboard-action-summary-link" href="/actions?filter=todo">
          See all {count}
          <Icon name="arrow_forward" size={16} aria-hidden />
        </Link>
      </div>
      <div className="lf-dashboard-action-summary-list">
        {preview.map((item) => (
            <button key={item.key} type="button" className="lf-dashboard-action-summary-item" onClick={() => item.guidanceKey === "will" && item.guidanceState === "unknown"
              ? router.push(`/actions?filter=todo&action=${encodeURIComponent(item.actionKey)}`)
              : onAction(item.actionKey, item.href)}>
              <span className="lf-dashboard-action-summary-status" aria-hidden="true" />
              <span className="lf-dashboard-action-summary-copy">
                <strong>{item.title}</strong>
                <small>{item.blockerLabel}</small>
              </span>
              <Icon name="arrow_forward" size={18} aria-hidden />
            </button>
        ))}
      </div>
    </section>
  );
}
