import type { CSSProperties, ReactNode } from "react";
import Icon from "./Icon";

export type PlatformTone = "default" | "success" | "warning" | "danger";

export function PlatformNotice({
  children,
  icon = "info",
  tone = "default",
}: {
  children: ReactNode;
  icon?: string;
  tone?: PlatformTone;
}) {
  return (
    <section className="lf-platform-notice" style={noticeStyle(tone)}>
      <Icon name={icon} size={16} />
      <span>{children}</span>
    </section>
  );
}

export function PlatformRestrictedState({
  title = "Access restricted",
  detail,
  meta,
}: {
  title?: string;
  detail: string;
  meta?: string;
}) {
  return (
    <section className="lf-platform-restricted-state" style={restrictedStateStyle} role="status" aria-live="polite">
      <span style={iconBoxStyle("warning")} aria-hidden="true">
        <Icon name="lock" size={17} />
      </span>
      <div style={{ display: "grid", gap: 5 }}>
        <strong>{title}</strong>
        <span style={detailStyle}>{detail}</span>
        {meta ? <span style={restrictedMetaStyle}>{meta}</span> : null}
      </div>
    </section>
  );
}

export function PlatformStatCard({
  icon,
  label,
  value,
  detail,
  tone = "default",
}: {
  icon: string;
  label: string;
  value: string;
  detail: string;
  tone?: PlatformTone;
}) {
  return (
    <section className="lf-platform-stat-card" style={statCardStyle}>
      <div style={statHeaderStyle}>
        <span style={iconBoxStyle(tone)} aria-hidden="true">
          <Icon name={icon} size={17} />
        </span>
        <span style={labelStyle}>{label}</span>
      </div>
      <strong style={statValueStyle}>{value}</strong>
      <span style={detailStyle}>{detail}</span>
    </section>
  );
}

export function PlatformSection({
  title,
  detail,
  icon,
  children,
  action,
  emphasis = "secondary",
}: {
  title: string;
  detail: string;
  icon: string;
  children: ReactNode;
  action?: ReactNode;
  emphasis?: "primary" | "secondary";
}) {
  return (
    <section className="lf-platform-section" style={sectionStyle(emphasis)}>
      <div className="lf-platform-section-header" style={sectionHeaderStyle}>
        <span style={sectionIconStyle(emphasis)} aria-hidden="true">
          <Icon name={icon} size={18} />
        </span>
        <h2 style={sectionTitleStyle(emphasis)}>{title}</h2>
        <p style={sectionDetailStyle}>{detail}</p>
      </div>
      {children}
      {action ? <div className="lf-platform-section-action" style={sectionActionStyle}>{action}</div> : null}
    </section>
  );
}

export function PlatformInfoTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: PlatformTone;
}) {
  return (
    <div className="lf-platform-info-tile" style={infoTileStyle(tone)}>
      <span style={labelStyle}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function PlatformChip({ children, tone = "default" }: { children: ReactNode; tone?: PlatformTone }) {
  return <span className="lf-platform-chip" style={chipStyle(tone)}>{children}</span>;
}

export function PlatformActionRow({
  title,
  detail,
  status,
  action,
}: {
  title: string;
  detail: string;
  status?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="lf-platform-action-row" style={actionRowStyle}>
      <span>
        <strong>{title}</strong>
        <span style={detailBlockStyle}>{detail}</span>
      </span>
      <span className="lf-platform-action-meta" style={actionMetaStyle}>
        {status}
        {action}
      </span>
    </div>
  );
}

export function PlatformEmptyState({
  title,
  detail,
  icon = "inbox",
  action,
}: {
  title: string;
  detail: string;
  icon?: string;
  action?: ReactNode;
}) {
  return (
    <section className="lf-platform-empty-state" style={emptyStateStyle}>
      <span style={iconBoxStyle("default")} aria-hidden="true">
        <Icon name={icon} size={17} />
      </span>
      <div style={{ display: "grid", gap: 5 }}>
        <strong>{title}</strong>
        <span style={detailStyle}>{detail}</span>
        {action ? <span style={{ marginTop: 3 }}>{action}</span> : null}
      </div>
    </section>
  );
}

export function PlatformTableScroll({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="lf-platform-table-scroll" style={tableScrollStyle} role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

export const platformKpiGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
};

export const platformInfoGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 8,
};

export const platformChipRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

export const platformCtaStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  background: "var(--lf-surface-muted)",
  color: "var(--lf-text)",
  textDecoration: "none",
  padding: "9px 11px",
  fontSize: 13,
  fontWeight: 800,
  width: "fit-content",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

export const platformPanelStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: 16,
  display: "grid",
  gap: 12,
};

export const platformSplitGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 14,
};

export const platformResponsiveGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
  gap: 14,
};

export const platformToolbarStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: 12,
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};

export const platformInputStyle: CSSProperties = {
  minWidth: 240,
  flex: 1,
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: "9px 11px",
  background: "#fff",
};

const labelStyle: CSSProperties = {
  color: "var(--lf-text-soft)",
  fontSize: 12,
  fontWeight: 750,
};

const statCardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: 12,
  display: "grid",
  gap: 8,
  minHeight: 112,
  boxShadow: "0 1px 2px rgba(33,17,13,0.018)",
};

const statHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
};

const statValueStyle: CSSProperties = {
  fontSize: 24,
  lineHeight: 1,
};

const detailStyle: CSSProperties = {
  color: "var(--lf-text-soft)",
  fontSize: 12,
  lineHeight: 1.35,
};

const detailBlockStyle: CSSProperties = {
  display: "block",
  color: "var(--lf-text-soft)",
  fontSize: 12,
  lineHeight: 1.4,
  marginTop: 3,
};

const restrictedStateStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: 16,
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  gap: 12,
  alignItems: "start",
};

const restrictedMetaStyle: CSSProperties = {
  color: "var(--lf-bronze)",
  fontSize: 12,
  fontWeight: 800,
};

const actionRowStyle: CSSProperties = {
  border: "1px solid #f1ece8",
  borderRadius: 8,
  padding: "10px 11px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  minWidth: 0,
};

const actionMetaStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 8,
  flexWrap: "wrap",
  minWidth: 0,
};

const tableScrollStyle: CSSProperties = {
  overflowX: "auto",
  overflowY: "hidden",
  WebkitOverflowScrolling: "touch",
  borderRadius: 8,
  maxWidth: "100%",
};

const emptyStateStyle: CSSProperties = {
  border: "1px dashed var(--lf-border)",
  borderRadius: 8,
  background: "var(--lf-surface-muted)",
  padding: 14,
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  gap: 11,
  alignItems: "start",
};

function sectionStyle(emphasis: "primary" | "secondary"): CSSProperties {
  return {
    background: "#fff",
    border: emphasis === "primary" ? "1px solid #ded5ce" : "1px solid var(--lf-border)",
    borderRadius: 8,
    padding: emphasis === "primary" ? 18 : 15,
    display: "grid",
    alignContent: "start",
    gap: emphasis === "primary" ? 14 : 11,
    boxShadow: emphasis === "primary" ? "0 10px 24px rgba(47, 35, 28, 0.05)" : "none",
  };
}

const sectionHeaderStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  gap: "2px 10px",
  alignItems: "center",
};

function sectionTitleStyle(emphasis: "primary" | "secondary"): CSSProperties {
  return {
    margin: 0,
    fontSize: emphasis === "primary" ? 19 : 16,
    lineHeight: 1.2,
  };
}

const sectionDetailStyle: CSSProperties = {
  margin: 0,
  color: "var(--lf-text-soft)",
  fontSize: 13,
  lineHeight: 1.45,
  gridColumn: "2 / -1",
};

const sectionActionStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
};

function iconBoxStyle(tone: PlatformTone): CSSProperties {
  const palette = getTonePalette(tone);
  return {
    width: 30,
    height: 30,
    borderRadius: 8,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    background: palette.softBackground,
    color: palette.color,
  };
}

function sectionIconStyle(emphasis: "primary" | "secondary"): CSSProperties {
  return {
    width: emphasis === "primary" ? 36 : 32,
    height: emphasis === "primary" ? 36 : 32,
    borderRadius: 8,
    background: emphasis === "primary" ? "#f5f1ec" : "var(--lf-surface-muted)",
    color: "var(--lf-bronze)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gridRow: "1 / span 2",
  };
}

function infoTileStyle(tone: PlatformTone): CSSProperties {
  const palette = getTonePalette(tone);
  return {
    border: `1px solid ${palette.border}`,
    borderRadius: 8,
    padding: 10,
    display: "grid",
    gap: 4,
    background: palette.background,
  };
}

function chipStyle(tone: PlatformTone): CSSProperties {
  const palette = getTonePalette(tone);
  return {
    border: `1px solid ${palette.border}`,
    borderRadius: 999,
    background: palette.background,
    color: palette.text,
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 800,
  };
}

function noticeStyle(tone: PlatformTone): CSSProperties {
  const palette = getTonePalette(tone);
  return {
    border: `1px solid ${palette.border}`,
    background: palette.background,
    color: palette.text,
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 13,
    lineHeight: 1.45,
    display: "flex",
    alignItems: "center",
    gap: 8,
  };
}

function getTonePalette(tone: PlatformTone) {
  if (tone === "success") {
    return {
      border: "#d8eadc",
      background: "#f7fbf7",
      softBackground: "#f0f8f1",
      color: "#166534",
      text: "#365f3a",
    };
  }
  if (tone === "warning") {
    return {
      border: "#ead8c7",
      background: "#fffaf5",
      softBackground: "#fff6ed",
      color: "#9a3412",
      text: "#7c3f16",
    };
  }
  if (tone === "danger") {
    return {
      border: "#f0c7c7",
      background: "#fff7f7",
      softBackground: "#fef2f2",
      color: "#991b1b",
      text: "#7f1d1d",
    };
  }
  return {
    border: "var(--lf-border)",
    background: "#fffefd",
    softBackground: "#f5f1ec",
    color: "var(--lf-bronze)",
    text: "var(--lf-text-soft)",
  };
}
