"use client";

import Link from "next/link";
import { useId, useState } from "react";
import Icon from "../../../../components/ui/Icon";
import type { Readiness, ReadinessItemState, ReadinessKey } from "../../../../lib/readiness/score";

/**
 * "Your Vault is 70% ready" with the next steps (owner decision 18 Nov 2026). Owner only. Encouraging:
 * no red, no "incomplete"; each item can be marked "Doesn't apply" and comes off the total.
 *
 * Slim by default (owner, 27 Nov 2026): one line ("63% ready · 3 next steps") that opens on tap, so it no longer
 * takes a third of a phone screen. "Hide this" moves it to a short line at the bottom of Home.
 */
export default function ReadinessCard({ readiness, busyKey, onNotApplicable, onHide }: {
  readiness: Readiness;
  busyKey: ReadinessKey | null;
  onNotApplicable: (key: ReadinessKey, notApplicable: boolean) => void;
  onHide?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const listId = useId();
  const drawerId = `${listId}-drawer`;
  const stepCount = readiness.nextSteps.length;
  const summary = `${readiness.percent}% ready${stepCount ? ` · ${stepCount} next step${stepCount === 1 ? "" : "s"}` : ""}`;
  return (
    <section className={`lf-readiness-card is-slim${drawerOpen ? " is-open" : ""}`} aria-label="Vault readiness">
      <button type="button" className="lf-readiness-line" aria-expanded={drawerOpen} aria-controls={drawerId} onClick={() => setDrawerOpen((value) => !value)}>
        <ReadinessRing percent={readiness.percent} />
        <span className="lf-readiness-line-copy"><strong>Your Vault is {summary}</strong></span>
        <Icon name={drawerOpen ? "expand_less" : "expand_more"} size={22} />
      </button>
      {drawerOpen ? (
        <div id={drawerId} className="lf-readiness-drawer">
          <div className="lf-readiness-bar" role="progressbar" aria-label="Vault readiness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={readiness.percent}>
            <span style={{ width: `${readiness.percent}%` }} />
          </div>
          {stepCount ? (
            /* Each step names the document or person and opens the exact place to act (owner, 18 Nov 2026). */
            <ol className="lf-readiness-steps" aria-label="Next steps">
              {readiness.nextSteps.map((item) => (
                <li key={item.key}>
                  <Link href={item.href} aria-label={`${item.actionTitle}${item.subject ? `: ${item.subject}` : ""}`}>
                    <span className="lf-readiness-step-icon" aria-hidden="true"><Icon name={item.icon} size={22} /></span>
                    <span className="lf-readiness-step-copy">
                      <small>{item.subject ? `${item.label} · ${item.subject}` : item.label}</small>
                      <strong>{item.actionTitle}</strong>
                    </span>
                    <Icon name="chevron_right" size={22} />
                  </Link>
                </li>
              ))}
            </ol>
          ) : null}
          <div className="lf-readiness-drawer-actions">
            <button type="button" className="lf-readiness-toggle" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((value) => !value)}>
              {open ? "Hide what counts" : "See what counts"}<Icon name={open ? "expand_less" : "expand_more"} size={20} />
            </button>
            {onHide ? (
              <button type="button" className="lf-readiness-toggle" onClick={onHide}>
                <Icon name="visibility_off" size={20} />Hide this
              </button>
            ) : null}
          </div>
          {open ? (
            <ul id={listId} className="lf-readiness-items">
              {readiness.items.map((item) => <ReadinessRow key={item.key} item={item} busy={busyKey === item.key} onNotApplicable={onNotApplicable} />)}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** The small progress ring at the start of the slim line. */
function ReadinessRing({ percent }: { percent: number }) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <span className="lf-readiness-ring" aria-hidden="true" style={{ background: `conic-gradient(#2F8A4E ${value * 3.6}deg, #E6F2EA 0deg)` }}>
      <span>{value}%</span>
    </span>
  );
}

/** Same height as the slim line, shown while the score loads, so nothing on Home jumps when it arrives. */
export function ReadinessPlaceholder() {
  return <div className="lf-readiness-card is-slim is-placeholder" aria-hidden="true"><span className="lf-readiness-ring" /><span className="lf-readiness-placeholder-bar" /></div>;
}

/** Where a hidden card waits: a short line at the bottom of Home that brings it back. */
export function ReadinessHiddenLine({ percent, onShow }: { percent: number; onShow: () => void }) {
  return (
    <button type="button" className="lf-readiness-hidden-line" onClick={onShow}>
      <Icon name="checklist" size={20} />
      <span>Your Vault is {Math.round(percent)}% ready</span>
      <strong>Show next steps</strong>
    </button>
  );
}

function ReadinessRow({ item, busy, onNotApplicable }: { item: ReadinessItemState; busy: boolean; onNotApplicable: (key: ReadinessKey, notApplicable: boolean) => void }) {
  const status = item.notApplicable ? "Doesn't apply" : item.done >= 1 ? "Done" : item.done > 0 ? item.hint ?? "Started" : "Not added yet";
  const icon = item.notApplicable ? "remove" : item.done >= 1 ? "check_circle" : item.done > 0 ? "timelapse" : "radio_button_unchecked";
  return (
    <li className={item.done >= 1 ? "is-done" : item.notApplicable ? "is-na" : undefined}>
      <Icon name={icon} size={20} />
      {item.done < 1 && !item.notApplicable
        ? <Link className="lf-readiness-item-copy" href={item.href}><strong>{item.label}</strong><small>{status}</small></Link>
        : <span className="lf-readiness-item-copy"><strong>{item.label}</strong><small>{status}</small></span>}
      {item.done === 0 ? (
        <button type="button" disabled={busy} onClick={() => onNotApplicable(item.key, !item.notApplicable)}>
          {busy ? "Saving…" : item.notApplicable ? "It applies" : item.notApplicableLabel}
        </button>
      ) : null}
    </li>
  );
}
