import Link from "next/link";
import AdminPrototypeShell from "@/components/admin/prototype/AdminPrototypeShell";
import AdminStatusBadge from "@/components/admin/prototype/AdminStatusBadge";
import {
  findOrganisation,
  getLicencePlanForOrganisation,
  getOrganisationClients,
  getOrganisationUsers,
  type OrganisationClient,
  type OrganisationUser,
} from "@/components/admin/prototype/mockData";
import {
  buildClientOpportunityScores,
  buildReportMetrics,
  getClientOpportunityScore,
  type ClientOpportunityScore,
} from "@/components/admin/prototype/reportInsights";
import type { CSSProperties, ReactNode } from "react";

type OrganisationDetailPageProps = {
  params: Promise<{ orgId: string }>;
};

export default async function OrganisationDetailPage({ params }: OrganisationDetailPageProps) {
  const { orgId } = await params;
  const org = findOrganisation(orgId);

  if (!org) {
    return (
      <AdminPrototypeShell
        title="Organisation not found"
        description="The requested static organisation record does not exist in the prototype dataset."
      >
        <section style={noticeStyle}>
          Enterprise prototype — static mock data. No live organisation or client data was requested.
        </section>
        <section style={notFoundStyle}>
          <strong>Organisation not found</strong>
          <span>The organisation ID "{orgId}" is not available in this static prototype.</span>
          <Link href="/internal/admin/prototype/organisations" style={ctaStyle}>Back to organisations</Link>
        </section>
      </AdminPrototypeShell>
    );
  }

  const clients = getOrganisationClients(org.id);
  const orgUsers = getOrganisationUsers(org.id);
  const licencePlan = getLicencePlanForOrganisation(org.id);
  const includedSeats = licencePlan?.includedSeats ?? org.clientSeats;
  const usedSeats = licencePlan?.usedSeats ?? org.activeClients;
  const clientLimit = licencePlan?.clientLimit ?? org.clientSeats;
  const seatUtilisation = includedSeats > 0 ? Math.round((usedSeats / includedSeats) * 100) : 0;
  const seatsAvailable = includedSeats - usedSeats;
  const reportableClients = clients.filter((client) => client.consent.adviserInsights);
  const opportunityScores = buildClientOpportunityScores(clients);
  const opportunityMetrics = buildReportMetrics(clients);
  const reviewDueClients = reportableClients.filter((client) => /overdue|now/i.test(client.nextReviewDue)).length;
  const adviserConsentClients = reportableClients.length;
  const marketingAllowedClients = reportableClients.filter((client) => client.consent.marketing).length;
  const missingConsentClients = clients.filter((client) => !client.consent.adviserInsights || !client.consent.marketing).length;
  const renewalWarning = org.status === "Pending" || org.status === "Review" || licencePlan?.billingStatus === "Renewal due";

  return (
    <AdminPrototypeShell
      title={org.name}
      description={`${org.type} organisation · ${org.licenceType} · static licensing, adviser, consent, and client-portfolio prototype.`}
    >
      <section style={noticeStyle}>
        Enterprise prototype — static mock data. Reporting and insight panels are consent-gated. Client financial information is shown as bands only; no documents, account details, private notes, exports, or live billing actions are enabled.
      </section>

      <section style={summaryGridStyle} aria-label="Organisation summary">
        <InfoCard label="Licence type" value={org.licenceType} />
        <InfoCard label="Licence plan" value={licencePlan?.planName ?? "Not connected"} detail={licencePlan?.planTier} />
        <InfoCard label="Status" value={<AdminStatusBadge status={org.status === "Review" ? "Pending" : org.status} />} />
        <InfoCard label="Owner contact" value={org.accountOwner} />
        <InfoCard label="Renewal date" value={licencePlan?.renewalDate ?? org.renewalDate} />
        <InfoCard label="Seats" value={`${usedSeats}/${includedSeats}`} detail={`${seatsAvailable} available`} />
        <InfoCard label="Client limit" value={String(clientLimit)} />
        <InfoCard label="Billing" value={licencePlan?.billingStatus ?? "Not connected"} />
        <InfoCard label="Active clients" value={String(org.activeClients)} />
        <InfoCard label="Pending invites" value={String(org.pendingInvitations)} />
      </section>

      <section style={twoColumnStyle}>
        <section style={panelStyle}>
          <PanelHeading title="Licence health" />
          <div style={infoGridStyle}>
            <Info label="Plan tier" value={licencePlan?.planTier ?? org.licenceType} />
            <Info label="Plan ID" value={licencePlan?.planId ?? org.planId} />
            <Info label="Seat utilisation" value={`${seatUtilisation}%`} />
            <Info label="Used seats" value={`${usedSeats}/${includedSeats}`} />
            <Info label="Client limit" value={String(clientLimit)} />
            <Info label="Billing status" value={licencePlan?.billingStatus ?? "Not connected"} />
            <Info label="Licence status" value={licencePlan?.licenceStatus ?? org.status} />
            <Info label="Renewal warning" value={renewalWarning ? "Review required" : "No immediate warning"} />
          </div>
          {licencePlan ? (
            <div style={tagRowStyle}>
              {licencePlan.features.map((feature) => (
                <span key={feature} style={tagStyle}>{feature}</span>
              ))}
            </div>
          ) : null}
          <div style={warningStyle}>
            Prototype only — billing not connected. Upgrade, renewal, invoice, and billing actions are disabled.
          </div>
          <Link href={`/internal/admin/prototype/licences?orgId=${org.id}`} style={ctaStyle}>View licence summary</Link>
        </section>

        <section style={panelStyle}>
          <PanelHeading title="Consent & compliance" />
          <div style={infoGridStyle}>
            <Info label="Adviser insight consent" value={`${adviserConsentClients} clients`} />
            <Info label="Marketing consent" value={`${marketingAllowedClients} clients`} />
            <Info label="Missing or restricted consent" value={`${missingConsentClients} clients`} />
          </div>
          <section style={warningStyle}>
            Reports exclude clients without adviser insight consent. Outreach also requires marketing consent, firm approval, and audit logging.
          </section>
        </section>
      </section>

      <section style={panelStyle}>
        <PanelHeading title="Adviser / user panel" actions={<DisabledActions labels={["Invite user", "Suspend user", "Change role"]} />} />
        <OrganisationUsersTable users={orgUsers} />
      </section>

      <section style={panelStyle}>
        <PanelHeading title="Client portfolio" />
        <ClientPortfolioTable clients={clients} opportunityScores={opportunityScores} />
      </section>

      <section style={panelStyle}>
        <PanelHeading title="Portfolio opportunity" />
        <div style={infoGridStyle}>
          <Info label="High opportunity clients" value={String(opportunityMetrics.highOpportunity)} />
          <Info label="Medium opportunity clients" value={String(opportunityMetrics.mediumOpportunity)} />
          <Info label="Blocked by consent" value={String(opportunityMetrics.blockedOpportunity)} />
          <Info label="Outreach ready" value={String(opportunityMetrics.outreachReady)} />
          <Info label="Review due" value={String(opportunityMetrics.reviewDue)} />
        </div>
        <div style={tagRowStyle}>
          {opportunityScores.map((score) => (
            <span key={score.clientId} style={tagStyle}>{score.clientId}: {score.scoreLevel} · {score.recommendedNextStep}</span>
          ))}
        </div>
      </section>

      <section style={twoColumnStyle}>
        <section style={panelStyle}>
          <PanelHeading title="Reporting shortcuts" />
          <div style={shortcutGridStyle}>
            <Link href={`/internal/admin/prototype/reports?orgId=${org.id}`} style={shortcutStyle}>
              Reports
              <span>Open consent-gated organisation report filters</span>
            </Link>
            <Link href={`/internal/admin/prototype/reports/client-insights?orgId=${org.id}`} style={shortcutStyle}>
              Client insights
              <span>Review consent-gated safe portfolio signals</span>
            </Link>
          </div>
        </section>

        <section style={panelStyle}>
          <PanelHeading title="Audit / activity preview" />
          <div style={activityListStyle}>
            <Activity text="Licence status reviewed" meta={`${org.accountOwner} · Static activity`} />
            <Activity text="Adviser invited" meta="Organisation user invite preview" />
            <Activity text="Report viewed" meta="Client insight report opened" />
            <Activity text="Consent reviewed" meta={`${reviewDueClients} review item(s) flagged`} />
          </div>
        </section>
      </section>

      <section style={panelStyle}>
        <PanelHeading title="Data-access boundaries" />
        <div style={boundaryGridStyle}>
          <Boundary text="Only clients linked to this organisation would be visible." />
          <Boundary text="Reports and insight signals require explicit adviser insight consent." />
          <Boundary text="Financial values remain banded, not exact." />
          <Boundary text="No account details, documents, or private notes are shown." />
          <Boundary text="Exports, campaigns, billing, and user actions are disabled." />
        </div>
      </section>
    </AdminPrototypeShell>
  );
}

