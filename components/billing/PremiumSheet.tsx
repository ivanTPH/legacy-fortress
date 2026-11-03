"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon";
import { PREMIUM_SHEET_COPY, addDocumentPack, loadBillingStatus, startCheckout, type PremiumReason } from "../../lib/billing/client";

/**
 * The "Premium only" sheet (plans report, upgrade journey; website artboard Upgrade.dc.html). Opens where a
 * limit is hit, says what that action needs, and always offers Not now. Nothing is lost by saying no.
 */
export default function PremiumSheet() {
  const [reason, setReason] = useState<PremiumReason | null>(null);
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [trialAvailable, setTrialAvailable] = useState(true);
  const [planInterval, setPlanInterval] = useState<"month" | "year">("month");
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const returnFocus = useRef<Element | null>(null);

  useEffect(() => {
    const onRequest = (event: Event) => {
      const next = (event as CustomEvent<{ reason?: PremiumReason }>).detail?.reason ?? "records";
      returnFocus.current = document.activeElement;
      setReason(PREMIUM_SHEET_COPY[next] ? next : "records");
      setError(""); setToast(""); setBusy(false);
      void loadBillingStatus().then((status) => { if (status) { setTrialAvailable(status.trialAvailable); setPlanInterval(status.interval === "year" ? "year" : "month"); } });
    };
    window.addEventListener("lf:premium-required", onRequest);
    return () => window.removeEventListener("lf:premium-required", onRequest);
  }, []);

  const close = useCallback((message = "") => {
    setReason(null);
    if (message) setToast(message);
    (returnFocus.current as HTMLElement | null)?.focus?.();
  }, []);

  useEffect(() => {
    if (!reason) return;
    titleRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close("No problem. Nothing has changed, and you can upgrade any time from Settings."); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close, reason]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function start() {
    setBusy(true); setError("");
    const problem = await startCheckout(interval);
    if (problem) { setError(problem); setBusy(false); }
  }

  // Premium members at their document allowance: add 100 more to the existing subscription.
  async function addPack() {
    setBusy(true); setError("");
    const result = await addDocumentPack();
    if (!result.ok) { setError(result.message); setBusy(false); return; }
    setBusy(false);
    close(`${result.message} Try your upload again.`);
  }
  const isPack = reason === "documentPack";
  const packPrice = planInterval === "year" ? "£12 a year" : "£1 a month";

  const copy = reason ? PREMIUM_SHEET_COPY[reason] : null;
  return <>
    {copy ? <div className="lf-premium-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) close("No problem. Nothing has changed, and you can upgrade any time from Settings."); }}>
      <div className="lf-premium-sheet" role="dialog" aria-modal="true" aria-labelledby="lf-premium-title">
        <span className="lf-premium-grabber" aria-hidden="true" />
        <span className="lf-premium-badge">{isPack ? "Documents" : "Premium"}</span>
        <h2 id="lf-premium-title" ref={titleRef} tabIndex={-1}>{copy.title}</h2>
        <p className="lf-premium-body">{copy.body}</p>
        {isPack ? <>
          <p className="lf-premium-fine">{`+100 documents for ${packPrice}, added to your subscription. Charged pro rata from today.`}</p>
          {error ? <p className="lf-premium-error" role="alert">{error}</p> : null}
          <button type="button" className="lf-premium-primary" disabled={busy} onClick={() => void addPack()}>{busy ? "Adding…" : `Add 100 documents · ${packPrice}`}</button>
        </> : <>
        <div className="lf-premium-options" role="radiogroup" aria-label="Billing period">
          <button type="button" role="radio" aria-checked={interval === "month"} className={interval === "month" ? "is-selected" : ""} onClick={() => setInterval("month")}>
            <span><strong>Monthly</strong><small>£3.99 a month</small></span><span className="lf-premium-dot" aria-hidden="true" />
          </button>
          <button type="button" role="radio" aria-checked={interval === "year"} className={interval === "year" ? "is-selected" : ""} onClick={() => setInterval("year")}>
            <span><strong>Yearly · 2 months free</strong><small>£39 a year</small></span><span className="lf-premium-dot" aria-hidden="true" />
          </button>
        </div>
        <p className="lf-premium-fine">{trialAvailable ? `14 days free, then ${interval === "year" ? "£39 a year" : "£3.99 a month"}. Cancel any time.` : `${interval === "year" ? "£39 a year" : "£3.99 a month"}. Cancel any time.`}</p>
        {error ? <p className="lf-premium-error" role="alert">{error}</p> : null}
        <button type="button" className="lf-premium-primary" disabled={busy} onClick={() => void start()}>{busy ? "Opening secure payment…" : trialAvailable ? "Start free trial" : "Upgrade to Premium"}</button>
        </>}
        <button type="button" className="lf-premium-secondary" onClick={() => close("No problem. Nothing has changed, and you can upgrade any time from Settings.")}>Not now</button>
        <p className="lf-premium-safe"><Icon name="lock" size={16} />Your records are safe on any plan, and your family can always reach them.</p>
      </div>
    </div> : null}
    {toast ? <p className="lf-premium-toast" role="status">{toast}</p> : null}
  </>;
}
