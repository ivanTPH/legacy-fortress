import AdminPrototypeShell from "@/components/admin/prototype/AdminPrototypeShell";
import { getCampaignPrototypeData } from "@/components/admin/prototype/prototypeDataService";
import type { CSSProperties, ReactNode } from "react";

export default function CampaignsPrototypePage() {
  const data = getCampaignPrototypeData();

  return (
    <AdminPrototypeShell
      title="Campaigns"
      description="Static, disabled outreach shell for future platform-mediated enterprise review workflows."
    >
      <section style={noticeStyle}>
        Enterprise prototype — static mock data. Future outreach will be platform-mediated and audit logged. Organisation users will not receive unrestricted client exports.
      </section>

      <section style={metricsGridStyle} aria-label="Campaign consent metrics">
        <Metric label="Eligible audience" value={String(data.eligibleClients.length)} detail="Adviser insight and marketing consent both present" />
        <Metric label="Excluded by consent" value={String(data.excludedByConsent)} detail="Missing adviser insight or marketing consent" />
        <Metric label="Review due audience" value={String(data.audience.reviewDue)} detail="Eligible clients only" />
        <Metric label="Will update audience" value={String(data.audience.willUpdate)} detail="Eligible clients only" />
        <Metric label="Executor missing audience" value={String(data.audience.executorMissing)} detail="Eligible clients only" />
        <Metric label="Incomplete vault audience" value={String(data.audience.incompleteVault)} detail="Eligible clients only" />
      </section>

      <section style={panelGridStyle}>
        <Panel title="Campaign opportunities">
          <AudienceRow label="Annual estate review" count={data.audience.reviewDue} detail="Filtered to eligible, consented clients only." />
          <AudienceRow label="Will update reminder" count={data.audience.willUpdate} detail="Uses will age bands and review signals only." />
          <AudienceRow label="Executor missing reminder" count={data.audience.executorMissing} detail="No executor details are exposed in this shell." />
          <AudienceRow label="Incomplete vault nudge" count={data.audience.incompleteVault} detail="Uses completion band signals only." />
        </Panel>

        <Panel title="Consent readiness">
          <Info label="Campaign-ready clients" value={String(data.eligibleClients.length)} />
          <Info label="Missing consent" value={String(data.excludedByConsent)} />
          <Info label="Marketing permission" value={String(data.eligibleMetrics.marketingPermission)} />
          <p style={helperTextStyle}>
            Campaign audience counts require consent.adviserInsights === true and consent.marketing === true. If either is missing, the client is excluded.
          </p>
        </Panel>
      </section>

      <section style={builderStyle}>
        <div style={{ display: "grid", gap: 5 }}>
          <h2 style={h2Style}>Disabled campaign builder</h2>
          <p style={helperTextStyle}>
            This panel previews where future campaign setup may live. It cannot create, export, schedule, or send anything.
          </p>
        </div>

        <section style={builderGridStyle}>
          <Panel title="Audience filter preview">
            <Info label="Audience" value="Review due, will update, executor missing, incomplete vault" />
            <Info label="Consent rule" value="Adviser insights + marketing consent required" />
            <Info label="Values" value="Safe counts and bands only" />
          </Panel>

          <Panel title="Message template preview">
            <div style={templateStyle}>
              Hello, this is a reminder to review your Legacy Fortress vault details with your professional adviser.
            </div>
            <p style={helperTextStyle}>Template copy is placeholder only and not connected to messaging.</p>
          </Panel>

          <Panel title="Consent requirement checklist">
            <ChecklistItem complete label="Adviser insight consent checked" />
            <ChecklistItem complete label="Marketing permission checked" />
            <ChecklistItem complete={false} label="Communication preference enforcement pending" />
            <ChecklistItem complete={false} label="Outreach approval workflow pending" />
          </Panel>

          <Panel title="Approval status checklist">
            <ChecklistItem complete={false} label="Firm approval pending" />
            <ChecklistItem complete={false} label="Compliance review pending" />
            <ChecklistItem complete={false} label="Audit event model pending" />
            <ChecklistItem complete={false} label="Messaging provider not connected" />
          </Panel>
        </section>

        <div style={buttonRowStyle}>
          <DisabledAction label="Create campaign" reason={data.disabledReason} />
          <DisabledAction label="Export audience" reason={data.disabledReason} />
          <DisabledAction label="Send message" reason={data.disabledReason} />
          <DisabledAction label="Schedule campaign" reason={data.disabledReason} />
        </div>
      </section>

      <section style={panelStyle}>
        <h2 style={h2Style}>Audit preview</h2>
        <div style={auditGridStyle}>
          {data.auditPreviewEvents.map((event) => (
            <AuditItem key={event.id} action={event.action} actor={event.actor.displayName} result={event.result.replace(/_/g, " ")} />
          ))}
        </div>
      </section>
    </AdminPrototypeShell>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <section style={metricStyle}>
      <span style={metricLabelStyle}>{label}</span>
      <strong style={{ fontSize: 28 }}>{value}</strong>
      <span style={mutedTextStyle}>{detail}</span>
    </section>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={panelStyle}>
      <h2 style={h2Style}>{title}</h2>
      {children}
    </section>
  );
}

