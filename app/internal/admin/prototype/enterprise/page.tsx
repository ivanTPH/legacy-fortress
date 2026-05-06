import Link from "next/link";
import AdminPrototypeShell from "@/components/admin/prototype/AdminPrototypeShell";
import AdminStatusBadge from "@/components/admin/prototype/AdminStatusBadge";
import { getLicenceSeatMetrics, licencePlans, organisationClients, organisations } from "@/components/admin/prototype/mockData";
import { buildClientOpportunityScores, buildReportMetrics } from "@/components/admin/prototype/reportInsights";
import type { CSSProperties, ReactNode } from "react";

export default function EnterpriseDashboardPage() {
  const licenceMetrics = getLicenceSeatMetrics();
  const totalSeats = licenceMetrics.includedSeats;
  const seatsUsed = licenceMetrics.usedSeats;
  const seatsAvailable = licenceMetrics.seatsAvailable;
  const activeLicences = licenceMetrics.activeLicences;
  const renewalWarnings = licenceMetrics.renewalsDueSoon;
  const totalLicensedOrganisations = licencePlans.length;
  const pendingSetupTasks = organisations.reduce((sum, org) => sum + org.pendingInvitations, 0);
  const insightConsentedClients = organisationClients.filter((client) => client.consent.adviserInsights).length;
  const reportableClients = organisationClients.filter((client) => client.consent.adviserInsights);
  const opportunityScores = buildClientOpportunityScores(organisationClients);
  const opportunityMetrics = buildReportMetrics(organisationClients);
  const reviewDueClients = reportableClients.filter((client) => /overdue|now/i.test(client.nextReviewDue)).length;
  const consentReadyClients = reportableClients.filter((client) => client.consent.marketing).length;
  const incompleteVaults = reportableClients.filter((client) => client.vaultCompletion < 70).length;

  return (
    <AdminPrototypeShell
      title="Enterprise dashboard"
      description="Static control centre for organisation licensing, portfolio readiness, reporting access, and rollout monitoring."
    >
      <section style={noticeStyle}>
        Enterprise prototype — static mock data. Reporting is limited to mock clients with explicit adviser insight consent; no exports, campaigns, live billing, or real client vault data are enabled.
      </section>

      <section style={metricsGridStyle} aria-label="Enterprise dashboard metrics">
        <Metric label="Licensed organisations" value={String(totalLicensedOrganisations)} detail="Professional and enterprise accounts" />
        <Metric label="Active licences" value={String(activeLicences)} detail={`${licenceMetrics.suspendedOrExpiredLicences} expired or suspended`} />
        <Metric label="Seats used" value={`${seatsUsed}/${totalSeats}`} detail={`${seatsAvailable} seats available`} />
        <Metric label="Clients vs limits" value={`${seatsUsed}/${licenceMetrics.clientLimit}`} detail={`${licenceMetrics.clientsUnderLimit} client capacity remaining`} />
        <Metric label="Renewals due soon" value={String(renewalWarnings)} detail="Renewal due or review state" />
        <Metric label="Clients managed" value={String(organisationClients.length)} detail="Mock linked client records" />
        <Metric label="Setup tasks" value={String(pendingSetupTasks)} detail="Pending organisation invites or setup tasks" />
        <Metric label="Reporting" value="Consent gated" detail={`${insightConsentedClients} clients have adviser insight consent`} />
        <Metric label="High opportunities" value={String(opportunityMetrics.highOpportunity)} detail={`${opportunityMetrics.outreachReady} outreach-ready`} />
      </section>

      <section style={panelGridStyle}>
        <DashboardPanel
          title="Organisation overview"
          detail={`${organisations.length} organisations are represented in this mock portfolio. Review account owners, status, and client seat allocation.`}
          ctaHref="/internal/admin/prototype/organisations"
          ctaLabel="Open organisations"
        >
          <div style={miniListStyle}>
            {organisations.slice(0, 3).map((org) => (
              <div key={org.id} style={miniRowStyle}>
                <span>
                  <strong>{org.name}</strong>
                  <span style={mutedBlockStyle}>{org.type} · {org.accountOwner}</span>
                </span>
                <AdminStatusBadge status={org.status === "Review" ? "Pending" : org.status} />
              </div>
            ))}
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Licence health"
          detail={`${activeLicences} active licences. ${renewalWarnings} organisations need renewal, onboarding, or account review attention. Prototype only — billing not connected.`}
          ctaHref="/internal/admin/prototype/licences"
          ctaLabel="Open licences"
        >
          <div style={healthGridStyle}>
            <Info label="Seats used" value={String(seatsUsed)} />
            <Info label="Seats available" value={String(seatsAvailable)} />
            <Info label="Renewal warnings" value={String(renewalWarnings)} />
            <Info label="Client capacity" value={String(licenceMetrics.clientsUnderLimit)} />
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Client portfolio summary"
          detail={`${reviewDueClients} consented clients are due or overdue for review. Values remain banded in this prototype.`}
          ctaHref="/internal/admin/prototype/reports/client-insights"
          ctaLabel="Open client insights"
        >
          <div style={healthGridStyle}>
            <Info label="Review due" value={String(reviewDueClients)} />
            <Info label="Incomplete vaults" value={String(incompleteVaults)} />
            <Info label="Consent allowed" value={String(consentReadyClients)} />
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Reporting & insights"
          detail="Reporting access is consent-gated in static prototype views only. No exports, campaigns, or live reporting jobs are enabled."
          ctaHref="/internal/admin/prototype/reports"
          ctaLabel="Open reports"
        >
          <div style={tagRowStyle}>
            <span style={tagStyle}>Will age</span>
            <span style={tagStyle}>Review due</span>
            <span style={tagStyle}>Vault completion</span>
            <span style={tagStyle}>Consent status</span>
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Portfolio opportunity"
          detail="Safe opportunity scoring uses consent-gated insight signals and banded values only. Non-consented clients are blocked before planning reasons are calculated."
          ctaHref="/internal/admin/prototype/reports/client-insights"
          ctaLabel="Open opportunity report"
        >
          <div style={healthGridStyle}>
            <Info label="High" value={String(opportunityMetrics.highOpportunity)} />
            <Info label="Medium" value={String(opportunityMetrics.mediumOpportunity)} />
            <Info label="Consent blocked" value={String(opportunityMetrics.blockedOpportunity)} />
            <Info label="Outreach ready" value={String(opportunityMetrics.outreachReady)} />
            <Info label="Review due" value={String(opportunityMetrics.reviewDue)} />
          </div>
          <div style={tagRowStyle}>
            {opportunityScores.slice(0, 3).map((score) => (
              <span key={score.clientId} style={tagStyle}>{score.clientId}: {score.scoreLevel}</span>
            ))}
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Compliance / consent readiness"
          detail="Campaign and outreach actions remain disabled. Marketing contact requires adviser insight consent, marketing consent, communication preference, and firm approval."
          ctaHref="/internal/admin/prototype/reports/client-insights"
          ctaLabel="Review readiness"
        >
          <div style={complianceNoteStyle}>
            Sensitive fields are shown as bands only. Only clients linked to a licensed organisation would be visible in a real build.
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Enterprise rollout status"
          detail={`${pendingSetupTasks} pending invitations or setup tasks are represented across mock organisations.`}
          ctaHref="/internal/admin/prototype/organisations"
          ctaLabel="Review rollout"
        >
          <div style={tagRowStyle}>
            <span style={tagStyle}>Static onboarding</span>
            <span style={tagStyle}>Disabled invites</span>
            <span style={tagStyle}>No live billing</span>
          </div>
        </DashboardPanel>
      </section>
    </AdminPrototypeShell>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <section style={metricStyle}>
      <span style={metricLabelStyle}>{label}</span>
      <strong style={{ fontSize: 28 }}>{value}</strong>
      <span style={{ color: "var(--lf-text-soft)", fontSize: 13 }}>{detail}</span>
    </section>
  );
}

