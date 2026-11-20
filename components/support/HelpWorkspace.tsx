"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "../ui/Icon";
import { supabase } from "../../lib/supabaseClient";
import { waitForActiveUser } from "../../lib/auth/session";

/**
 * Help (owner-approved design "Help and info buttons", UX review Stage 4): search, Set up with me, the tour,
 * common questions, and Contact us. Replaces the old Support page, which read like a staff tool.
 * Messages are kept as before (section_entries · support/help_requests) and now also appear in the Admin Inbox.
 */
export const HELP_QUESTIONS: Array<{ id: string; q: string; a: string }> = [
  { id: "who-sees", q: "Who can see my Vault?", a: "Only you, unless you choose to share. Adding someone, inviting them or their ID check never opens anything on its own. You choose exactly which records each person can see." },
  { id: "after-death", q: "What happens after I die?", a: "The people you’ve nominated get the access you chose, and only after the death has been reported, checked and probate confirmed. Until then, nominating someone shows them nothing." },
  { id: "executor", q: "What is an executor?", a: "The person your Will names to sort out your estate: paying debts, dealing with banks and passing things on. You can add your executors in People and give them access to the records they’ll need." },
  { id: "plans", q: "What’s free and what’s Premium?", a: "Free holds 2 records of each kind (up to 6 in all), 10 documents and 1 person nominated for after your death. Premium is £3.99 a month or £39 a year: unlimited records, 100 documents, sharing records now and as many nominations as you like. Premium starts with 14 days free." },
  { id: "new-phone", q: "How do I sign in on a new phone?", a: "Sign in with your email and password as usual. Because it’s a new phone or computer, we’ll send a short code to check it’s you. Tick Remember this device and you won’t be asked again on that device." },
  { id: "add-document", q: "How do I add a document?", a: "Open the record it belongs to, for example your Will or a bank account, and choose Add document. On a phone you can take a photo. A PDF with several pages counts as one document." },
  { id: "invite", q: "How do I invite someone?", a: "Go to People, add the person, then choose Invite. They get an email asking them to join. Inviting them doesn’t show them anything: you choose what they can see separately." },
  { id: "safe", q: "Is my information safe?", a: "Your Vault is private to you. Sign-in needs your password and, on a new device, a code. Files are only opened through short-lived links, and every access is recorded." },
];

type Thread = { id: string; topic: string; text: string; at: string; replies: Array<{ id: string; text: string; at: string; isNew: boolean }> };

/** The person's own messages to us and our replies (stage 3, 20 Nov 2026). Opening Help marks replies as read. */
async function loadThreads(): Promise<Thread[]> {
  const user = await waitForActiveUser(supabase, { attempts: 4, delayMs: 100 });
  if (!user) return [];
  const { data, error } = await supabase.from("section_entries").select("id,category_key,title,summary,details,created_at")
    .eq("user_id", user.id).eq("section_key", "support").in("category_key", ["help_requests", "help_replies"])
    .order("created_at", { ascending: true }).limit(200);
  if (error) return [];
  type Row = { id: string; category_key: string; title: string | null; summary: string | null; details: Record<string, unknown> | null; created_at: string };
  const rows = (data ?? []) as Row[];
  const threads = new Map<string, Thread>();
  for (const row of rows.filter((item) => item.category_key === "help_requests")) {
    threads.set(row.id, { id: row.id, topic: String(row.title ?? "Message"), text: String(row.summary ?? ""), at: row.created_at, replies: [] });
  }
  const unread: Row[] = [];
  for (const row of rows.filter((item) => item.category_key === "help_replies")) {
    const thread = threads.get(String(row.details?.reply_to ?? ""));
    if (!thread) continue;
    const isNew = !row.details?.read_at;
    if (isNew) unread.push(row);
    thread.replies.push({ id: row.id, text: String(row.summary ?? ""), at: row.created_at, isNew });
  }
  const readAt = new Date().toISOString();
  await Promise.all(unread.map((row) => supabase.from("section_entries").update({ details: { ...(row.details ?? {}), read_at: readAt } }).eq("id", row.id)));
  return [...threads.values()].reverse().slice(0, 10);
}

