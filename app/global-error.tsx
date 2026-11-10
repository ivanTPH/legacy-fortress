"use client";

import { useEffect } from "react";
import { reloadOnceForNewVersion } from "../lib/errors/recovery";

/** Last resort when even the page frame fails. Plain markup and inline styles, since the app's styles may not load. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[LF] app error", error?.name, error?.message, error?.digest ?? "");
    reloadOnceForNewVersion(error);
  }, [error]);
  return (
    <html lang="en-GB">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#F7F4F1", color: "#1F1715", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <main role="alert" style={{ maxWidth: 440, padding: 24, display: "grid", gap: 14 }}>
          <strong style={{ fontSize: 18 }}>Legacy Fortress</strong>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>Sorry, this page didn’t load</h1>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.5, color: "#4A3F3A" }}>Nothing in your Vault has been changed. Please try again.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => reset()} style={{ minHeight: 52, padding: "0 20px", border: 0, borderRadius: 14, background: "#2B1714", color: "#FFFFFF", fontSize: 17, fontWeight: 600, cursor: "pointer" }}>Try again</button>
            <a href="/dashboard" style={{ display: "inline-flex", alignItems: "center", minHeight: 52, padding: "0 20px", border: "1px solid #D9CCC3", borderRadius: 14, color: "#1F1715", fontSize: 17, fontWeight: 600, textDecoration: "none" }}>Go to Home</a>
          </div>
        </main>
      </body>
    </html>
  );
}
