import Link from "next/link";
import AdminPrototypeShell from "@/components/admin/prototype/AdminPrototypeShell";
import AdminStatusBadge from "@/components/admin/prototype/AdminStatusBadge";
import {
  PlatformChip,
  PlatformActionRow,
  PlatformInfoTile,
  PlatformNotice,
  PlatformSection,
  PlatformStatCard,
  platformChipRowStyle,
  platformCtaStyle,
  platformInfoGridStyle,
  platformKpiGridStyle,
} from "@/components/ui/PlatformPrimitives";
import { getEnterpriseCommandCentreData } from "@/components/admin/prototype/prototypeDataService";
import { buildPrototypePreviewHref } from "@/lib/testPersonas";
import type { CSSProperties } from "react";

type EnterpriseDashboardPageProps = {
  searchParams?: Promise<{ role?: string }>;
};

export default async function EnterpriseDashboardPage({ searchParams }: EnterpriseDashboardPageProps) {
  const params = await searchParams;
  const currentRole = params?.role ?? "super_admin";
  const usersHref = buildPrototypePreviewHref("/internal/admin/prototype/users", currentRole);
  const data = getEnterpriseCommandCentreData();
  const canManageUserPermissions = currentRole === "super_admin";

  return (
    <AdminPrototypeShell
      title="Enterprise dashboard"
      description="A calm commercial command centre for organisation licensing, consent-gated insight, and portfolio review."
    >
      <PlatformNotice>
        Enterprise prototype — static mock data. Insights stay consent-gated, values remain banded, and no exports, campaigns, live billing, or real client vault data are enabled.
      </PlatformNotice>

      {canManageUserPermissions ? (
        <PlatformSection
          title="Users & Permissions"
          detail="Manage registered individuals, review role assignments, and inspect permission changes from one governance-aware admin area."
          icon="manage_accounts"
          emphasis="primary"
          action={<Link href={usersHref} style={primaryCtaStyle}>Open Users & Permissions</Link>}
        >
          <div style={userManagementActionsStyle}>
            <PlatformActionRow
              title="Manage registered individuals"
              detail="Open the directory for account owners, invitees, sub-admins, organisation contacts, and platform administrators."
              status={<AdminStatusBadge status="Success" />}
              action={<Link href={usersHref} style={platformCtaStyle}>Open directory</Link>}
            />
            <PlatformActionRow
              title="Review roles & permissions"
              detail="Inspect account-level roles, platform roles, permission toggles, and workflow states."
              status={<AdminStatusBadge status="Review" />}
              action={<Link href={usersHref} style={platformCtaStyle}>Review access</Link>}
            />
          <PlatformActionRow
            title="Grant or revoke admin rights"
              detail="Super admin only. Select registered account holders, assign administrator roles, and toggle tailored permissions before owner approval."
              status={<AdminStatusBadge status="Restricted" />}
              action={<Link href={usersHref} style={platformCtaStyle}>Manage admin rights</Link>}
            />
          </div>
        </PlatformSection>
      ) : null}

      <section style={platformKpiGridStyle} aria-label="Operational Summary">
        <PlatformStatCard icon="corporate_fare" label="Licensed organisations" value={String(data.totalLicensedOrganisations)} detail="Professional accounts" />
        <PlatformStatCard icon="verified" label="Active licences" value={String(data.activeLicences)} detail={`${data.licenceMetrics.suspendedOrExpiredLicences} need attention`} tone={data.licenceMetrics.suspendedOrExpiredLicences ? "warning" : "success"} />
        <PlatformStatCard icon="event_seat" label="Seats used" value={`${data.seatsUsed}/${data.totalSeats}`} detail={`${data.seatsAvailable} available`} />
        <PlatformStatCard icon="event_repeat" label="Renewals due" value={String(data.renewalWarnings)} detail="Next 90 days" tone={data.renewalWarnings ? "warning" : "success"} />
        <PlatformStatCard icon="lock" label="Consent-gated clients" value={String(data.consentGatedClients)} detail={`${data.insightConsentedClients} insight-ready`} tone={data.consentGatedClients ? "warning" : "success"} />
        <PlatformStatCard icon="trending_up" label="High opportunities" value={String(data.opportunityMetrics.highOpportunity)} detail={`${data.opportunityMetrics.outreachReady} outreach-ready`} />
      </section>

      <section className="lf-enterprise-command-centre" style={commandCentreStyle} aria-label="Enterprise command centre">
        <div style={primaryColumnStyle}>
          <PlatformSection
            title="Organisation Health"
            detail={`${data.organisations.length} organisations are represented in this mock portfolio. ${data.organisationHealth.atRisk} at risk, ${data.organisationHealth.watch} on watch, ${data.rolloutStates.needsSetup} needing setup.`}
            icon="corporate_fare"
            emphasis="primary"
            action={<Link href="/internal/admin/prototype/organisations" style={platformCtaStyle}>Open organisations</Link>}
          >
            <div style={miniListStyle}>
              {data.organisations.slice(0, 3).map((org) => (
                <div key={org.id} style={miniRowStyle}>
                  <span>
                    <strong>{org.name}</strong>
                    <span style={mutedBlockStyle}>{org.type} · {org.healthState} · {org.onboardingState}</span>
                  </span>
                  <AdminStatusBadge status={org.status === "Review" ? "Pending" : org.status} />
                </div>
              ))}
            </div>
          </PlatformSection>

          <PlatformSection
            title="Recent organisation activity"
            detail="A quiet operational feed for the latest review points. Static preview only; no audit event is written from this prototype."
            icon="history"
            action={<Link href="/internal/admin/prototype/reports" style={platformCtaStyle}>Open reports</Link>}
          >
            <div style={activityListStyle}>
              {data.recentActivity.map((activity) => (
                <div key={activity.id} style={activityRowStyle}>
                  <span style={activityDotStyle(activity.tone)} aria-hidden="true" />
                  <span>
                    <strong>{activity.label}</strong>
                    <span style={mutedBlockStyle}>{activity.detail} · {activity.time}</span>
                  </span>
                </div>
              ))}
            </div>
          </PlatformSection>

          <PlatformSection
            title="Licensing & Usage"
            detail={`${data.renewalWarnings} organisations need renewal, onboarding, or account review attention. Prototype only — billing not connected.`}
            icon="event_repeat"
            action={<Link href="/internal/admin/prototype/licences" style={platformCtaStyle}>Open licences</Link>}
          >
            <div style={platformInfoGridStyle}>
              <PlatformInfoTile label="Seats used" value={String(data.seatsUsed)} />
              <PlatformInfoTile label="Seats available" value={String(data.seatsAvailable)} />
              <PlatformInfoTile label="Renewal warnings" value={String(data.renewalWarnings)} tone={data.renewalWarnings ? "warning" : "default"} />
              <PlatformInfoTile label="Client capacity" value={String(data.licenceMetrics.clientsUnderLimit)} />
              <PlatformInfoTile label="Ready rollout" value={String(data.rolloutStates.ready)} tone="success" />
              <PlatformInfoTile label="Setup needed" value={String(data.rolloutStates.needsSetup)} tone={data.rolloutStates.needsSetup ? "warning" : "success"} />
            </div>
          </PlatformSection>
        </div>

        <aside style={secondaryColumnStyle}>
          <PlatformSection
            title="Commercial Activity"
            detail="Strategic signals use consent-gated insight and banded values only. Non-consented clients are blocked before planning reasons are calculated."
            icon="trending_up"
            emphasis="primary"
            action={<Link href="/internal/admin/prototype/reports/client-insights" style={platformCtaStyle}>Open opportunity report</Link>}
          >
            <div style={opportunityStackStyle}>
              <PlatformInfoTile label="Blocked by consent" value={String(data.opportunityMetrics.blockedOpportunity)} tone="warning" />
              <PlatformInfoTile label="Review recommended" value={String(data.opportunityMetrics.reviewDue)} />
              <PlatformInfoTile label="Outreach ready" value={String(data.opportunityMetrics.outreachReady)} tone="success" />
            </div>
            <div style={platformChipRowStyle}>
              {data.opportunityScores.slice(0, 3).map((score) => (
                <PlatformChip key={score.clientId}>{score.clientId}: {score.scoreLevel}</PlatformChip>
              ))}
            </div>
          </PlatformSection>

          <PlatformSection
            title="Consent and compliance readiness"
            detail="Marketing contact requires adviser insight consent, marketing consent, communication preference, and firm approval."
            icon="lock"
            action={<Link href="/internal/admin/prototype/reports/client-insights" style={platformCtaStyle}>Review readiness</Link>}
          >
            <div style={platformInfoGridStyle}>
              <PlatformInfoTile label="Insight allowed" value={String(data.complianceGovernance.adviserInsightAllowed)} tone="success" />
              <PlatformInfoTile label="Insight restricted" value={String(data.complianceGovernance.adviserInsightRestricted)} tone={data.complianceGovernance.adviserInsightRestricted ? "warning" : "success"} />
              <PlatformInfoTile label="Marketing allowed" value={String(data.complianceGovernance.marketingAllowed)} />
              <PlatformInfoTile label="Exports" value="Disabled" tone="warning" />
            </div>
            <div style={complianceNoteStyle}>
              {data.complianceGovernance.restrictedDataRule}
            </div>
            <div style={platformChipRowStyle} aria-label="Audit preview">
              {data.auditPreviewEvents.map((event) => (
                <PlatformChip key={event.id}>{event.action}</PlatformChip>
              ))}
            </div>
          </PlatformSection>

          <PlatformSection
            title="Reporting & Intelligence"
            detail="Reports are available as static, consent-gated insight views. Exports, campaigns, and live report jobs remain disabled."
            icon="bar_chart"
            action={<Link href="/internal/admin/prototype/reports" style={platformCtaStyle}>Open reports</Link>}
          >
            <div style={platformChipRowStyle} aria-label="Quick report filters">
              <PlatformChip>Review due</PlatformChip>
              <PlatformChip>Consent status</PlatformChip>
              <PlatformChip>Incomplete vault</PlatformChip>
              <PlatformChip>Outreach ready</PlatformChip>
            </div>
          </PlatformSection>

          <PlatformSection
            title="Probate & Executor Oversight"
            detail="Executor, will, and review indicators are shown as operational signals only. This prototype does not make legal decisions or validate documents."
            icon="shield_lock"
            action={<Link href="/internal/admin/prototype/cases" style={platformCtaStyle}>Open probate cases</Link>}
          >
            <div style={platformInfoGridStyle}>
              <PlatformInfoTile label="Review due" value={String(data.reviewDueClients)} />
              <PlatformInfoTile label="Executors missing" value={String(data.missingExecutorClients)} tone={data.missingExecutorClients ? "warning" : "success"} />
              <PlatformInfoTile label="Will review" value={String(data.outdatedWillClients)} tone={data.outdatedWillClients ? "warning" : "default"} />
            </div>
            <div style={complianceNoteStyle}>
              Executor and probate information remains permission-bound. Organisation users see only consent-safe, banded operational signals.
            </div>
          </PlatformSection>

          <PlatformSection
            title="Prototype/Beta Features"
            detail={`${data.pendingSetupTasks} pending invitations or setup tasks are represented across mock organisations.`}
            icon="task_alt"
            action={<Link href="/internal/admin/prototype/organisations" style={platformCtaStyle}>Review rollout</Link>}
          >
            <div style={platformChipRowStyle}>
              <PlatformChip>Static onboarding</PlatformChip>
              <PlatformChip>Disabled invites</PlatformChip>
              <PlatformChip>No live billing</PlatformChip>
            </div>
          </PlatformSection>
        </aside>
      </section>
    </AdminPrototypeShell>
  );
}

const commandCentreStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.45fr) minmax(320px, 0.85fr)",
  gap: 18,
  alignItems: "start",
};

const primaryColumnStyle: CSSProperties = {
  display: "grid",
  gap: 16,
};

const secondaryColumnStyle: CSSProperties = {
  display: "grid",
  gap: 14,
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

const complianceNoteStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  background: "var(--lf-surface-muted)",
  color: "var(--lf-text)",
  padding: 11,
  fontSize: 13,
  lineHeight: 1.45,
};

const opportunityStackStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const activityListStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const activityRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  alignItems: "start",
  gap: 9,
  border: "1px solid #f1ece8",
  borderRadius: 8,
  padding: "9px 10px",
  color: "var(--lf-text)",
  fontSize: 13,
  lineHeight: 1.4,
};

const userManagementActionsStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const primaryCtaStyle: CSSProperties = {
  ...platformCtaStyle,
  background: "var(--lf-text)",
  color: "#fff",
};

function activityDotStyle(tone: "default" | "success" | "warning" | "danger"): CSSProperties {
  const colors = {
    default: "var(--lf-bronze)",
    success: "#1f7a4d",
    warning: "#b45309",
    danger: "#b91c1c",
  };
  return {
  width: 7,
  height: 7,
  borderRadius: 999,
    background: colors[tone],
  marginTop: 6,
};
}