function AudienceRow({ label, count, detail }: { label: string; count: number; detail: string }) {
  return (
    <div style={audienceRowStyle}>
      <span>
        <strong>{label}</strong>
        <span style={mutedBlockStyle}>{detail}</span>
      </span>
      <strong>{count}</strong>
    </div>
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

function ChecklistItem({ complete, label }: { complete: boolean; label: string }) {
  return (
    <div style={checklistItemStyle}>
      <span style={complete ? checkStyle : pendingStyle}>{complete ? "Complete" : "Pending"}</span>
      <span>{label}</span>
    </div>
  );
}

function DisabledAction({ label, reason }: { label: string; reason: string }) {
  return (
    <button type="button" disabled style={disabledButtonStyle} title={reason}>
      {label} — {reason}
    </button>
  );
}

function AuditItem({ action, actor, result }: { action: string; actor: string; result: string }) {
  return (
    <div style={auditItemStyle}>
      <strong>{action}</strong>
      <span style={mutedTextStyle}>{actor}</span>
      <span style={mutedTextStyle}>{result}</span>
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

const panelGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
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

const builderStyle: CSSProperties = {
  ...panelStyle,
  background: "#fffefd",
};

const builderGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const h2Style: CSSProperties = {
  margin: 0,
  fontSize: 17,
};

const helperTextStyle: CSSProperties = {
  margin: 0,
  color: "var(--lf-text-soft)",
  fontSize: 13,
  lineHeight: 1.45,
};

const mutedTextStyle: CSSProperties = {
  color: "var(--lf-text-soft)",
  fontSize: 13,
};

const mutedBlockStyle: CSSProperties = {
  display: "block",
  color: "var(--lf-text-soft)",
  fontSize: 13,
  marginTop: 3,
};

const audienceRowStyle: CSSProperties = {
  borderBottom: "1px solid #f1ece8",
  paddingBottom: 9,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const infoStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  borderBottom: "1px solid #f1ece8",
  paddingBottom: 9,
};

const templateStyle: CSSProperties = {
  border: "1px solid #f1ece8",
  borderRadius: 8,
  background: "var(--lf-surface-muted)",
  color: "var(--lf-text)",
  padding: 12,
  fontSize: 13,
  lineHeight: 1.45,
};

const checklistItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
};

const checkStyle: CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
  borderRadius: 999,
  padding: "3px 7px",
  fontSize: 11,
  fontWeight: 800,
};

const pendingStyle: CSSProperties = {
  ...checkStyle,
  border: "1px solid var(--lf-border)",
  background: "var(--lf-surface-muted)",
  color: "var(--lf-text-soft)",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const disabledButtonStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  background: "var(--lf-surface-muted)",
  color: "var(--lf-text-soft)",
  padding: "9px 12px",
  fontWeight: 800,
};

const auditGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const auditItemStyle: CSSProperties = {
  border: "1px solid #f1ece8",
  borderRadius: 8,
  padding: 12,
  display: "grid",
  gap: 4,
};
