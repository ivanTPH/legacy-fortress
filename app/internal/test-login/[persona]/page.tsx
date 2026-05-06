import Link from "next/link";
import { getTestPersona, isTestPersonaAccessEnabled } from "../../../../lib/testPersonas";

type PersonaDetailPageProps = {
  params: Promise<{
    persona: string;
  }>;
};

export default async function PersonaDetailPage({ params }: PersonaDetailPageProps) {
  const { persona: personaId } = await params;
  const persona = getTestPersona(personaId);
  const enabled = isTestPersonaAccessEnabled();

  if (!persona) {
    return (
      <main style={pageStyle}>
        <section style={panelStyle}>
          <span style={warningBadgeStyle}>Beta test access — mock role preview</span>
          <h1 style={headingStyle}>Persona not found</h1>
          <p style={textStyle}>This test persona is not available. No preview content or permissions were loaded.</p>
          <Link href="/internal/test-login" style={linkStyle}>
            Back to test personas
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={panelStyle}>
        <span style={warningBadgeStyle}>Beta test access — mock role preview</span>
        <h1 style={headingStyle}>{persona.label}</h1>
        <p style={textStyle}>{persona.description}</p>
        {!enabled ? (
          <section style={disabledPanelStyle} role="status" aria-live="polite">
            <strong>Test persona access is disabled</strong>
            <p style={textStyle}>
              This preview is available only in development or approved staging environments with
              NEXT_PUBLIC_ENABLE_TEST_PERSONAS=true.
            </p>
          </section>
        ) : null}
        <div style={summaryGridStyle}>
          <PreviewList title="Permitted navigation and capabilities" items={persona.capabilities} />
          <PreviewList title="Expected dashboard state" items={persona.dashboardState} />
          <PreviewList title="Restricted-access behaviour" items={persona.restrictedAreas} />
        </div>
        <div style={actionsStyle}>
          {enabled ? (
            <Link href={persona.previewHref} style={primaryLinkStyle}>
              Open preview route
            </Link>
          ) : null}
          <Link href="/internal/test-login" style={linkStyle}>
            Switch persona
          </Link>
        </div>
        <p style={smallTextStyle}>
          This page is static and frontend-only. It does not alter real authentication, create users, or enable hidden
          production access.
        </p>
      </section>
    </main>
  );
}

function PreviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <article style={listCardStyle}>
      <h2 style={sectionTitleStyle}>{title}</h2>
      <ul style={listStyle}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "var(--lf-bg)",
  color: "var(--lf-text)",
  padding: "40px clamp(20px, 5vw, 64px)",
} as const;

const panelStyle = {
  maxWidth: 1080,
  background: "var(--lf-surface)",
  border: "1px solid var(--lf-border)",
  borderRadius: 12,
  padding: 28,
  display: "grid",
  gap: 18,
} as const;

const warningBadgeStyle = {
  display: "inline-flex",
  width: "fit-content",
  borderRadius: 999,
  background: "var(--lf-surface-muted)",
  color: "var(--lf-text)",
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 800,
} as const;

const headingStyle = {
  margin: 0,
  fontSize: "clamp(28px, 4vw, 42px)",
} as const;

const textStyle = {
  margin: 0,
  color: "var(--lf-text-soft)",
  lineHeight: 1.6,
  maxWidth: 760,
} as const;

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 14,
} as const;

const disabledPanelStyle = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: 10,
  padding: 14,
  display: "grid",
  gap: 6,
} as const;

const listCardStyle = {
  border: "1px solid var(--lf-border)",
  borderRadius: 10,
  padding: 16,
  background: "var(--lf-bg)",
} as const;

const sectionTitleStyle = {
  margin: "0 0 8px",
  fontSize: 16,
} as const;

const listStyle = {
  margin: 0,
  paddingLeft: 18,
  color: "var(--lf-text-soft)",
  lineHeight: 1.6,
} as const;

const actionsStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
} as const;

const primaryLinkStyle = {
  borderRadius: 10,
  background: "var(--lf-bronze-strong)",
  color: "#fff",
  minHeight: 42,
  padding: "0 16px",
  display: "inline-flex",
  alignItems: "center",
  textDecoration: "none",
  fontWeight: 800,
} as const;

const linkStyle = {
  borderRadius: 10,
  border: "1px solid var(--lf-border)",
  color: "var(--lf-text)",
  minHeight: 42,
  padding: "0 16px",
  display: "inline-flex",
  alignItems: "center",
  textDecoration: "none",
  fontWeight: 800,
} as const;

const smallTextStyle = {
  margin: 0,
  color: "var(--lf-text-soft)",
  fontSize: 13,
  lineHeight: 1.5,
} as const;
