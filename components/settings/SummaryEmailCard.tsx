"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Frequency = "monthly" | "weekly" | "off";
const OPTIONS: Array<{ key: Frequency; label: string }> = [{ key: "monthly", label: "Monthly" }, { key: "weekly", label: "Weekly" }, { key: "off", label: "Off" }];

async function call(method: "GET" | "POST", body?: Record<string, unknown>) {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const response = await fetch("/api/summary-email", { method, headers, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
  return ((await response?.json().catch(() => ({}))) ?? {}) as { ok?: boolean; available?: boolean; frequency?: Frequency; message?: string };
}

/** Settings › Notifications › Summary email (V5.2 m3): Monthly (default) · Weekly · Off. */
export default function SummaryEmailCard() {
  const [frequency, setFrequency] = useState<Frequency | null>(null);
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    void call("GET").then((result) => {
      if (!active) return;
      setAvailable(result.available !== false);
      setFrequency(result.frequency ?? "monthly");
    });
    return () => { active = false; };
  }, []);

  async function choose(next: Frequency) {
    if (busy || next === frequency) return;
    const previous = frequency;
    setFrequency(next); setBusy("save"); setStatus("");
    const result = await call("POST", { frequency: next });
    setBusy("");
    if (!result.ok) { setFrequency(previous); setStatus(result.message ?? "That didn’t save."); return; }
    setStatus(next === "off" ? "Summary email turned off." : `You’ll get it ${next === "weekly" ? "every week" : "once a month"} when there’s something new.`);
  }

  async function preview() {
    setBusy("preview"); setStatus("");
    const result = await call("POST", { action: "preview" });
    setBusy("");
    setStatus(result.message ?? (result.ok ? "Sent." : "It couldn’t be sent."));
  }

  if (!available) return null;
  return (
    <section className="lf-sec-group" aria-labelledby="summary-email-title">
      <h2 id="summary-email-title">Summary email</h2>
      <div className="lf-sec-card lf-summary-card">
        <p className="lf-sg-muted">How many things are waiting for you, and how many updates. Never names, records or values.</p>
        <div className="lf-summary-options" role="radiogroup" aria-labelledby="summary-email-title">
          {OPTIONS.map((option) => <button key={option.key} type="button" role="radio" aria-checked={frequency === option.key} className={`lf-sg-reason${frequency === option.key ? " is-selected" : ""}`} disabled={frequency === null || busy === "save"} onClick={() => void choose(option.key)}>{option.label}</button>)}
        </div>
        <button type="button" className="lf-sg-secondary lf-summary-preview" disabled={Boolean(busy)} onClick={() => void preview()}>{busy === "preview" ? "Sending…" : "Send me one now"}</button>
        {status ? <p className="lf-sec-status" role="status">{status}</p> : null}
      </div>
    </section>
  );
}