function DashboardPanel({
  title,
  detail,
  ctaHref,
  ctaLabel,
  children,
}: {
  title: string;
  detail: string;
  ctaHref: string;
  ctaLabel: string;
  children: ReactNode;
}) {
  return (
    <section style={panelStyle}>
      <div style={{ display: "grid", gap: 5 }}>
        <h2 style={h2Style}>{title}</h2>
        <p style={panelTextStyle}>{detail}</p>
      </div>
      {children}
      <Link href={ctaHref} style={ctaStyle}>
        {ctaLabel}
      </Link>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoStyle}>
      <span style={metricLabelStyle}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const noticeStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  background: "var(--lf-surface-muted)",
  color: "var(--lf-bronze)",
  borderRadius: 8,
  padding: 12,
  fontSize: 13,
  fontWeight: 700,
};

const metricsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const metricStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: 14,
  display: "grid",
  gap: 6,
};

const metricLabelStyle: CSSProperties = {
  color: "var(--lf-text-soft)",
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
};

const panelGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: 14,
};

const panelStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: 16,
  display: "grid",
  alignContent: "start",
  gap: 12,
};

const h2Style: CSSProperties = {
  margin: 0,
  fontSize: 17,
};

const panelTextStyle: CSSProperties = {
  margin: 0,
  color: "var(--lf-text-soft)",
  fontSize: 13,
  lineHeight: 1.45,
};

const ctaStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  background: "var(--lf-surface-muted)",
  color: "var(--lf-text)",
  textDecoration: "none",
  padding: "9px 11px",
  fontSize: 13,
  fontWeight: 800,
  width: "fit-content",
};

const miniListStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const miniRowStyle: CSSProperties = {
  border: "1px solid #f1ece8",
  borderRadius: 8,
  padding: 10,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const mutedBlockStyle: CSSProperties = {
  display: "block",
  color: "var(--lf-text-soft)",
  fontSize: 12,
  marginTop: 3,
};

const healthGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
};

const infoStyle: CSSProperties = {
  border: "1px solid #f1ece8",
  borderRadius: 8,
  padding: 10,
  display: "grid",
  gap: 4,
};

const tagRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const tagStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 999,
  background: "var(--lf-surface-muted)",
  color: "var(--lf-text)",
  padding: "6px 9px",
  fontSize: 12,
  fontWeight: 800,
};

const complianceNoteStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  background: "var(--lf-surface-muted)",
  color: "var(--lf-text)",
  padding: 11,
  fontSize: 13,
  lineHeight: 1.45,
};
