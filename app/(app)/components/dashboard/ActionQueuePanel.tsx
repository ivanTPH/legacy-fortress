"use client";

import type { CSSProperties } from "react";
import Icon from "../../../../components/ui/Icon";
import type { ActionQueueGroup } from "../../../../lib/workflow/blockingModel";
import { getWorkflowRequiredRoleLabel } from "../../../../lib/workflow/blockingModel";

type ActionQueuePanelProps = {
  groups: ActionQueueGroup[];
  onAction: (actionKey: string) => void;
};

export default function ActionQueuePanel({ groups, onAction }: ActionQueuePanelProps) {
  if (!groups.length) return null;

  return (
    <section style={panelStyle} aria-label="Action queue">
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={iconWrapStyle}>
            <Icon name="assignment_late" size={16} />
          </div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Action Queue</h2>
        </div>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Blocking actions grouped by the next required role so the most urgent stage is easy to see first.
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {groups.map((group) => (
          <section key={group.requiredRole} style={groupStyle} aria-label={`${group.label} actions`}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={groupPillStyle}>{group.label}</span>
              <span style={{ color: "#64748b", fontSize: 12 }}>
                {group.items.length} blocker{group.items.length === 1 ? "" : "s"}
              </span>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {group.items.map((item) => (
                <button
                  key={item.actionKey}
                  type="button"
                  style={itemButtonStyle}
                  onClick={() => onAction(item.actionKey)}
                  aria-label={`${item.stageName}. ${item.blockerLabel}. Required role ${getWorkflowRequiredRoleLabel(item.requiredRole)}.`}
                  title={`Open ${item.stageName}`}
                >
                  <div style={{ display: "grid", gap: 3, textAlign: "left" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <span style={metaLabelStyle}>Stage</span>
                      <span style={metaValueStyle}>{item.stageName}</span>
                    </div>
                    <div style={{ color: "#0f172a", fontSize: 14, fontWeight: 700 }}>{item.blockerLabel}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <span style={metaLabelStyle}>Required role</span>
                      <span style={{ color: "#475569", fontSize: 12, fontWeight: 700 }}>{getWorkflowRequiredRoleLabel(item.requiredRole)}</span>
                    </div>
                  </div>
                  <span style={actionIconStyle} aria-hidden>
                    <Icon name="open_in_new" size={16} />
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

const panelStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  background: "#fff",
  padding: 16,
  display: "grid",
  gap: 12,
} satisfies CSSProperties;

const groupStyle = {
  border: "1px solid #eef2f7",
  borderRadius: 14,
  padding: 12,
  display: "grid",
  gap: 10,
} satisfies CSSProperties;

const iconWrapStyle = {
  width: 28,
  height: 28,
  borderRadius: 10,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#0f172a",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
} satisfies CSSProperties;

const groupPillStyle = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: 12,
  fontWeight: 700,
  padding: "4px 10px",
} satisfies CSSProperties;

const itemButtonStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  background: "#fff",
  padding: 12,
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 12,
  alignItems: "center",
  cursor: "pointer",
} satisfies CSSProperties;

const metaLabelStyle = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
} satisfies CSSProperties;

const metaValueStyle = {
  color: "#0f172a",
  fontSize: 12,
  fontWeight: 700,
} satisfies CSSProperties;

const actionIconStyle = {
  width: 32,
  height: 32,
  borderRadius: 999,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#0f172a",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
} satisfies CSSProperties;
