"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";

type Action = "resend_confirmation" | "password_reset" | "sign_out_everywhere";

const ACTIONS: Array<{ key: Action; label: string; icon: string; confirm: string }> = [
  { key: "resend_confirmation", label: "Resend confirmation email", icon: "mark_email_unread", confirm: "We’ll send the sign-up confirmation email again to the address on the account." },
  { key: "password_reset", label: "Send password reset link", icon: "lock_reset", confirm: "We’ll email a password reset link to the address on the account. You won’t see the link." },
  { key: "sign_out_everywhere", label: "Sign out on every device", icon: "devices_off", confirm: "Every device signed in to this account will be signed out within the hour, and remembered devices are forgotten. Their password and Vault are unchanged. We’ll email them to say so." },
];

/**
 * Support actions on a customer (owner decision 20 Nov 2026): low-risk sign-in help only, each with a reason that
 * goes in the audit log. Shown to admins with support:manage; the server checks again.
 */
export default function SupportActionsPanel({ userId, emailConfirmed, deliverable, authFetch }: {
  userId: string;
  emailConfirmed: boolean;
  deliverable: boolean;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
}) {
  const [open, setOpen] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function why(action: Action) {
    if (action === "resend_confirmation" && emailConfirmed) return "Their email is already confirmed.";
    if (action !== "sign_out_everywhere" && !deliverable) return "Test address: no email is sent.";
    return "";
  }

  async function run(action: Action) {
    if (reason.trim().length < 5) { setNote({ tone: "error", text: "Write a short reason first (it goes in the audit log)." }); return; }
    setBusy(true); setNote(null);
    try {
      const res = await authFetch(`/api/internal/admin/users/${encodeURIComponent(userId)}/support-action`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) { setNote({ tone: "error", text: json.message || "That didn’t work. Try again." }); return; }
      setNote({ tone: "ok", text: json.message || "Done." }); setOpen(null); setReason("");
    } catch {
      setNote({ tone: "error", text: "That didn’t work. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="lf-admin-table-card lf-admin-form-card lf-admin-support-actions" aria-label="Support actions">
      <h2>Support actions</h2>
      <p className="lf-admin-muted">Sign-in help only. Each action needs a reason and is recorded in the audit log. You never see passwords, links or Vault content.</p>
      <ul className="lf-admin-support-list">
        {ACTIONS.map((item) => {
          const blocked = why(item.key);
          const isOpen = open === item.key;
          return (
            <li key={item.key}>
              <button type="button" className="lf-admin-row-button" aria-expanded={isOpen} disabled={Boolean(blocked) || busy}
                onClick={() => { setOpen(isOpen ? null : item.key); setReason(""); setNote(null); }}>
                <Icon name={item.icon} size={18} />{item.label}
              </button>
              {blocked ? <small className="lf-admin-muted">{blocked}</small> : null}
              {isOpen ? (
                <div className="lf-admin-support-confirm">
                  <p>{item.confirm}</p>
                  <label>
                    <span>Reason (for the audit log)</span>
                    <textarea rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="For example: customer called, lost their phone" autoFocus />
                  </label>
                  <div className="lf-admin-reply-row">
                    <button type="button" className="lf-admin-primary-button" disabled={busy} onClick={() => void run(item.key)}>{busy ? "Working…" : item.label}</button>
                    <button type="button" className="lf-admin-row-button" disabled={busy} onClick={() => { setOpen(null); setReason(""); }}>Cancel</button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {note ? <p role={note.tone === "error" ? "alert" : "status"} className={`lf-admin-support-note is-${note.tone}`}>{note.text}</p> : null}
    </section>
  );
}
