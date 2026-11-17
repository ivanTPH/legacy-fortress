import Link from "next/link";

/** Plain wording, one way back (UX review Stage 4). Signed-out visitors reach sign-in from Home anyway. */
export default function NotFoundPage() {
  return (
    <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: 24, background: "var(--lf-surface-page, #F7F4F1)" }}>
      <section style={{ width: "100%", maxWidth: 480, border: "1px solid var(--lf-border, #EBE4DE)", borderRadius: 16, background: "var(--lf-surface-card, #fff)", padding: 24, display: "grid", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>We can’t find that page</h1>
        <p style={{ margin: 0, color: "var(--lf-text-secondary, #6B5F5A)" }}>The link may be old or mistyped. Nothing in your Vault has changed.</p>
        <div><Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 18px", borderRadius: 22, background: "var(--lf-primary-bg, #2B1714)", color: "var(--lf-primary-text, #fff)", textDecoration: "none", fontWeight: 600 }}>Go to Home</Link></div>
      </section>
    </main>
  );
}
