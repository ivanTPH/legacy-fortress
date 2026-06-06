"use client";

import Link from "next/link";
import { useState } from "react";
import WorkspaceSwitcher from "../../../components/navigation/WorkspaceSwitcher";
import {
  isTestPersonaAccessEnabled,
  TEST_PERSONAS,
  TEST_PERSONA_STORAGE_KEY,
  type TestPersona,
} from "../../../lib/testPersonas";

export default function TestLoginPage() {
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const enabled = isTestPersonaAccessEnabled();

  function activatePersona(persona: TestPersona) {
    window.localStorage.setItem(TEST_PERSONA_STORAGE_KEY, persona.id);
    window.dispatchEvent(new Event("lf-test-persona-change"));
    setSelectedPersona(persona.id);
    window.location.assign(persona.previewHref);
  }

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <span style={warningBadgeStyle}>Beta test access — mock role preview</span>
        <h1 style={headingStyle}>Legacy Fortress test personas</h1>
        <p style={introStyle}>
          Select a safe mock persona for development, staging, QA, demos, or enterprise walkthroughs.
          This is not production authentication and does not create a real user session.
        </p>
        <div style={safetyGridStyle} aria-label="Safety rules">
          <span>No real passwords</span>
          <span>No Supabase auth bypass</span>
          <span>No production access changes</span>
          <span>Hidden from consumer navigation</span>
        </div>
      </section>

      {!enabled ? (
        <section style={disabledPanelStyle} role="status" aria-live="polite">
          <strong>Test persona access is disabled</strong>
          <p style={cardTextStyle}>
            This route is present for development and staging review only. Set NEXT_PUBLIC_ENABLE_TEST_PERSONAS=true
            in an approved non-production environment to enable mock role previews.
          </p>
        </section>
      ) : null}

      <div style={{ marginBottom: 24 }}>
        <WorkspaceSwitcher
          currentPathname="/internal/test-login"
          showDetails
          governanceContext="/internal/test-login prototype launcher"
        />
      </div>

      <section style={gridStyle} aria-label="Mock personas">
        {TEST_PERSONAS.map((persona) => (
          <article key={persona.id} style={cardStyle}>
            <div style={cardTopStyle}>
              <span style={areaBadgeStyle}>{persona.area}</span>
              <span style={roleStyle}>{persona.roleSummary}</span>
            </div>
            <h2 style={cardTitleStyle}>{persona.label}</h2>
            <p style={roleSummaryStyle}>Assigned roles: {persona.roles.join(", ")}</p>
            <p style={cardTextStyle}>{persona.description}</p>

            <div style={listWrapStyle}>
              <strong>Permitted preview</strong>
              <ul style={listStyle}>
                {persona.capabilities.map((capability) => (
                  <li key={capability}>{capability}</li>
                ))}
              </ul>
            </div>

            <div style={listWrapStyle}>
              <strong>Restricted areas</strong>
              <ul style={listStyle}>
                {persona.restrictedAreas.map((area) => (
                  <li key={area}>{area}</li>
                ))}
              </ul>
            </div>

            <div style={actionsStyle}>
              <button type="button" style={primaryButtonStyle} onClick={() => activatePersona(persona)} disabled={!enabled}>
                Open preview
              </button>
              <Link href={`/internal/test-login/${persona.id}`} style={secondaryLinkStyle}>
                View details
              </Link>
            </div>
            {selectedPersona === persona.id ? (
              <p style={statusStyle}>Test persona mode is being opened.</p>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "var(--lf-bg)",
  color: "var(--lf-text)",
  padding: "40px clamp(20px, 5vw, 64px)",
} as const;

const heroStyle = {
  maxWidth: 980,
  display: "grid",
  gap: 14,
  marginBottom: 28,
} as const;

const warningBadgeStyle = {
  display: "inline-flex",
  width: "fit-content",
  borderRadius: 999,
  border: "1px solid var(--lf-border)",
  background: "var(--lf-surface)",
  color: "var(--lf-text)",
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 800,
} as const;

const headingStyle = {
  margin: 0,
  fontSize: "clamp(30px, 4vw, 46px)",
  letterSpacing: 0,
} as const;

const introStyle = {
  margin: 0,
  color: "var(--lf-text-soft)",
  fontSize: 16,
  lineHeight: 1.6,
  maxWidth: 760,
} as const;

const safetyGridStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  color: "var(--lf-text-soft)",
  fontSize: 13,
} as const;

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 18,
} as const;

const disabledPanelStyle = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: 12,
  padding: 18,
  marginBottom: 24,
  maxWidth: 760,
  display: "grid",
  gap: 6,
} as const;

const cardStyle = {
  background: "var(--lf-surface)",
  border: "1px solid var(--lf-border)",
  borderRadius: 12,
  padding: 22,
  display: "grid",
  gap: 14,
  boxShadow: "0 12px 34px rgba(31, 23, 18, 0.06)",
} as const;

const cardTopStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
} as const;

const areaBadgeStyle = {
  borderRadius: 999,
  background: "var(--lf-surface-muted)",
  color: "var(--lf-text)",
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 800,
} as const;

const roleStyle = {
  color: "var(--lf-text-soft)",
  fontSize: 12,
  fontWeight: 700,
  textAlign: "right",
} as const;

const cardTitleStyle = {
  margin: 0,
  fontSize: 20,
} as const;

const cardTextStyle = {
  margin: 0,
  color: "var(--lf-text-soft)",
  lineHeight: 1.5,
} as const;

const roleSummaryStyle = {
  margin: 0,
  color: "var(--lf-text)",
  fontSize: 13,
  fontWeight: 800,
} as const;

const listWrapStyle = {
  display: "grid",
  gap: 6,
  fontSize: 13,
} as const;

const listStyle = {
  margin: 0,
  paddingLeft: 18,
  color: "var(--lf-text-soft)",
  lineHeight: 1.55,
} as const;

const actionsStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "center",
} as const;

const primaryButtonStyle = {
  border: 0,
  borderRadius: 10,
  background: "var(--lf-bronze-strong)",
  color: "#fff",
  minHeight: 40,
  padding: "0 16px",
  fontWeight: 800,
  cursor: "pointer",
} as const;

const secondaryLinkStyle = {
  borderRadius: 10,
  border: "1px solid var(--lf-border)",
  color: "var(--lf-text)",
  minHeight: 40,
  padding: "0 14px",
  display: "inline-flex",
  alignItems: "center",
  textDecoration: "none",
  fontWeight: 800,
} as const;

const statusStyle = {
  margin: 0,
  color: "#166534",
  fontSize: 13,
  fontWeight: 800,
} as const;
