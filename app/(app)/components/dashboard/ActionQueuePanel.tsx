"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Icon from "../../../../components/ui/Icon";
import type { BlockingItem } from "../../../../lib/workflow/blockingModel";
import { getWorkflowRequiredRoleLabel } from "../../../../lib/workflow/blockingModel";

type ActionQueuePanelProps = {
  items: BlockingItem[];
  onAction: (actionKey: string) => void;
};

type ActionCentreSection = {
  key: "owner" | "others" | "clear";
  title: string;
  count: number;
  summaries: string[];
  items: BlockingItem[];
  tone: "alert" | "muted" | "clear";
};

export default function ActionQueuePanel({ items, onAction }: ActionQueuePanelProps) {
  const sections = useMemo(() => buildActionCentreSections(items), [items]);
  const activeBlockerCount = items.filter((item) => item.isBlocking).length;
  const firstOpenKey = sections.find((section) => section.count > 0)?.key ?? "clear";
  const [openSectionKey, setOpenSectionKey] = useState<ActionCentreSection["key"]>(firstOpenKey);

  useEffect(() => {
    setOpenSectionKey(firstOpenKey);
  }, [firstOpenKey]);

  return (
    <section style={panelStyle} aria-label="Action centre">
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={iconWrapStyle}>
            <Icon name={activeBlockerCount > 0 ? "notifications_active" : "verified"} size={16} />
          </div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Action Centre</h2>
          <span style={activeBlockerCount > 0 ? activeBadgeStyle : clearBadgeStyle}>
            {activeBlockerCount > 0 ? `${activeBlockerCount} active` : "All clear"}
          </span>
        </div>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Review the next actions, what is waiting on others, and whether the record is fully up to date.
        </div>
      </div>

      {activeBlockerCount === 0 ? (
        <section style={clearStateStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="verified" size={18} />
            <strong>All up to date</strong>
          </div>
          <div style={{ color: "#166534", fontSize: 13 }}>
            No active blockers need attention right now.
          </div>
        </section>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {sections.map((section) => {
            const isOpen = section.key === openSectionKey;
            const summaryList = section.summaries.slice(0, 3);
            return (
              <section key={section.key} style={sectionCardStyle(section.tone)} aria-label={section.title}>
                <button
                  type="button"
                  style={sectionHeaderButtonStyle}
                  onClick={() => setOpenSectionKey(section.key)}
                  aria-expanded={isOpen}
                >
                  <div style={{ display: "grid", gap: 5, textAlign: "left" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={sectionPillStyle(section.tone)}>{section.title}</span>
                      <span style={{ color: "#64748b", fontSize: 12 }}>
                        {section.count} item{section.count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div style={{ display: "grid", gap: 2 }}>
                      {summaryList.length ? summaryList.map((summary) => (
                        <div key={summary} style={{ color: "#475569", fontSize: 13 }}>
                          {summary}
                        </div>
                      )) : (
                        <div style={{ color: "#64748b", fontSize: 13 }}>
                          {section.key === "clear" ? "No active blockers." : "No items in this section."}
                        </div>
                      )}
                    </div>
                  </div>
                  <span style={accordionIconStyle(isOpen)} aria-hidden>
                    <Icon name={isOpen ? "expand_less" : "expand_more"} size={18} />
                  </span>
                </button>
                {isOpen && section.items.length ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {section.items.map((item) => (
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
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

function buildActionCentreSections(items: BlockingItem[]): ActionCentreSection[] {
  const ownerItems = items.filter((item) => item.isBlocking && item.requiredRole === "owner");
  const otherItems = items.filter((item) => item.isBlocking && item.requiredRole !== "owner");
  return [
    {
      key: "owner",
      title: "Action required (Owner)",
      count: ownerItems.length,
      summaries: summarizeItems(ownerItems),
      items: ownerItems,
      tone: "alert",
    },
    {
      key: "others",
      title: "Waiting on others",
      count: otherItems.length,
      summaries: summarizeItems(otherItems),
      items: otherItems,
      tone: "muted",
    },
    {
      key: "clear",
      title: "All clear",
      count: ownerItems.length + otherItems.length === 0 ? 1 : 0,
      summaries: ownerItems.length + otherItems.length === 0 ? ["Everything currently looks up to date."] : ["No additional cleared items to review."],
      items: [],
      tone: "clear",
    },
  ];
}

function summarizeItems(items: BlockingItem[]) {
  if (!items.length) return [];

  const pendingInvitationItems = items.filter(
    (item) => item.stageName === "Contacts" && /still needs to accept the invitation\.$/i.test(item.blockerLabel),
  );
  const readyInviteItems = items.filter(
    (item) => item.stageName === "Contacts" && /is ready for an invite email\.$/i.test(item.blockerLabel),
  );
  const summaries: string[] = [];
  const consumed = new Set<string>();

  if (pendingInvitationItems.length > 1) {
    summaries.push(`${pendingInvitationItems.length} contacts still need to accept invitations.`);
    pendingInvitationItems.forEach((item) => consumed.add(item.actionKey));
  }

  if (readyInviteItems.length > 1) {
    summaries.push(`${readyInviteItems.length} contacts are ready for invite emails.`);
    readyInviteItems.forEach((item) => consumed.add(item.actionKey));
  }

  for (const item of items) {
    if (consumed.has(item.actionKey)) continue;
    summaries.push(item.blockerLabel);
  }

  return summaries;
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

const activeBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#b91c1c",
  fontSize: 12,
  fontWeight: 700,
  padding: "4px 10px",
} satisfies CSSProperties;

const clearBadgeStyle = {
  ...activeBadgeStyle,
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
} satisfies CSSProperties;

const clearStateStyle = {
  border: "1px solid #bbf7d0",
  borderRadius: 14,
  background: "#f0fdf4",
  color: "#166534",
  padding: 14,
  display: "grid",
  gap: 6,
} satisfies CSSProperties;

const sectionHeaderButtonStyle = {
  border: "none",
  background: "transparent",
  padding: 0,
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 12,
  alignItems: "center",
  cursor: "pointer",
} satisfies CSSProperties;

function sectionCardStyle(tone: ActionCentreSection["tone"]): CSSProperties {
  if (tone === "clear") {
    return {
      border: "1px solid #bbf7d0",
      borderRadius: 14,
      padding: 12,
      display: "grid",
      gap: 10,
      background: "#f0fdf4",
    };
  }
  if (tone === "alert") {
    return {
      border: "1px solid #fed7aa",
      borderRadius: 14,
      padding: 12,
      display: "grid",
      gap: 10,
      background: "#fffaf0",
    };
  }
  return {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 12,
    display: "grid",
    gap: 10,
    background: "#f8fafc",
  };
}

function sectionPillStyle(tone: ActionCentreSection["tone"]): CSSProperties {
  if (tone === "clear") {
    return {
      ...clearBadgeStyle,
      padding: "4px 10px",
    };
  }
  if (tone === "alert") {
    return {
      ...activeBadgeStyle,
      padding: "4px 10px",
    };
  }
  return {
    ...activeBadgeStyle,
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "4px 10px",
  };
}

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

function accordionIconStyle(isOpen: boolean): CSSProperties {
  return {
    width: 32,
    height: 32,
    borderRadius: 999,
    border: "1px solid #e2e8f0",
    background: "#fff",
    color: "#0f172a",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transform: isOpen ? "rotate(0deg)" : "rotate(0deg)",
  };
}

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
