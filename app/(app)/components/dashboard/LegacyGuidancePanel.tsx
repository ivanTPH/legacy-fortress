"use client";

import Icon from "../../../../components/ui/Icon";
import type { GuidanceItem } from "../../../../lib/readiness/guidance";

type LegacyGuidancePanelProps = {
  items: GuidanceItem[];
  ownerActionsEnabled: boolean;
  busyKey: string | null;
  onOpen: (item: GuidanceItem) => void;
  onDecision: (item: GuidanceItem, action: "already_done" | "not_relevant" | "remind_later") => void;
};

export default function LegacyGuidancePanel({
  items,
  ownerActionsEnabled,
  busyKey,
  onOpen,
  onDecision,
}: LegacyGuidancePanelProps) {
  if (!ownerActionsEnabled || items.length === 0) return null;

  return (
    <section className="lf-legacy-guidance-panel" aria-labelledby="legacy-guidance-title">
      <div className="lf-legacy-guidance-heading">
        <span className="lf-legacy-guidance-icon"><Icon name="lightbulb" size={18} /></span>
        <span>
          <span className="lf-legacy-guidance-eyebrow">Something worth considering</span>
          <h2 id="legacy-guidance-title">Small steps that may help</h2>
        </span>
      </div>
      <p className="lf-legacy-guidance-intro">
        Your Fortress uses what you have recorded and the choices you make to suggest useful next steps. Nothing here is a legal conclusion, and you can dismiss or revisit any suggestion.
      </p>
      <div className="lf-legacy-guidance-list">
        {items.slice(0, 4).map((item) => (
          <article className="lf-legacy-guidance-item" key={item.key}>
            <div className="lf-legacy-guidance-item-copy">
              <span className="lf-legacy-guidance-category">{item.category}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
            <div className="lf-legacy-guidance-actions">
              <button type="button" className="lf-primary-btn" onClick={() => onOpen(item)}>
                {item.actionLabel}
                <Icon name="arrow_forward" size={15} />
              </button>
              {item.learnMoreHref ? (
                <button type="button" className="lf-text-button" onClick={() => onOpen({ ...item, href: item.learnMoreHref ?? item.href })}>
                  Learn more
                </button>
              ) : null}
              <button type="button" className="lf-secondary-btn" onClick={() => onDecision(item, "already_done")} disabled={busyKey === item.key}>
                Already done
              </button>
              <button type="button" className="lf-secondary-btn" onClick={() => onDecision(item, "not_relevant")} disabled={busyKey === item.key}>
                Not relevant
              </button>
              <button type="button" className="lf-text-button" onClick={() => onDecision(item, "remind_later")} disabled={busyKey === item.key}>
                {busyKey === item.key ? "Saving..." : "Remind me later"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
