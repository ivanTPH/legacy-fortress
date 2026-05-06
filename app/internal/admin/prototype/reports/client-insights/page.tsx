import Link from "next/link";
import AdminPrototypeShell from "@/components/admin/prototype/AdminPrototypeShell";
import ReportFilterBar from "@/components/admin/prototype/ReportFilterBar";
import { findOrganisation, organisationClients, organisations } from "@/components/admin/prototype/mockData";
import {
  buildClientInsights,
  buildClientOpportunityScores,
  buildReportMetrics,
  filterOrganisationClients,
  getActiveFilterChips,
  getClientInsightSummary,
  getClientOpportunityScore,
  getConsentBlockedCount,
  type ClientInsightSeverity,
  type ClientOpportunityScore,
  type ReportFilters,
} from "@/components/admin/prototype/reportInsights";
import type { CSSProperties, ReactNode } from "react";

type ClientInsightsReportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClientInsightsReportPage({ searchParams }: ClientInsightsReportPageProps) {
  const resolvedSearchParams = await searchParams;
  const filters = getReportFilters(resolvedSearchParams);
  const orgId = filters.orgId;
  const org = orgId ? findOrganisation(orgId) : null;
  const invalidOrgFilter = Boolean(orgId && !org);
  const organisationScopedClients = org
    ? organisationClients.filter((client) => client.organisationId === org.id)
    : orgId
      ? []
      : organisationClients;
  const filteredClients = invalidOrgFilter ? [] : filterOrganisationClients(organisationScopedClients, filters);
  const clientsInScope = filteredClients;
  const consentBlocked = getConsentBlockedCount(filteredClients);
  const insights = buildClientInsights(filteredClients);
  const opportunityScores = buildClientOpportunityScores(filteredClients);
  const allowedInsights = insights.filter((insight) => insight.insightType !== "consent_missing");
  const reportMetrics = buildReportMetrics(clientsInScope, insights, consentBlocked);
  const insightCards = buildInsightCards(reportMetrics);
  const activeChips = getActiveFilterChips(filters, org?.name);

  return (
    <AdminPrototypeShell
      title={org ? `${org.name} client insights` : "Client insights"}
      description={org
        ? "Static organisation-scoped client insight prototype using safe bands, review signals, and consent indicators."
        : "Static report prototype for portfolio review signals, consent-aware outreach opportunities, and licence-holder reporting."}
    >
      <section style={noticeStyle}>
        Client insights and outreach depend on explicit client consent. Some records are restricted. Static prototype — mock data; marketing readiness also requires marketing consent.
      </section>

      {invalidOrgFilter ? (
        <section style={invalidFilterStyle}>
          <strong>Invalid organisation filter</strong>
          <span>The organisation ID "{orgId}" is not available in the static prototype dataset.</span>
          <Link href="/internal/admin/prototype/organisations" style={textLinkStyle}>Back to organisations</Link>
        </section>
      ) : null}

      {!invalidOrgFilter ? (
        <ReportFilterBar
          filters={filters}
          organisations={organisations}
          lockedOrganisationName={org?.name}
          activeChips={activeChips}
          clearHref="/internal/admin/prototype/reports/client-insights"
        />
      ) : null}

      <section style={metricsGridStyle}>
        {insightCards.map((card) => (
          <section key={card.label} style={metricStyle}>
            <span style={metricLabelStyle}>{card.label}</span>
            <strong style={{ fontSize: 28 }}>{card.value}</strong>
            <span style={{ color: "var(--lf-text-soft)", fontSize: 13 }}>{card.detail}</span>
          </section>
        ))}
      </section>

      <section style={twoColumnStyle}>
        <section style={panelStyle}>
          <h2 style={h2Style}>Review opportunity</h2>
          <Info label="Target segment" value="Current filtered clients with outdated wills and marketing allowed" />
          <Info label="Matching clients" value={`${reportMetrics.reviewOpportunities} mock clients`} />
          <Info label="Allowed contact channel" value="Email or phone, based on communication preference" />
          <Info label="Consent blocked" value={`${reportMetrics.consentBlocked} filtered client(s) restricted`} />
          <Info label="Compliance note" value="Campaigns require adviser insight consent, marketing consent, firm approval, and audit logging before enablement." />
          <button type="button" disabled style={disabledButtonStyle}>Contact clients — Disabled — requires consent enforcement and outreach approval</button>
          <button type="button" disabled style={disabledButtonStyle}>Run campaign — Disabled — requires consent enforcement and outreach approval</button>
        </section>

        <section style={panelStyle}>
          <h2 style={h2Style}>Filtered client portfolio</h2>
          <div style={{ overflow: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <Th>Client</Th>
                  <Th>Vault</Th>
                  <Th>Will</Th>
                  <Th>Estate</Th>
                  <Th>Insight consent</Th>
                  <Th>Marketing</Th>
                  <Th>Consent updated</Th>
                  <Th>Next review</Th>
                  <Th>Assigned</Th>
                  <Th>Opportunity</Th>
                  <Th>Outreach</Th>
                  <Th>Blockers</Th>
                  <Th>Insight signals</Th>
                </tr>
              </thead>
              <tbody>
                {clientsInScope.length ? (
                  clientsInScope.map((client) => {
                    const opportunity = getClientOpportunityScore(client, opportunityScores);
                    return (
                      <tr key={client.id}>
                        <Td><strong>{client.clientName}</strong></Td>
                        <Td>{client.vaultCompletion}%</Td>
                        <Td>{client.willStatus} · {client.willAge}</Td>
                        <Td>{client.estateValueBand}</Td>
                        <Td>{client.consent.adviserInsights ? "Allowed" : "Consent required"}</Td>
                        <Td>{client.consent.marketing ? "Allowed" : "Not allowed"}</Td>
                        <Td>{client.consent.lastUpdated}</Td>
                        <Td>{client.nextReviewDue}</Td>
                        <Td>{client.assignedProfessional}</Td>
                        <Td><span style={opportunityBadgeStyle(opportunity.scoreLevel)}>{opportunity.scoreLevel}</span></Td>
                        <Td>{opportunity.outreachReady ? "Ready" : "Not ready"}</Td>
                        <Td>{opportunity.blockers.join(", ") || "None"}</Td>
                        <Td>{getClientInsightSummary(client, insights)}</Td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={13} style={emptyTableCellStyle}>No mock clients match the current safe filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section style={panelStyle}>
        <h2 style={h2Style}>Opportunity side panel preview</h2>
        <p style={helperTextStyle}>
          Static side-panel content for a future client drill-in. It shows opportunity level, reasons, blockers, and a safe next step without legal advice or sensitive vault detail.
        </p>
        <div style={opportunityMetricsGridStyle}>
          <Info label="High opportunity clients" value={String(reportMetrics.highOpportunity)} />
          <Info label="Medium opportunity clients" value={String(reportMetrics.mediumOpportunity)} />
          <Info label="Blocked by consent" value={String(reportMetrics.blockedOpportunity)} />
          <Info label="Outreach-ready clients" value={String(reportMetrics.outreachReady)} />
          <Info label="Review due count" value={String(reportMetrics.reviewDue)} />
        </div>
        <div style={signalGridStyle}>
          {opportunityScores.slice(0, 8).map((score) => (
            <OpportunityCard key={score.clientId} score={score} />
          ))}
        </div>
      </section>

      <section style={panelStyle}>
        <h2 style={h2Style}>Consent restrictions</h2>
        <p style={helperTextStyle}>
          Client has not granted adviser insight access means insight details are hidden. The client can remain in summary reports as a restricted row.
        </p>
        <div style={signalGridStyle}>
          {clientsInScope.filter((client) => !client.consent.adviserInsights).length ? (
            clientsInScope.filter((client) => !client.consent.adviserInsights).map((client) => (
              <section key={`restricted-${client.id}`} style={restrictedCardStyle}>
                <strong>{client.clientName}</strong>
                <span style={mutedTextStyle}>Client has not granted adviser insight access</span>
                <span style={severityBadgeStyle("medium")}>Consent required</span>
              </section>
            ))
          ) : (
            <span style={mutedTextStyle}>No consent restrictions in the current filter.</span>
          )}
        </div>
      </section>

      <section style={panelStyle}>
        <h2 style={h2Style}>Insight signal engine</h2>
        <p style={helperTextStyle}>
          Signals are derived only for mock clients with adviser insight consent. Non-consented clients return consent_missing only and do not expose review, executor, will, adviser, or vault insights.
        </p>
        <div style={signalGridStyle}>
          {allowedInsights.length ? (
            allowedInsights.slice(0, 12).map((insight) => (
              <section key={`${insight.clientId}-${insight.insightType}`} style={signalCardStyle(insight.severity)}>
                <span style={severityBadgeStyle(insight.severity)}>{formatSeverity(insight.severity)}</span>
                <strong>{insight.message}</strong>
                <span style={mutedTextStyle}>{insight.insightType.replace(/_/g, " ")} · {insight.clientId}</span>
              </section>
            ))
          ) : (
            <span style={mutedTextStyle}>No insight signals for the current filter.</span>
          )}
        </div>
      </section>
    </AdminPrototypeShell>
  );
}

function getReportFilters(searchParams: Record<string, string | string[] | undefined> | undefined): ReportFilters {
  return {
    orgId: getSingleQueryValue(searchParams?.orgId),
    willAge: getSingleQueryValue(searchParams?.willAge),
    estateValue: getSingleQueryValue(searchParams?.estateValue),
    possessionsValue: getSingleQueryValue(searchParams?.possessionsValue),
    reviewStatus: getSingleQueryValue(searchParams?.reviewStatus),
    executorStatus: getSingleQueryValue(searchParams?.executorStatus),
    adviserStatus: getSingleQueryValue(searchParams?.adviserStatus),
    consentStatus: getSingleQueryValue(searchParams?.consentStatus),
    vaultCompleteness: getSingleQueryValue(searchParams?.vaultCompleteness),
    opportunityLevel: getSingleQueryValue(searchParams?.opportunityLevel),
    outreachReady: getSingleQueryValue(searchParams?.outreachReady),
    consentBlocked: getSingleQueryValue(searchParams?.consentBlocked),
  };
}

function getSingleQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildInsightCards(metrics: ReturnType<typeof buildReportMetrics>) {
  return [
    { label: "Clients in scope", value: String(metrics.clientsInScope), detail: "Current report filter" },
    { label: "Clients needing review (consented only)", value: String(metrics.reviewDue), detail: "Overdue or due now" },
    { label: "Clients missing consent", value: String(metrics.consentBlocked), detail: "Restricted before detail generation" },
    { label: "Incomplete vaults (consented only)", value: String(metrics.incompleteVaults), detail: "Under 70% complete" },
    { label: "Missing executors (consented only)", value: String(metrics.executorMissing), detail: "Executor status indicator" },
    { label: "Adviser insight consent", value: String(metrics.adviserInsightConsent), detail: "Consent indicator only" },
    { label: "Marketing permission", value: String(metrics.marketingPermission), detail: "Subject to communication preference" },
    { label: "Wills older than 5 years", value: String(metrics.willOutdated), detail: "Review opportunity only" },
    { label: "Clients without advisers", value: String(metrics.adviserMissing), detail: "Advice gap indicator" },
    { label: "Critical insights", value: String(metrics.criticalInsights), detail: "Highest priority signals" },
  ];
}

function formatSeverity(severity: ClientInsightSeverity) {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoStyle}>
      <span style={metricLabelStyle}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function OpportunityCard({ score }: { score: ClientOpportunityScore }) {
  return (
    <section style={opportunityCardStyle(score.scoreLevel)}>
      <span style={opportunityBadgeStyle(score.scoreLevel)}>{score.scoreLevel}</span>
      <strong>{score.clientId}</strong>
      <span style={mutedTextStyle}>Reasons: {score.reasons.join(", ") || "No immediate signal"}</span>
      <span style={mutedTextStyle}>Blockers: {score.blockers.join(", ") || "None"}</span>
      <span style={mutedTextStyle}>Next step: {score.recommendedNextStep}</span>
    </section>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th style={thStyle}>{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td style={tdStyle}>{children}</td>;
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
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
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

const twoColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(280px, 0.7fr) minmax(0, 1.3fr)",
  gap: 14,
};

const panelStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: 16,
  display: "grid",
  gap: 12,
};

const invalidFilterStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e1d5cd",
  borderRadius: 8,
  color: "var(--lf-bronze)",
  padding: 14,
  display: "grid",
  gap: 8,
  fontSize: 13,
};

const textLinkStyle: CSSProperties = {
  color: "var(--lf-bronze)",
  fontWeight: 800,
  textDecoration: "none",
};

const h2Style: CSSProperties = {
  margin: 0,
  fontSize: 17,
};

const infoStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  borderBottom: "1px solid #f1ece8",
  paddingBottom: 9,
};

const helperTextStyle: CSSProperties = {
  margin: 0,
  color: "var(--lf-text-soft)",
  fontSize: 13,
};

const signalGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 10,
};

const opportunityMetricsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

function opportunityBadgeStyle(level: ClientOpportunityScore["scoreLevel"]): CSSProperties {
  return {
    width: "fit-content",
    borderRadius: 999,
    padding: "4px 8px",
    background: level === "blocked" ? "#fef2f2" : level === "high" ? "#fff7ed" : "var(--lf-surface-muted)",
    color: level === "blocked" ? "#991b1b" : level === "high" ? "#9a3412" : "var(--lf-text-soft)",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
  };
}

function opportunityCardStyle(level: ClientOpportunityScore["scoreLevel"]): CSSProperties {
  return {
    border: level === "blocked" ? "1px solid #fecaca" : level === "high" ? "1px solid #e1d5cd" : "1px solid var(--lf-border)",
    borderRadius: 8,
    background: "#fff",
    padding: 12,
    display: "grid",
    gap: 6,
  };
}

function signalCardStyle(severity: ClientInsightSeverity): CSSProperties {
  return {
    border: severity === "critical" ? "1px solid #fecaca" : severity === "high" ? "1px solid #e1d5cd" : "1px solid var(--lf-border)",
    borderRadius: 8,
    background: "#fff",
    padding: 12,
    display: "grid",
    gap: 6,
  };
}

const restrictedCardStyle: CSSProperties = {
  border: "1px solid #e1d5cd",
  borderRadius: 8,
  background: "var(--lf-surface-muted)",
  padding: 12,
  display: "grid",
  gap: 6,
};

function severityBadgeStyle(severity: ClientInsightSeverity): CSSProperties {
  return {
    width: "fit-content",
    borderRadius: 999,
    padding: "4px 8px",
    background: severity === "critical" ? "#fef2f2" : severity === "high" ? "#fff7ed" : "var(--lf-surface-muted)",
    color: severity === "critical" ? "#991b1b" : severity === "high" ? "#9a3412" : "var(--lf-text-soft)",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
  };
}

const mutedTextStyle: CSSProperties = {
  color: "var(--lf-text-soft)",
  fontSize: 13,
};

const disabledButtonStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  background: "var(--lf-surface-muted)",
  color: "var(--lf-text-soft)",
  padding: "9px 12px",
  fontWeight: 800,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 11px",
  borderBottom: "1px solid var(--lf-border)",
  color: "var(--lf-text-soft)",
  fontSize: 11,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: "10px 11px",
  borderBottom: "1px solid #f1ece8",
  whiteSpace: "nowrap",
};

const emptyTableCellStyle: CSSProperties = {
  padding: 18,
  color: "var(--lf-text-soft)",
  textAlign: "center",
  borderBottom: "1px solid #f1ece8",
};
