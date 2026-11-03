"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SettingsPageShell } from "../../components/settings/SettingsPrimitives";
import Icon from "../../../../components/ui/Icon";
import { loadBillingStatus, openBillingPortal, startCheckout, type BillingStatus } from "../../../../lib/billing/client";

/**
 * Settings › Billing (plans report, 3 Nov 2026). Shows the plan the server holds; upgrading opens Stripe Checkout
 * and managing opens Stripe's portal. Nothing on this page can change a plan directly.
 */
export default function BillingPage() {
  return <Suspense fallback={null}><BillingPageContent /></Suspense>;
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value)) : "";
}

function BillingPageContent() {
  const searchParams = useSearchParams();
  const checkout = searchParams.get("checkout");
  const reason = searchParams.get("reason") ?? "";
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    let tries = 0;
    const load = async () => {
      const next = await loadBillingStatus();
      if (!active) return;
      setStatus(next); setLoaded(true);
      // Back from Checkout: Stripe confirms to the server a moment later; check again briefly.
      if (checkout === "success" && next?.plan !== "premium" && tries < 6) { tries += 1; window.setTimeout(() => void load(), 2500); }
    };
    void load();
    return () => { active = false; };
  }, [checkout]);

  async function upgrade() {
    setBusy("upgrade"); setMessage("");
    const problem = await startCheckout(interval, "/account/billing");
    if (problem) { setMessage(problem); setBusy(""); }
  }
  async function manage() {
    setBusy("manage"); setMessage("");
    const problem = await openBillingPortal();
    if (problem) { setMessage(problem); setBusy(""); }
  }

  const premium = status?.plan === "premium";
  return (
    <SettingsPageShell title="Billing" subtitle="Your plan and payments." compact>
      {checkout === "success" ? <p className="lf-billing-banner is-good" role="status">{premium ? "Welcome to Premium. Thank you." : "Payment received. Your plan updates in a moment."}</p> : null}
      {checkout === "cancelled" ? <p className="lf-billing-banner" role="status">No payment was taken. You’re still on the free plan.</p> : null}
      {reason === "plan-limit" && !premium ? <p className="lf-billing-banner" role="status">You’ve reached a free plan limit. Nothing has been lost.</p> : null}
      {status?.mode === "test" ? <p className="lf-billing-banner is-test" role="note">Test payments only. Use card 4242 4242 4242 4242, any future date and any CVC. No money moves.</p> : null}

      <section className="lf-sec-group" aria-labelledby="billing-plan">
        <h2 id="billing-plan">Your plan</h2>
        <div className="lf-sec-card lf-billing-card">
          {!loaded ? <p className="lf-billing-muted" role="status">Loading…</p> : premium ? <>
            <div className="lf-billing-plan"><strong>Premium</strong><span className="lf-billing-chip">{status?.status === "trialing" ? "Free trial" : status?.status === "past_due" ? "Payment due" : "Active"}</span></div>
            <p className="lf-billing-muted">
              {status?.status === "trialing" && status.trialEndsAt ? `Your free trial ends on ${formatDate(status.trialEndsAt)}. ` : ""}
              {status?.cancelAtPeriodEnd ? `Premium ends on ${formatDate(status.renewsAt)}; you'll then move to Free and nothing is deleted.` : status?.renewsAt ? `${status.interval === "year" ? "£39 a year" : "£3.99 a month"}, next payment ${formatDate(status.renewsAt)}.` : ""}
            </p>
            {status?.status === "past_due" ? <p className="lf-billing-warn">Your last payment didn’t go through. Update your card to keep Premium.</p> : null}
            <button type="button" className="lf-sg-secondary" disabled={Boolean(busy) || !status?.canManage} onClick={() => void manage()}>{busy === "manage" ? "Opening…" : "Manage subscription"}</button>
            <p className="lf-billing-muted">Change card, switch between monthly and yearly, see invoices or cancel.</p>
          </> : <>
            <div className="lf-billing-plan"><strong>Free</strong></div>
            <ul className="lf-billing-list">
              <li>2 of each kind of record, up to 6 in all</li>
              <li>Share with 1 person</li>
              <li>Wills, Power of Attorney, executors and release to your family</li>
              <li>ID checks, two-step sign-in and an audit trail</li>
            </ul>
          </>}
        </div>
      </section>

      {loaded && !premium ? <section className="lf-sec-group" aria-labelledby="billing-premium">
        <h2 id="billing-premium">Premium</h2>
        <div className="lf-sec-card lf-billing-card">
          <ul className="lf-billing-list">
            <li>Unlimited records and 20 GB for documents</li>
            <li>Share with as many people as you like</li>
            <li>Advisers can suggest documents for you to approve</li>
            <li>Full record history, weekly summaries and priority support</li>
          </ul>
          <div className="lf-premium-options" role="radiogroup" aria-label="Billing period">
            <button type="button" role="radio" aria-checked={interval === "month"} className={interval === "month" ? "is-selected" : ""} onClick={() => setInterval("month")}><span><strong>Monthly</strong><small>£3.99 a month</small></span><span className="lf-premium-dot" aria-hidden="true" /></button>
            <button type="button" role="radio" aria-checked={interval === "year"} className={interval === "year" ? "is-selected" : ""} onClick={() => setInterval("year")}><span><strong>Yearly · 2 months free</strong><small>£39 a year</small></span><span className="lf-premium-dot" aria-hidden="true" /></button>
          </div>
          <p className="lf-billing-muted">{status?.trialAvailable ? "14 days free. " : ""}Prices include VAT. Cancel any time.</p>
          <button type="button" className="lf-premium-primary" disabled={Boolean(busy) || status?.mode === "not_configured"} onClick={() => void upgrade()}>{busy === "upgrade" ? "Opening secure payment…" : status?.trialAvailable ? "Start free trial" : "Upgrade to Premium"}</button>
          {status?.mode === "not_configured" ? <p className="lf-billing-muted">Payments aren’t switched on yet.</p> : null}
          <p className="lf-premium-safe"><Icon name="lock" size={16} />Payments are handled by Stripe. Your card details never reach Legacy Fortress.</p>
        </div>
      </section> : null}
      {message ? <p className="lf-sec-status" role="alert">{message}</p> : null}
    </SettingsPageShell>
  );
}
