import Link from "next/link";
import AdminPrototypeShell from "@/components/admin/prototype/AdminPrototypeShell";
import ReportFilterBar from "@/components/admin/prototype/ReportFilterBar";
import {
  PlatformChip,
  PlatformInfoTile,
  PlatformNotice,
  PlatformSection,
  platformChipRowStyle,
  platformInfoGridStyle,
} from "@/components/ui/PlatformPrimitives";
import { getReportPrototypeData } from "@/components/admin/prototype/prototypeDataService";
import {
  type ReportFilters,
} from "@/components/admin/prototype/reportInsights";
import type { CSSProperties } from "react";

type OrganisationReportsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrganisationReportsPage({ searchParams }: OrganisationReportsPageProps) {
  const resolvedSearchParams = await searchParams;
  const filters = getReportFilters(resolvedSearchParams);
  const orgId = filters.orgId;
  const data = getReportPrototypeData(filters, "reports");
  const clearHref = "/internal/admin/prototype/reports";

  return (
    <AdminPrototypeShell
      title={data.selectedOrganisation ? `${data.selectedOrganisation.name} reports` : "Organisation reports"}
      description={data.selectedOrganisation
        ? "Static organisation-scoped reporting prototype using safe portfolio bands and consent indicators."
        : "Static reporting prototype for licence holders, client portfolio insight, and review opportunities."}
    >
      <PlatformNotice icon="lock">
        Client insights and outreach depend on explicit client consent. Some records are restricted. Static prototype — mock data; no exports or campaigns are enabled.
      </PlatformNotice>

      <PlatformSection
        title="Reporting hierarchy"
        detail="Portfolio reporting starts with consent scope, then review readiness, then safe opportunity signals. Audit and export controls remain visible but disabled."
        icon="account_tree"
      >
        <div style={platformChipRowStyle}>
          <PlatformChip>1. Consent scope</PlatformChip>
          <PlatformChip>2. Review signals</PlatformChip>
          <PlatformChip>3. Opportunity bands</PlatformChip>
          <PlatformChip>4. Export blocked</PlatformChip>
        </div>
        <div style={miniListStyle} aria-label="Reporting operational timeline">
          {data.operationalTimeline.slice(0, 3).map((event) => (
            <div key={event.id} style={miniRowStyle}>
              <strong>{event.label}</strong>
              <span>{event.detail} · {event.time}</span>
            </div>
          ))}
        </div>
      </PlatformSection>

      {data.invalidOrganisationFilter ? (
        <section style={invalidFilterStyle}>
          <strong>Invalid organisation filter</strong>
          <span>The organisation ID {orgId} is not available in the static prototype dataset.</span>
          <Link href="/internal/admin/prototype/organisations" style={textLinkStyle}>Back to organisations</Link>
        </section>
      ) : null}

      {!data.invalidOrganisationFilter ? (
        <ReportFilterBar
          filters={filters}
          organisations={data.organisations}
          lockedOrganisationName={data.selectedOrganisation?.name}
          activeChips={data.activeChips}
          clearHref={clearHref}
        />
      ) : null}

      <section style={metricsGridStyle}>
        <Metric label="Organisations in scope" value={data.invalidOrganisationFilter ? "0" : String(data.selectedOrganisation ? 1 : data.organisations.length)} />
        <Metric label="Clients in scope" value={String(data.reportMetrics.clientsInScope)} />
        <Metric label="Clients needing review (consented only)" value={String(data.reportMetrics.reviewDue)} />
        <Metric label="Clients missing consent" value={String(data.reportMetrics.consentBlocked)} />
        <Metric label="Incomplete vaults (consented only)" value={String(data.reportMetrics.incompleteVaults)} />
        <Metric label="Missing executors (consented only)" value={String(data.reportMetrics.executorMissing)} />
        <Metric label="Adviser insight consent" value={String(data.reportMetrics.adviserInsightConsent)} />
        <Metric label="Marketing permission" value={String(data.reportMetrics.marketingPermission)} />
        <Metric label="Will outdated" value={String(data.reportMetrics.willOutdated)} />
        <Metric label="Critical insights" value={String(data.reportMetrics.criticalInsights)} />
        <Metric label="High opportunity clients" value={String(data.reportMetrics.highOpportunity)} />
        <Metric label="Medium opportunity clients" value={String(data.reportMetrics.mediumOpportunity)} />
        <Metric label="Blocked by consent" value={String(data.reportMetrics.blockedOpportunity)} />
        <Metric label="Outreach-ready clients" value={String(data.reportMetrics.outreachReady)} />
      </section>

      <section style={panelStyle}>
        <h2 style={h2Style}>Portfolio opportunity</h2>
        <p style={mutedParagraphStyle}>
          Opportunity scoring uses only consent-gated, banded, mock data. Non-consented clients are blocked and expose consent_missing only.
        </p>
        <div style={opportunityGridStyle}>
          <OpportunityTile label="High" value={String(data.reportMetrics.highOpportunity)} />
          <OpportunityTile label="Medium" value={String(data.reportMetrics.mediumOpportunity)} />
          <OpportunityTile label="Consent blocked" value={String(data.reportMetrics.blockedOpportunity)} />
          <OpportunityTile label="Outreach ready" value={String(data.reportMetrics.outreachReady)} />
          <OpportunityTile label="Review due" value={String(data.reportMetrics.reviewDue)} />
        </div>
        <div style={miniListStyle}>
          {data.opportunityScores.slice(0, 5).map((score) => (
            <div key={score.clientId} style={miniRowStyle}>
              <strong>{score.clientId}</strong>
              <span>{score.scoreLevel} · {score.recommendedNextStep}</span>
            </div>
          ))}
        </div>
      </section>

      <PlatformSection
        title="Compliance governance"
        detail="Shared consent, export, and audit readiness controls for report prototypes."
        icon="shield"
      >
        <div style={platformInfoGridStyle}>
          <PlatformInfoTile label="Insight allowed" value={String(data.governance.adviserInsightAllowed)} tone="success" />
          <PlatformInfoTile label="Insight restricted" value={String(data.governance.adviserInsightRestricted)} tone={data.governance.adviserInsightRestricted ? "warning" : "success"} />
          <PlatformInfoTile label="Marketing allowed" value={String(data.governance.marketingAllowed)} />
          <PlatformInfoTile label="Exports" value="Disabled" tone="warning" />
        </div>
        <p style={mutedParagraphStyle}>{data.governance.exportReason}</p>
        <div style={platformChipRowStyle} aria-label="Report governance safeguards">
          {data.governance.safeguards.map((item) => (
            <PlatformChip key={item}>{item}</PlatformChip>
          ))}
        </div>
        <div style={miniListStyle} aria-label="Audit preview">
          {data.auditPreviewEvents.map((event) => (
            <div key={event.id} style={miniRowStyle}>
              <strong>{event.action}</strong>
              <span>{event.actor.displayName} · {event.result.replace(/_/g, " ")}</span>
            </div>
          ))}
        </div>
      </PlatformSection>

      <section style={panelStyle}>
        <h2 style={h2Style}>Available report prototypes</h2>
        <Link href={buildClientInsightsHref(filters, data.selectedOrganisation?.id)} style={reportLinkStyle}>
          <span>
            <strong>Client insights and review opportunities</strong>
            <span style={mutedBlockStyle}>
              Open the filtered client list and structured insight engine. Current reportable scope contains {data.reportableClients.length} mock client(s); {data.consentBlocked} filtered client(s) are blocked by consent.
            </span>
          </span>
          <span style={openLabelStyle}>Open</span>
        </Link>
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

function buildClientInsightsHref(filters: ReportFilters, lockedOrgId?: string) {
  const params = new URLSearchParams();
  const nextFilters = { ...filters, orgId: lockedOrgId ?? filters.orgId };
  Object.entries(nextFilters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return `/internal/admin/prototype/reports/client-insights${params.toString() ? `?${params.toString()}` : ""}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <section style={metricStyle}>
      <span style={metricLabelStyle}>{label}</span>
      <strong style={{ fontSize: 28 }}>{value}</strong>
    </section>
  );
}

function OpportunityTile({ label, value }: { label: string; value: string }) {
  return (
    <section style={opportunityTileStyle}>
      <span style={metricLabelStyle}>{label}</span>
      <strong>{value}</strong>
    </section>
  );
}

const metricsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
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

const panelStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: 16,
  display: "grid",
  gap: 12,
};

const mutedParagraphStyle: CSSProperties = {
  margin: 0,
  color: "var(--lf-text-soft)",
  fontSize: 13,
  lineHeight: 1.45,
};

const opportunityGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
};

const opportunityTileStyle: CSSProperties = {
  border: "1px solid #f1ece8",
  borderRadius: 8,
  padding: 11,
  display: "grid",
  gap: 4,
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
  gap: 10,
  flexWrap: "wrap",
  color: "var(--lf-text-soft)",
  fontSize: 13,
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

const reportLinkStyle: CSSProperties = {
  textDecoration: "none",
  color: "var(--lf-text)",
  border: "1px solid #f1ece8",
  borderRadius: 8,
  padding: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const mutedBlockStyle: CSSProperties = {
  display: "block",
  color: "var(--lf-text-soft)",
  fontSize: 13,
  marginTop: 3,
};

const openLabelStyle: CSSProperties = {
  color: "var(--lf-text)",
  fontSize: 13,
  fontWeight: 800,
};
