import Link from "next/link";
import type { CSSProperties } from "react";
import BrandMark from "./(app)/components/BrandMark";
import { LANDING_COPY, LANDING_KEY_FACTS } from "../config/landingPageContent.config";

export default function LandingPage() {
  return (
    <main style={{ background: "#f3f8fb", color: "#0f172a" }}>
      <section style={heroWrapStyle}>
        <header style={topNavStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BrandMark size={36} />
            <div>
              <div style={{ fontWeight: 700 }}>Legacy Fortress</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Estate Vault Platform</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/signin" style={ghostBtnStyle}>Sign in</Link>
            <Link href="/signup" style={primaryBtnStyle}>Get started</Link>
          </div>
        </header>

        <div style={heroGridStyle}>
          <div style={{ display: "grid", gap: 14 }}>
            <h1 style={{ fontSize: 42, lineHeight: 1.08, margin: 0, letterSpacing: "-0.02em" }}>{LANDING_COPY.heroTitle}</h1>
            <p style={{ margin: 0, color: "#334155", fontSize: 18 }}>{LANDING_COPY.heroSubtitle}</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/signup" style={primaryBtnStyle}>Get started</Link>
              <Link href="#how-it-works" style={ghostBtnStyle}>Learn how it works</Link>
            </div>
            <div style={{ color: "#0f766e", fontSize: 13, fontWeight: 600 }}>
              UK-focused, role-aware, and designed for real-world executor workflows.
            </div>
          </div>

          <div style={heroCardStyle}>
            <h2 style={{ margin: 0, fontSize: 20 }}>When records are missing, families pay the price</h2>
            <p style={{ margin: 0, color: "#475569", lineHeight: 1.5 }}>{LANDING_COPY.problem}</p>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#334155", lineHeight: 1.5 }}>
              <li>Key documents cannot be found quickly</li>
              <li>Assets and liabilities are incomplete or unknown</li>
              <li>Executors and advisers lack clear instructions</li>
            </ul>
          </div>
        </div>
      </section>

      <section style={sectionWrapStyle}>
        <h2 style={sectionTitleStyle}>What Legacy Fortress is</h2>
        <p style={sectionIntroStyle}>{LANDING_COPY.whatIs}</p>
      </section>

      <section style={sectionWrapStyle}>
        <h2 style={sectionTitleStyle}>Key benefits</h2>
        <div className="lf-content-grid">
          {LANDING_COPY.benefits.map((benefit) => (
            <article key={benefit} style={panelStyle}>{benefit}</article>
          ))}
        </div>
      </section>

      <section style={sectionWrapStyle}>
        <h2 style={sectionTitleStyle}>Who it is for</h2>
        <div className="lf-content-grid">
          {LANDING_COPY.audiences.map((audience) => (
            <article key={audience} style={panelStyle}>{audience}</article>
          ))}
        </div>
      </section>

      <section style={sectionWrapStyle}>
        <h2 style={sectionTitleStyle}>Why this matters in the UK</h2>
        <div className="lf-content-grid">
          {LANDING_KEY_FACTS.map((fact) => (
            <article key={fact.id} style={panelStyle}>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#1d4ed8" }}>{fact.stat}</div>
              <div style={{ color: "#334155", fontSize: 14 }}>{fact.context}</div>
              <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
                Source: <a href={fact.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "#0f766e" }}>{fact.sourceName}</a> ({fact.sourceDate})
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" style={sectionWrapStyle}>
        <h2 style={sectionTitleStyle}>How it works</h2>
        <div className="lf-content-grid">
          {[
            "Sign up with email, Apple, or Google",
            "Verify account and complete terms/consent",
            "Add profile details, assets, documents, and wishes",
            "Invite trusted contacts and assign controlled access",
            "Maintain records over time from one secure workspace",
          ].map((step) => (
            <article key={step} style={panelStyle}>{step}</article>
          ))}
        </div>
      </section>

      <section style={sectionWrapStyle}>
        <h2 style={sectionTitleStyle}>Security and controlled sharing</h2>
        <p style={sectionIntroStyle}>
          Legacy Fortress uses role-based access, activation states, and controlled visibility so people can see what they should, when they should.
        </p>
      </section>

      <section style={{ ...sectionWrapStyle, paddingBottom: 48 }}>
        <div style={ctaPanelStyle}>
          <h2 style={{ margin: 0, fontSize: 30 }}>Start organizing your legacy with clarity.</h2>
          <p style={{ margin: 0, color: "#cbd5e1" }}>
            Give loved ones, executors, and advisers a better path when it matters most.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/signup" style={primaryBtnStyle}>Create account</Link>
            <Link href="/signin" style={ghostBtnDarkStyle}>Sign in</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

const heroWrapStyle: CSSProperties = {
  maxWidth: 1120,
  margin: "0 auto",
  padding: "20px 14px 24px",
  display: "grid",
  gap: 22,
};

const topNavStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const heroGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: 14,
  alignItems: "stretch",
};

const heroCardStyle: CSSProperties = {
  border: "1px solid #dbeafe",
  background: "linear-gradient(150deg, #ecfeff, #dbeafe)",
  borderRadius: 20,
  padding: 18,
  display: "grid",
  gap: 10,
};

const sectionWrapStyle: CSSProperties = {
  maxWidth: 1120,
  margin: "0 auto",
  padding: "8px 14px 18px",
  display: "grid",
  gap: 12,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 28,
};

const sectionIntroStyle: CSSProperties = {
  margin: 0,
  color: "#334155",
  lineHeight: 1.6,
};

const panelStyle: CSSProperties = {
  border: "1px solid #dbe3eb",
  borderRadius: 14,
  padding: 14,
  background: "#fff",
  color: "#0f172a",
  lineHeight: 1.5,
};

const primaryBtnStyle: CSSProperties = {
  textDecoration: "none",
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#fff",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 600,
};

const ghostBtnStyle: CSSProperties = {
  textDecoration: "none",
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 600,
};

const ghostBtnDarkStyle: CSSProperties = {
  ...ghostBtnStyle,
  borderColor: "#334155",
  background: "transparent",
  color: "#e2e8f0",
};

const ctaPanelStyle: CSSProperties = {
  borderRadius: 20,
  background: "linear-gradient(145deg, #0f172a, #0f766e)",
  border: "1px solid #1e293b",
  padding: 20,
  display: "grid",
  gap: 12,
  color: "#f8fafc",
};
