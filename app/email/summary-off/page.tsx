"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

/** Turn off the summary email from its link (V5.2 m3). A button, so mail scanners opening the link change nothing. */
function SummaryOff() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"ask" | "busy" | "done" | "failed">("ask");
  async function turnOff() {
    setState("busy");
    const response = await fetch("/api/summary-email/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => null);
    const json = (await response?.json().catch(() => ({}))) as { ok?: boolean } | undefined;
    setState(json?.ok ? "done" : "failed");
  }
  return (
    <main className="lf-auth-shell" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16, background: "var(--lf-surface-page)" }}>
      <section className="lf-auth-card" aria-labelledby="summary-off-title">
        <h1 id="summary-off-title">{state === "done" ? "Summary email turned off" : "Turn off the summary email?"}</h1>
        {state === "done" ? <p>You won’t get it any more. You can turn it back on in Settings › Notifications.</p>
          : state === "failed" ? <p role="alert">That link didn’t work. Sign in and change it in Settings › Notifications.</p>
          : <p>You’ll stop getting the summary of things to do and updates. Other emails, such as security alerts, still arrive.</p>}
        {state === "ask" || state === "busy" ? <button type="button" className="lf-primary-btn" disabled={state === "busy" || !token} onClick={() => void turnOff()}>{state === "busy" ? "Turning off…" : "Turn off"}</button> : null}
        <p><Link href="/sign-in">Sign in to Legacy Fortress</Link></p>
      </section>
    </main>
  );
}

export default function SummaryOffPage() {
  return <Suspense fallback={null}><SummaryOff /></Suspense>;
}
