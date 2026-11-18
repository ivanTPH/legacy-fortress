"use client";

import Link from "next/link";
import { useId, useState } from "react";
import Icon from "../../../../components/ui/Icon";
import type { Readiness, ReadinessItemState, ReadinessKey } from "../../../../lib/readiness/score";

/**
 * "Your Vault is 70% ready" with the next 3 steps (owner decision 18 Nov 2026). Owner only. Encouraging:
 * no red, no "incomplete"; each item can be marked "Doesn't apply" and comes off the total.
 */
export default function ReadinessCard({ readiness, busyKey, onNotApplicable }: {
  readiness: Readiness;
  busyKey: ReadinessKey | null;
  onNotApplicable: (key: ReadinessKey, notApplicable: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const headline = readiness.percent >= 100 ? "Your Vault is ready" : `Your Vault is ${readiness.percent}% ready`;
  return (
    <section className="lf-readiness-card" aria-labelledby={`${listId}-title`}>
      <div className="lf-readiness-head">
        <div className="lf-readiness-copy">
          <h2 id={`${listId}-title`}>{headline}</h2>
          <p>{readiness.percent >= 100 ? "Everything that matters is here. Check it once a year." : "The essentials your family would need, in one place."}</p>
        </div>
        <span className="lf-readiness-figure" aria-hidden="true">{readiness.percent}%</span>
      </div>
      <div className="lf-readiness-bar" role="progressbar" aria-label="Vault readiness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={readiness.percent}>
        <span style={{ width: `${readiness.percent}%` }} />
      </div>
      {readiness.nextSteps.length ? (
        <ol className="lf-readiness-steps" aria-label="Next steps">
          {readiness.nextSteps.map((item) => (
            <li key={item.key}>
              <Link href={item.href}>
                <span className="lf-readiness-step-icon" aria-hidden="true"><Icon name="add" size={18} /></span>
                <span><strong>{item.hint ?? item.addLabel}</strong><small>{item.label}</small></span>
                <Icon name="chevron_right" size={20} />
              </Link>
            </li>
          ))}
        </ol>
      ) : null}
      <button type="button" className="lf-readiness-toggle" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((value) => !value)}>
        {open ? "Hide what counts" : "See what counts"}<Icon name={open ? "expand_less" : "expand_more"} size={20} />
      </button>
      {open ? (
        <ul id={listId} className="lf-readiness-items">
          {readiness.items.map((item) => <ReadinessRow key={item.key} item={item} busy={busyKey === item.key} onNotApplicable={onNotApplicable} />)}
        </ul>
      ) : null}
    </section>
  );
}

function ReadinessRow({ item, busy, onNotApplicable }: { item: ReadinessItemState; busy: boolean; onNotApplicable: (key: ReadinessKey, notApplicable: boolean) => void }) {
  const status = item.notApplicable ? "Doesn't apply" : item.done >= 1 ? "Done" : item.done > 0 ? item.hint ?? "Started" : "Not added yet";
  const icon = item.notApplicable ? "remove" : item.done >= 1 ? "check_circle" : item.done > 0 ? "timelapse" : "radio_button_unchecked";
  return (
    <li className={item.done >= 1 ? "is-done" : item.notApplicable ? "is-na" : undefined}>
      <Icon name={icon} size={20} />
      <span className="lf-readiness-item-copy"><strong>{item.label}</strong><small>{status}</small></span>
      {item.done === 0 ? (
        <button type="button" disabled={busy} onClick={() => onNotApplicable(item.key, !item.notApplicable)}>
          {busy ? "Saving…" : item.notApplicable ? "It applies" : item.notApplicableLabel}
        </button>
      ) : null}
    </li>
  );
}