function PanelHeading({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div style={panelHeaderStyle}>
      <h2 style={h2Style}>{title}</h2>
      {actions}
    </div>
  );
}

function InfoCard({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return (
    <section style={metricStyle}>
      <span style={metricLabelStyle}>{label}</span>
      <strong style={{ fontSize: 22 }}>{value}</strong>
      {detail ? <span style={{ color: "var(--lf-text-soft)", fontSize: 12 }}>{detail}</span> : null}
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

function DisabledActions({ labels }: { labels: string[] }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {labels.map((label) => (
        <button key={label} type="button" disabled style={disabledButtonStyle}>{label}</button>
      ))}
    </div>
  );
}

function OrganisationUsersTable({ users }: { users: OrganisationUser[] }) {
  return (
    <div style={{ overflow: "auto" }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Role</Th>
            <Th>Status</Th>
            <Th>Assigned clients</Th>
            <Th>Last active</Th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <Td><strong>{user.name}</strong></Td>
              <Td>{user.role}</Td>
              <Td><AdminStatusBadge status={user.status === "Invited" ? "Pending" : user.status} /></Td>
              <Td>{user.assignedClients}</Td>
              <Td>{user.lastActive}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClientPortfolioTable({ clients, opportunityScores }: { clients: OrganisationClient[]; opportunityScores: ClientOpportunityScore[] }) {
  return (
    <div style={{ overflow: "auto" }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <Th>Client</Th>
            <Th>Adviser</Th>
            <Th>Review status</Th>
            <Th>Will age band</Th>
            <Th>Estate value band</Th>
            <Th>Possessions band</Th>
            <Th>Consent</Th>
            <Th>Opportunity</Th>
            <Th>Outreach</Th>
            <Th>Blockers</Th>
            <Th>Executor</Th>
            <Th>Adviser appointed</Th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => {
            const opportunity = getClientOpportunityScore(client, opportunityScores);
            return (
              <tr key={client.id}>
                <Td><strong>{client.clientName}</strong></Td>
                <Td>{client.assignedProfessional}</Td>
                <Td>{client.nextReviewDue}</Td>
                <Td>{client.willAge}</Td>
                <Td>{client.estateValueBand}</Td>
                <Td>{client.possessionsValueBand}</Td>
                <Td>{client.consent.adviserInsights ? "Insights allowed" : "Insights blocked"} · {client.consent.marketing ? "Marketing allowed" : "Marketing blocked"}</Td>
                <Td>{opportunity.scoreLevel}</Td>
                <Td>{opportunity.outreachReady ? "Ready" : "Not ready"}</Td>
                <Td>{opportunity.blockers.join(", ") || "None"}</Td>
                <Td>{client.executorAppointed ? "Appointed" : "Not appointed"}</Td>
                <Td>{client.adviserAppointed ? "Appointed" : "Not appointed"}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Activity({ text, meta }: { text: string; meta: string }) {
  return (
    <div style={activityRowStyle}>
      <strong>{text}</strong>
      <span>{meta}</span>
    </div>
  );
}

function Boundary({ text }: { text: string }) {
  return <div style={boundaryStyle}>{text}</div>;
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

const notFoundStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e1d5cd",
  borderRadius: 8,
  color: "var(--lf-bronze)",
  padding: 18,
  display: "grid",
  gap: 10,
  fontSize: 14,
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
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
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
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

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const h2Style: CSSProperties = {
  margin: 0,
  fontSize: 17,
};

const infoGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 10,
};

const infoStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  border: "1px solid #f1ece8",
  borderRadius: 8,
  padding: 10,
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

const warningStyle: CSSProperties = {
  border: "1px solid #e1d5cd",
  borderRadius: 8,
  background: "#fff7ed",
  color: "#9a3412",
  padding: 11,
  fontSize: 13,
  fontWeight: 700,
};

const disabledButtonStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  background: "var(--lf-surface-muted)",
  color: "var(--lf-text-soft)",
  padding: "7px 9px",
  fontSize: 12,
  fontWeight: 800,
};

const shortcutGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 10,
};

const tagRowStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const tagStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 999,
  background: "var(--lf-surface-muted)",
  color: "var(--lf-text)",
  padding: "5px 8px",
  fontSize: 12,
  fontWeight: 800,
};

const shortcutStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  color: "var(--lf-text)",
  textDecoration: "none",
  padding: 12,
  display: "grid",
  gap: 4,
  fontWeight: 800,
};

const activityListStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const activityRowStyle: CSSProperties = {
  border: "1px solid #f1ece8",
  borderRadius: 8,
  padding: 10,
  display: "grid",
  gap: 3,
  color: "var(--lf-text)",
  fontSize: 13,
};

const boundaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const boundaryStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  background: "var(--lf-surface-muted)",
  color: "var(--lf-text)",
  padding: 11,
  fontSize: 13,
  lineHeight: 1.45,
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
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: "10px 11px",
  borderBottom: "1px solid #f1ece8",
  verticalAlign: "top",
  whiteSpace: "nowrap",
};
