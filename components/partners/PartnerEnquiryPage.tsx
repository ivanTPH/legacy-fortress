"use client";

import Link from "next/link";
import { useState } from "react";
import BrandMark from "../../app/(app)/components/BrandMark";
import Icon from "../ui/Icon";
import { MEMBER_BANDS, ORGANISATION_TYPES } from "@/lib/partners/enquiries";

/**
 * "Become a partner" (owner decision 23 Nov 2026): how a partner licence works, and an enquiry form that reaches
 * the Legacy Fortress team (Admin Inbox). No account needed; nothing is paid here.
 */
const STEPS = [
  { icon: "forum", title: "Tell us about your organisation", text: "Send this form. We’ll call or email within 1 working day to talk it through." },
  { icon: "request_quote", title: "Agree the number of members", text: "You choose how many people to cover. We send an invoice for the year." },
  { icon: "verified", title: "We switch on your licence", text: "When the invoice is paid we set up your Partner Portal and invite your lead person." },
  { icon: "qr_code_2", title: "Share your sign-up link", text: "Send the link, QR code or ready-made email. Everyone who joins gets Premium free." },
];

export default function PartnerEnquiryPage() {
  const [form, setForm] = useState({ organisationName: "", organisationType: "", contactName: "", contactEmail: "", contactPhone: "", membersEstimate: "", message: "", website: "" });
  const [agree, setAgree] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function send() {
    if (!agree) { setError("Tick the box to say we may contact you about this."); return; }
    setSending(true); setError("");
    try {
      const res = await fetch("/api/partners/enquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) { setError(json.message || "That didn’t send. Please try again."); return; }
      setSent(true);
    } catch {
      setError("That didn’t send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="lf-partners-page">
      <header className="lf-partners-top">
        <Link href="/" className="lf-partners-brand"><BrandMark size={32} /><strong>Legacy Fortress</strong></Link>
        <Link href="/sign-in" className="lf-inline-link">Sign in</Link>
      </header>
      <section className="lf-partners-hero">
        <p className="lf-partners-eyebrow">For organisations</p>
        <h1>Give your people Legacy Fortress Premium</h1>
        <p>Employers, advisers, law firms and membership bodies buy a licence for their people. Each person keeps a private Vault for their records, documents and wishes. You see how many joined, never what they keep.</p>
      </section>
      <ol className="lf-partners-steps">
        {STEPS.map((step, index) => (
          <li key={step.title}><span className="lf-partners-step-icon"><Icon name={step.icon} size={22} /></span><div><strong>{index + 1}. {step.title}</strong><p>{step.text}</p></div></li>
        ))}
      </ol>
      <section className="lf-partners-form" aria-labelledby="partner-form-title">
        <h2 id="partner-form-title">Become a partner</h2>
        {sent ? (
          <p role="status" className="lf-partners-sent"><Icon name="check_circle" size={22} />Thanks. We’ve got your details and will be in touch within 1 working day.</p>
        ) : (
          <>
            <div className="lf-partners-grid">
              <label>Organisation name<input value={form.organisationName} onChange={set("organisationName")} autoComplete="organization" required /></label>
              <label>Type of organisation<select value={form.organisationType} onChange={set("organisationType")}><option value="">Choose…</option>{ORGANISATION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
              <label>Your name<input value={form.contactName} onChange={set("contactName")} autoComplete="name" required /></label>
              <label>Work email<input type="email" value={form.contactEmail} onChange={set("contactEmail")} autoComplete="email" required /></label>
              <label>Phone (optional)<input type="tel" value={form.contactPhone} onChange={set("contactPhone")} autoComplete="tel" /></label>
              <label>How many people would you cover?<select value={form.membersEstimate} onChange={set("membersEstimate")}><option value="">Choose…</option>{MEMBER_BANDS.map((band) => <option key={band.value} value={band.value}>{band.label}</option>)}</select></label>
            </div>
            <label>Anything we should know? (optional)<textarea rows={4} maxLength={4000} value={form.message} onChange={set("message")} /></label>
            <label className="lf-partners-hp" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} /></label>
            <label className="lf-partners-check"><input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} /> Legacy Fortress may contact me about a partner licence.</label>
            {error ? <p role="alert" className="lf-partners-error">{error}</p> : null}
            <button type="button" className="lf-partners-send" disabled={sending} onClick={() => void send()}>{sending ? "Sending…" : "Send enquiry"}</button>
          </>
        )}
      </section>
    </main>
  );
}
