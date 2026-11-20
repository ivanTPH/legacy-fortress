"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";

/**
 * Reply to a Help message from the Admin Inbox (stage 3, 20 Nov 2026). The reply shows on the customer's Help page
 * and in their Inbox; if they have a real email address they also get a short email saying a reply is waiting.
 */
export default function HelpReplyForm({ messageId, replies, authFetch, onSent }: {
  messageId: string;
  replies: number;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  onSent?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(replies);

  async function send() {
    if (!text.trim()) { setNote("Write a reply first."); return; }
    setSending(true); setNote("");
    try {
      const res = await authFetch("/api/internal/admin/help-reply", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId, text }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; emailed?: boolean };
      if (!res.ok || !json.ok) { setNote(json.message || "The reply didn’t send. Try again."); return; }
      setSent((count) => count + 1); setText(""); setOpen(false);
      setNote(json.emailed ? "Reply sent. We’ve emailed them to say it’s waiting." : "Reply sent. They’ll see it in Help and their Inbox.");
      onSent?.();
    } catch {
      setNote("The reply didn’t send. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="lf-admin-reply">
      {!open ? (
        <div className="lf-admin-reply-row">
          {sent ? <span className="lf-admin-reply-done"><Icon name="reply" size={16} />Replied{sent > 1 ? ` ${sent} times` : ""}</span> : null}
          <button type="button" className="lf-admin-row-button" onClick={() => { setOpen(true); setNote(""); }}><Icon name="reply" size={18} />{sent ? "Reply again" : "Reply"}</button>
          {note ? <span role="status" className="lf-admin-reply-note">{note}</span> : null}
        </div>
      ) : (
        <div className="lf-admin-reply-form">
          <label>
            <span className="lf-visually-hidden">Your reply</span>
            <textarea rows={4} value={text} maxLength={4000} onChange={(event) => setText(event.target.value)} placeholder="Write your reply. Never ask for passwords or ID documents." autoFocus />
          </label>
          {note ? <p role="alert" className="lf-admin-reply-note">{note}</p> : null}
          <div className="lf-admin-reply-row">
            <button type="button" className="lf-admin-primary-button" disabled={sending} onClick={() => void send()}>{sending ? "Sending…" : "Send reply"}</button>
            <button type="button" className="lf-admin-row-button" disabled={sending} onClick={() => { setOpen(false); setNote(""); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
