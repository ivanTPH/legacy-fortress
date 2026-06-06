import Link from "next/link";
import AdminPrototypeShell from "@/components/admin/prototype/AdminPrototypeShell";
import AdminStatusBadge from "@/components/admin/prototype/AdminStatusBadge";
import { PlatformNotice, PlatformTableScroll } from "@/components/ui/PlatformPrimitives";
import {
  type BillingStatus,
  type LicencePlan,
  type LicencePlanTier,
  type LicenceStatus,
} from "@/components/admin/prototype/mockData";
import { getLicenceManagementData } from "@/components/admin/prototype/prototypeDataService";
import type { CSSProperties, ReactNode } from "react";

type LicenceManagementPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LicenceManagementPage({ searchParams }: LicenceManagementPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const orgId = typeof resolvedSearchParams.orgId === "string" ? resolvedSearchParams.orgId : null;
  const roleParam = typeof resolvedSearchParams.role === "string" ? resolvedSearchParams.role : null;
  const canViewLicenceDetails = !roleParam || roleParam === "licensing_admin" || roleParam === "super_admin";
  const data = getLicenceManagementData(orgId);

  return (
    <AdminPrototypeShell
      title="Licence management"
      description="Static licensing dashboard for organisation plans, seat usage, renewals, and disabled commercial actions."
    >
      <PlatformNotice icon="credit_card">
        Enterprise prototype — static mock data. Prototype only — billing not connected. No payment provider, invoices, exports, licence changes, or payment actions are enabled.
      </PlatformNotice>

      {orgId && !data.selectedOrganisation ? (
        <section style={warningStyle}>
          <strong>Organisation filter not found</strong>
          <span>The requested organisation ID is not in the static prototype dataset.</span>
          <Link href="/internal/admin/prototype/organisations" style={ctaStyle}>Back to organisations</Link>
        </section>
      ) : null}

      {data.selectedOrganisation ? (
        <section style={filterStyle}>
          <strong>Organisation: {data.selectedOrganisation.name}</strong>
          <Link href="/internal/admin/prototype/licences" style={subtleLinkStyle}>Clear organisation filter</Link>
        </section>
      ) : null}

      <section style={metricsGridStyle} aria-label="Licence summary cards">
        <Metric label="Licensed organisations" value={String(data.totalLicencePlans)} detail="Static organisation licences" />
        <Metric label="Active licences" value={String(data.metrics.activeLicences)} detail={`${data.metrics.suspendedOrExpiredLicences} expired or suspended`} />
        <Metric label="Seats used" value={`${data.metrics.usedSeats}/${data.metrics.includedSeats}`} detail={`${data.metrics.seatsAvailable} seats available`} />
        <Metric label="Client limit usage" value={`${data.metrics.usedSeats}/${data.metrics.clientLimit}`} detail={`${data.metrics.clientsUnderLimit} client capacity remaining`} />
        <Metric label="Renewal warnings" value={String(data.metrics.renewalsDueSoon)} detail="Renewal due or review state" />
        <Metric label="Billing connection" value="Disabled" detail="Prototype only — billing not connected" />
      </section>

      <section style={panelGridStyle}>
        <section style={panelStyle}>
          <PanelHeading title="Organisations by licence tier" />
          <div style={tierGridStyle}>
            <TierCard tier="Starter" count={data.plansByTier.Starter} />
            <TierCard tier="Professional" count={data.plansByTier.Professional} />
            <TierCard tier="Enterprise" count={data.plansByTier.Enterprise} />
          </div>
        </section>

        <section style={panelStyle}>
          <PanelHeading title="Expiring renewals" />
          <div style={miniListStyle}>
            {data.expiringRenewals.length ? data.expiringRenewals.map((plan) => (
              <PlanMiniRow
                key={plan.planId}
                plan={plan}
                organisationName={data.organisations.find((item) => item.id === plan.organisationId)?.name ?? plan.organisationId}
                detail={`${plan.renewalDate} · ${plan.billingStatus}`}
              />
            )) : <EmptyNote>No renewal warnings in the current mock data.</EmptyNote>}
          </div>
        </section>

        <section style={panelStyle}>
          <PanelHeading title="Seat usage warnings" />
          <div style={miniListStyle}>
            {data.seatWarnings.map((plan) => (
              <PlanMiniRow
                key={plan.planId}
                plan={plan}
                organisationName={data.organisations.find((item) => item.id === plan.organisationId)?.name ?? plan.organisationId}
                detail={`${plan.usedSeats}/${plan.includedSeats} seats used`}
              />
            ))}
          </div>
        </section>
      </section>

      <section style={panelStyle}>
        <PanelHeading title="Plan and seat management" actions={canViewLicenceDetails ? <DisabledActions labels={["Manage billing", "Upgrade plan", "Downgrade plan", "Renew licence", "Export invoice"]} /> : null} />
        <div style={commercialNoteStyle}>
          Prototype only — billing not connected. Commercial admins can review summary information; licence changes, billing, renewal, invoice, upgrade, and downgrade actions are static and disabled.
        </div>
        {canViewLicenceDetails ? (
          <PlatformTableScroll label="Plan and seat management table">
            <table style={tableStyle}>
              <thead>
                <tr>
                  <Th>Organisation</Th>
                  <Th>Plan</Th>
                  <Th>Tier</Th>
                  <Th>Seats used</Th>
                  <Th>Client limit</Th>
                  <Th>Renewal</Th>
                  <Th>Billing</Th>
                  <Th>Licence</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {data.scopedPlans.map((plan) => {
                  const org = data.organisations.find((item) => item.id === plan.organisationId);
                  return (
                    <tr key={plan.planId}>
                      <Td>
                        <strong>{org?.name ?? plan.organisationId}</strong>
                        <span style={mutedBlockStyle}>{plan.planId}</span>
                      </Td>
                      <Td>
                        <strong>{plan.planName}</strong>
                        <span style={mutedBlockStyle}>{plan.monthlyPrice} · {plan.annualPrice}</span>
                      </Td>
                      <Td>{plan.planTier}</Td>
                      <Td>{plan.usedSeats}/{plan.includedSeats}</Td>
                      <Td>{plan.clientLimit}</Td>
                      <Td>{plan.renewalDate}</Td>
                      <Td><AdminStatusBadge status={billingStatusToBadge(plan.billingStatus)} /></Td>
                      <Td><AdminStatusBadge status={licenceStatusToBadge(plan.licenceStatus)} /></Td>
                      <Td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button type="button" disabled title="Prototype only — billing not connected" style={disabledButtonStyle}>Manage billing</button>
                          <button type="button" disabled title="Prototype only — billing not connected" style={disabledButtonStyle}>Upgrade plan</button>
                          <button type="button" disabled title="Prototype only — billing not connected" style={disabledButtonStyle}>Downgrade plan</button>
                          <button type="button" disabled title="Prototype only — billing not connected" style={disabledButtonStyle}>Renew licence</button>
                          <button type="button" disabled title="Prototype only — billing not connected" style={disabledButtonStyle}>Export invoice</button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </PlatformTableScroll>
        ) : (
          <section style={warningStyle}>
            <strong>Licence details restricted</strong>
            <span>Enterprise admins can view licence summaries. Detailed plan controls require licensing admin or super admin permission.</span>
          </section>
        )}
      </section>

      <section style={panelStyle}>
        <PanelHeading title="Feature availability" />
        <div style={featureGridStyle}>
          {data.scopedPlans.map((plan) => (
            <section key={plan.planId} style={featureCardStyle}>
              <strong>{plan.planName}</strong>
              <span style={mutedBlockStyle}>{plan.planTier} · {plan.licenceStatus}</span>
              <div style={tagRowStyle}>
                {plan.features.map((feature) => (
                  <span key={feature} style={tagStyle}>{feature}</span>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </AdminPrototypeShell>
  );
}

function billingStatusToBadge(status: BillingStatus) {
  if (status === "Current") return "Success" as const;
  if (status === "Trial" || status === "Renewal due") return "Pending" as const;
  if (status === "Past due") return "Restricted" as const;
  return "Disabled" as const;
}

function licenceStatusToBadge(status: LicenceStatus) {
  if (status === "Active") return "Active" as const;
  if (status === "Pending" || status === "Review") return "Pending" as const;
  if (status === "Suspended" || status === "Expired") return "Suspended" as const;
  return "Disabled" as const;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <section style={metricStyle}>
      <span style={metricLabelStyle}>{label}</span>
      <strong style={{ fontSize: 25 }}>{value}</strong>
      <span style={{ color: "var(--lf-text-soft)", fontSize: 13 }}>{detail}</span>
    </section>
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

function TierCard({ tier, count }: { tier: LicencePlanTier; count: number }) {
  return (
    <section style={tierCardStyle}>
      <span style={metricLabelStyle}>{tier}</span>
      <strong>{count}</strong>
      <span style={mutedBlockStyle}>organisation licence(s)</span>
    </section>
  );
}

function PlanMiniRow({ plan, detail, organisationName }: { plan: LicencePlan; detail: string; organisationName: string }) {
  return (
    <div style={miniRowStyle}>
      <span>
        <strong>{organisationName}</strong>
        <span style={mutedBlockStyle}>{detail}</span>
      </span>
      <AdminStatusBadge status={licenceStatusToBadge(plan.licenceStatus)} />
    </div>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return <div style={emptyStyle}>{children}</div>;
}

function DisabledActions({ labels }: { labels: string[] }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {labels.map((label) => (
        <button key={label} type="button" disabled title="Prototype only — billing not connected" style={disabledButtonStyle}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th style={thStyle}>{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td style={tdStyle}>{children}</td>;
}

const filterStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  background: "#fff",
  borderRadius: 8,
  padding: 12,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const warningStyle: CSSProperties = {
  border: "1px solid #fed7aa",
  background: "#fff7ed",
  color: "#9a3412",
  borderRadius: 8,
  padding: 14,
  display: "grid",
  gap: 8,
  fontSize: 13,
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
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
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
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
};

const h2Style: CSSProperties = {
  margin: 0,
  fontSize: 17,
};

const tierGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
};

const tierCardStyle: CSSProperties = {
  border: "1px solid #f1ece8",
  borderRadius: 8,
  padding: 10,
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
  alignItems: "center",
  gap: 10,
};

const emptyStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  background: "var(--lf-surface-muted)",
  color: "var(--lf-text-soft)",
  padding: 11,
  fontSize: 13,
};

const commercialNoteStyle: CSSProperties = {
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
  fontSize: 11,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: "10px 11px",
  borderBottom: "1px solid #f1ece8",
  verticalAlign: "top",
  whiteSpace: "nowrap",
};

const mutedBlockStyle: CSSProperties = {
  display: "block",
  color: "var(--lf-text-soft)",
  fontSize: 12,
  fontWeight: 500,
  marginTop: 2,
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

const featureGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 10,
};

const featureCardStyle: CSSProperties = {
  border: "1px solid #f1ece8",
  borderRadius: 8,
  padding: 12,
  display: "grid",
  gap: 9,
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

const subtleLinkStyle: CSSProperties = {
  color: "var(--lf-text)",
  fontSize: 13,
  fontWeight: 800,
};
