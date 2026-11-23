"use client";

import { useCallback, useEffect, useState } from "react";
import { tellStaff } from "@/lib/staffAlertClient";
import Icon from "@/components/ui/Icon";
import { supabase } from "@/lib/supabaseClient";
import { waitForActiveUser } from "@/lib/auth/session";
import { loadHelpThreads, type HelpThread } from "@/lib/support/helpThreads";

/**
 * Partner Portal Help (UX review 2, 23 Nov 2026): common partner questions and Contact us. A message goes to the
 * Admin Inbox like any Help message (marked as from the Partner Portal) and our reply shows here.
 */
export const PARTNER_QUESTIONS: Array<{ id: string; q: string; a: string }> = [
  { id: "how-join", q: "How do people join on our licence?", a: "Share your sign-up link or QR code (Overview › Get started). Everyone who joins with it gets Premium at no cost to them, up to your licence limit." },
  { id: "limit", q: "What happens when we reach the limit?", a: "People who join after that become Legacy Fortress customers on the Free plan, and can choose Premium themselves. You’ll see a warning at 80% and 95% of your limit." },
  { id: "privacy", q: "What can we see about our members?", a: "How many have joined, and the anonymous mix of what their Vaults hold, as percentages for groups of 5 or more. Never names, records, values or documents." },
  { id: "invoice", q: "How is the licence paid?", a: "Legacy Fortress invoices you for the number of users. When the payment clears we activate the licence and your link works up to that number." },
  { id: "ends", q: "What if our agreement ends?", a: "Your members keep their Vaults. They’re told the arrangement has ended and choose to stay on Free or go Premium themselves." },
];

const TOPICS = ["Licence and invoice", "Sign-up links and joining", "Team and seats", "Something else"] as const;

export default function PartnerHelp({ organisationId }: { organisationId?: string | null }) {
  const [open, setOpen] = useState<string>(PARTNER_QUESTIONS[0].id);
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [threads, setThreads] = useState<HelpThread[]>([]);
  const refresh = useCallback(() => { void loadHelpThreads("partner_portal").then(setThreads).catch(() => setThreads([])); }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function send() {
    if (!topic || !message.trim()) { setError("Choose what it’s about and write your message."); return; }
    setSending(true); setError("");
    try {
      const user = await waitForActiveUser(supabase, { attempts: 4, delayMs: 100 });
      if (!user) throw new Error("signed_out");
      const { error: insertError } = await supabase.from("section_entries").insert({
        user_id: user.id,
        section_key: "support",
        category_key: "help_requests",
        title: `Partner: ${topic}`,
        summary: message.trim().slice(0, 4000),
        estimated_value: 0,
        details: { request_type: topic, source: "partner_portal", organisation_id: organisationId ?? null },
        updated_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;
      setSent(true); setMessage(""); setTopic("");
      refresh();
      void tellStaff("help_message");
    } catch {
      setError("That didn’t send. Please try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="lf-help lf-partner-help">
      <section aria-labelledby="partner-questions">
        <h2 id="partner-questions">Common questions</h2>
        <div className="lf-help-list">
          {PARTNER_QUESTIONS.map((item) => (
            <div key={item.id} className="lf-help-item">
              <button type="button" className="lf-help-q" aria-expanded={open === item.id} aria-controls={`partner-a-${item.id}`} onClick={() => setOpen(open === item.id ? "" : item.id)}>
                <span>{item.q}</span><Icon name={open === item.id ? "expand_less" : "expand_more"} size={22} />
              </button>
              {open === item.id ? <p id={`partner-a-${item.id}`} className="lf-help-a">{item.a}</p> : null}
            </div>
          ))}
        </div>
      </section>

      {threads.length ? (
        <section className="lf-help-messages" aria-labelledby="partner-messages" id="messages">
          <h2 id="partner-messages">Your messages</h2>
          <ul className="lf-help-thread-list">
            {threads.map((thread) => (
              <li key={thread.id} className="lf-help-thread">
                <p className="lf-help-thread-head"><strong>{thread.topic.replace(/^Partner: /, "")}</strong><time dateTime={thread.at}>{shortDate(thread.at)}</time></p>
                <p className="lf-help-thread-text">{thread.text}</p>
                {thread.replies.length ? thread.replies.map((reply) => (
                  <div key={reply.id} className={`lf-help-reply${reply.isNew ? " is-new" : ""}`}>
                    <p className="lf-help-thread-head"><strong><Icon name="reply" size={16} />Legacy Fortress replied{reply.isNew ? <span className="lf-help-new">New</span> : null}</strong><time dateTime={reply.at}>{shortDate(reply.at)}</time></p>
                    <p className="lf-help-thread-text">{reply.text}</p>
                  </div>
                )) : <p className="lf-help-muted">Waiting for our reply.</p>}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="lf-help-contact" aria-labelledby="partner-contact">
        <h2 id="partner-contact">Contact us</h2>
        <p className="lf-help-muted">Our reply appears here, usually within 1 working day. Never include members’ personal details.</p>
        {sent ? <p role="status" className="lf-help-sent"><Icon name="check_circle" size={20} />Thanks. We’ve got your message.</p> : null}
        <label className="lf-help-field">What’s it about?
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            <option value="">Choose…</option>
            {TOPICS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="lf-help-field">Message
          <textarea rows={5} maxLength={4000} value={message} onChange={(event) => setMessage(event.target.value)} />
        </label>
        {error ? <p role="alert" className="lf-help-error">{error}</p> : null}
        <div><button type="button" className="lf-help-send" disabled={sending} onClick={() => void send()}>{sending ? "Sending…" : "Send message"}</button></div>
      </section>
    </div>
  );
}

function shortDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