const TOPICS = ["Setting up my Vault", "Someone has died", "Billing and my plan", "Security or privacy", "Something else"] as const;

export default function HelpWorkspace() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string>(HELP_QUESTIONS[0].id);
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [threads, setThreads] = useState<Thread[]>([]);
  const refreshThreads = useCallback(() => { void loadThreads().then(setThreads).catch(() => setThreads([])); }, []);
  useEffect(() => { refreshThreads(); }, [refreshThreads]);

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return HELP_QUESTIONS;
    return HELP_QUESTIONS.filter((item) => `${item.q} ${item.a}`.toLowerCase().includes(term));
  }, [search]);

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
        title: topic,
        summary: message.trim().slice(0, 4000),
        estimated_value: 0,
        details: { request_type: topic, source: "help_page" },
        updated_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;
      setSent(true); setMessage(""); setTopic("");
      refreshThreads();
    } catch {
      setError("That didn’t send. Please try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="lf-help">
      <label className="lf-help-search">
        <Icon name="search" size={20} />
        <span className="lf-visually-hidden">Search Help</span>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search, e.g. “executor”" />
      </label>

      {!search ? (
        <div className="lf-help-cards">
          <Link href="/onboarding?again=1&step=welcome" className="lf-help-card"><Icon name="assistant_navigation" size={24} /><strong>Set up with me</strong><span>The 5-minute guide</span></Link>
          <a href="/how-it-works" className="lf-help-card"><Icon name="play_circle" size={24} /><strong>Watch the tour</strong><span>1 minute, with voice</span></a>
        </div>
      ) : null}

      <section aria-labelledby="help-questions">
        <h2 id="help-questions">{search ? (results.length ? "Answers" : "No answers found") : "Common questions"}</h2>
        {results.length ? (
          <div className="lf-help-list">
            {results.map((item) => {
              const expanded = Boolean(search) || open === item.id;
              return (
                <div key={item.id} className="lf-help-item">
                  <button type="button" className="lf-help-q" aria-expanded={expanded} aria-controls={`help-a-${item.id}`} onClick={() => setOpen(open === item.id ? "" : item.id)}>
                    <span>{item.q}</span><Icon name={expanded ? "expand_less" : "expand_more"} size={22} />
                  </button>
                  {expanded ? <p id={`help-a-${item.id}`} className="lf-help-a">{item.a}</p> : null}
                </div>
              );
            })}
          </div>
        ) : <p className="lf-help-muted">Try another word, or send us a message below.</p>}
      </section>

      {threads.length ? (
        <section className="lf-help-messages" aria-labelledby="help-messages" id="messages">
          <h2 id="help-messages">Your messages</h2>
          <ul className="lf-help-thread-list">
            {threads.map((thread) => (
              <li key={thread.id} className="lf-help-thread">
                <p className="lf-help-thread-head"><strong>{thread.topic}</strong><time dateTime={thread.at}>{shortDate(thread.at)}</time></p>
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

      <section className="lf-help-contact" aria-labelledby="help-contact" id="contact">
        <h2 id="help-contact">Contact us</h2>
        {sent ? (
          <p role="status" className="lf-help-sent"><Icon name="check_circle" size={20} />Thanks. We’ve got your message. Our reply will appear here and in your Inbox, usually within 1 working day.</p>
        ) : (
          <>
            <p className="lf-help-muted">Still stuck? Send us a message. Our reply appears here and in your Inbox, usually within 1 working day.</p>
            <label className="lf-help-field">What’s it about?
              <select value={topic} onChange={(event) => setTopic(event.target.value)}>
                <option value="">Choose one</option>
                {TOPICS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="lf-help-field">Message
              <textarea rows={5} value={message} onChange={(event) => setMessage(event.target.value)} />
            </label>
            <p className="lf-help-muted">Please don’t include passwords, account numbers or ID documents.</p>
            {error ? <p className="lf-help-error" role="alert">{error}</p> : null}
            <div><button type="button" className="lf-help-send" disabled={sending} onClick={() => void send()}>{sending ? "Sending…" : "Send message"}</button></div>
          </>
        )}
      </section>
    </div>
  );
}

function shortDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
