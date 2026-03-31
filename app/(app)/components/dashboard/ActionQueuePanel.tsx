"use client";

import { useMemo, useState, type CSSProperties } from "react";
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
  summary: string;
  rows: ActionCentreRow[];
  tone: "alert" | "muted" | "clear";
  priority: number;
  icon: string;
};

type ActionCentreRow = {
  key: string;
  stageName: string;
  blockerLabel: string;
  actionKey: string;
  requiredRole: BlockingItem["requiredRole"];
  totalItems: number;
};

export default function ActionQueuePanel({ items, onAction }: ActionQueuePanelProps) {
  const sections = useMemo(() => buildActionCentreSections(items), [items]);
  const activeBlockerCount = items.filter((item) => item.isBlocking).length;
  const [openSectionKey, setOpenSectionKey] = useState<ActionCentreSection["key"] | null>(null);

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
          A compact view of what needs your attention, what is waiting on others, and whether everything is up to date.
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
        <div style={{ display: "grid", gap: 8 }}>
          {sections.map((section) => {
            const isOpen = section.key === openSectionKey;
            return (
              <section key={section.key} style={sectionCardStyle(section.tone)} aria-label={section.title}>
                <button
                  type="button"
                  style={sectionHeaderButtonStyle}
                  onClick={() => setOpenSectionKey((current) => (current === section.key ? null : section.key))}
                  aria-expanded={isOpen}
                >
                  <div style={{ display: "grid", gap: 4, textAlign: "left", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                      <span style={sectionIconStyle(section.tone)} aria-hidden>
                        <Icon name={section.icon} size={15} />
                      </span>
                      <span style={sectionTitleStyle}>{section.title}</span>
                      <span style={sectionPillStyle(section.tone)}>
                        {section.count}
                      </span>
                    </div>
                    <div style={sectionSummaryStyle}>
                      {section.summary}
                    </div>
                  </div>
                  <span style={accordionIconStyle(isOpen)} aria-hidden>
                    <Icon name={isOpen ? "expand_more" : "chevron_right"} size={16} />
                  </span>
                </button>
                {isOpen && section.rows.length ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    {section.rows.map((item) => (
                      <button
                        key={item.actionKey}
                        type="button"
                        style={itemRowStyle}
                        onClick={() => onAction(item.actionKey)}
                        aria-label={`${item.stageName}. ${item.blockerLabel}. Required role ${getWorkflowRequiredRoleLabel(item.requiredRole)}.`}
                        title={`Open ${item.stageName}`}
                      >
                        <div style={{ display: "grid", gap: 2, textAlign: "left", minWidth: 0 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                            <span style={stageChipStyle}>{item.stageName}</span>
                            {item.totalItems > 1 ? (
                              <span style={rowCountStyle}>{item.totalItems} grouped</span>
                            ) : null}
                          </div>
                          <div style={rowLabelStyle}>{item.blockerLabel}</div>
                        </div>
                        <span style={rowActionIconStyle} aria-hidden>
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
  if (!ownerItems.length && !otherItems.length) {
    const clearSections: ActionCentreSection[] = [
      {
        key: "clear",
        title: "All clear",
        count: 0,
        summary: "Everything currently looks up to date.",
        rows: [],
        tone: "clear",
        priority: Number.POSITIVE_INFINITY,
        icon: "verified",
      },
    ];
    return clearSections;
  }

  const sections: ActionCentreSection[] = [
    {
      key: "owner",
      title: "Things to do",
      count: ownerItems.length,
      summary: buildSectionSummary(ownerItems, "No owner actions are blocking right now."),
      rows: buildActionRows(ownerItems),
      tone: "alert",
      priority: getSectionPriority(ownerItems),
      icon: "assignment_late",
    },
    {
      key: "others",
      title: "Invite status",
      count: otherItems.length,
      summary: buildSectionSummary(otherItems, "No pending invites or external actions are waiting."),
      rows: buildActionRows(otherItems),
      tone: "muted",
      priority: getSectionPriority(otherItems),
      icon: "mail",
    },
  ];

  return sections.sort((left, right) => left.priority - right.priority);
}

function buildSectionSummary(items: BlockingItem[], fallback: string) {
  const rows = buildActionRows(items);
  if (!rows.length) return fallback;
  const primary = rows[0];
  if (rows.length === 1) return primary.blockerLabel;
  return `${primary.blockerLabel} +${rows.length - 1} more`;
}

function buildActionRows(items: BlockingItem[]): ActionCentreRow[] {
  if (!items.length) return [];
  const pendingInvitationItems = items.filter(
    (item) => item.stageName === "Contacts" && /still needs to accept the invitation\.$/i.test(item.blockerLabel),
  );
  const readyInviteItems = items.filter(
    (item) => item.stageName === "Contacts" && /is ready for an invite email\.$/i.test(item.blockerLabel),
  );
  const consumed = new Set<string>();
  const rows: ActionCentreRow[] = [];

  if (pendingInvitationItems.length > 1) {
    rows.push({
      key: "contacts-pending-group",
      stageName: "Contacts",
      blockerLabel: `${pendingInvitationItems.length} contacts still need to accept invitations.`,
      actionKey: pendingInvitationItems[0].actionKey,
      requiredRole: pendingInvitationItems[0].requiredRole,
      totalItems: pendingInvitationItems.length,
    });
    pendingInvitationItems.forEach((item) => consumed.add(item.actionKey));
  }

  if (readyInviteItems.length > 1) {
    rows.push({
      key: "contacts-ready-group",
      stageName: "Contacts",
      blockerLabel: `${readyInviteItems.length} contacts are ready for invite emails.`,
      actionKey: readyInviteItems[0].actionKey,
      requiredRole: readyInviteItems[0].requiredRole,
      totalItems: readyInviteItems.length,
    });
    readyInviteItems.forEach((item) => consumed.add(item.actionKey));
  }

  for (const item of items) {
    if (consumed.has(item.actionKey)) continue;
    rows.push({
      key: item.actionKey,
      stageName: item.stageName,
      blockerLabel: item.blockerLabel,
      actionKey: item.actionKey,
      requiredRole: item.requiredRole,
      totalItems: 1,
    });
  }

  return rows;
}

function getSectionPriority(items: BlockingItem[]) {
  if (!items.length) return Number.POSITIVE_INFINITY;
  return Math.min(...items.map((item) => item.priority));
}

const panelStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  background: "#fff",
  padding: 14,
  display: "grid",
  gap: 10,
} satisfies CSSProperties;

const iconWrapStyle = {
  width: 26,
  height: 26,
  borderRadius: 9,
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
  border: "1px solid #fed7aa",
  background: "#fff7ed",
  color: "#b91c1c",
  fontSize: 11,
  fontWeight: 700,
  padding: "3px 8px",
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
  padding: 12,
  display: "grid",
  gap: 4,
} satisfies CSSProperties;

const sectionHeaderButtonStyle = {
  border: "none",
  background: "transparent",
  padding: 0,
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 10,
  alignItems: "center",
  cursor: "pointer",
} satisfies CSSProperties;

function sectionCardStyle(tone: ActionCentreSection["tone"]): CSSProperties {
  if (tone === "clear") {
    return {
      border: "1px solid #bbf7d0",
      borderRadius: 12,
      padding: 10,
      display: "grid",
      gap: 8,
      background: "#f0fdf4",
    };
  }
  if (tone === "alert") {
    return {
      border: "1px solid #fde7c7",
      borderRadius: 12,
      padding: 10,
      display: "grid",
      gap: 8,
      background: "#fffdf8",
    };
  }
  return {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 10,
    display: "grid",
    gap: 8,
    background: "#fbfdff",
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
      padding: "2px 7px",
    };
  }
  return {
    ...activeBadgeStyle,
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "2px 7px",
  };
}

const itemRowStyle = {
  border: "1px solid #eef2f7",
  borderRadius: 10,
  background: "#fff",
  padding: "8px 10px",
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 10,
  alignItems: "center",
  cursor: "pointer",
} satisfies CSSProperties;

function accordionIconStyle(isOpen: boolean): CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: 999,
    border: "1px solid #e2e8f0",
    background: "#fff",
    color: "#0f172a",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

const sectionTitleStyle = {
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 700,
} satisfies CSSProperties;

const sectionSummaryStyle = {
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.4,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} satisfies CSSProperties;

function sectionIconStyle(tone: ActionCentreSection["tone"]): CSSProperties {
  if (tone === "alert") {
    return {
      width: 22,
      height: 22,
      borderRadius: 999,
      background: "#fff7ed",
      color: "#c2410c",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    };
  }
  if (tone === "muted") {
    return {
      width: 22,
      height: 22,
      borderRadius: 999,
      background: "#eff6ff",
      color: "#1d4ed8",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    };
  }
  return {
    width: 22,
    height: 22,
    borderRadius: 999,
    background: "#f0fdf4",
    color: "#166534",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };
}

const stageChipStyle = {
  color: "#475569",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  padding: "2px 7px",
} satisfies CSSProperties;

const rowCountStyle = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 600,
} satisfies CSSProperties;

const rowLabelStyle = {
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1.35,
} satisfies CSSProperties;

const rowActionIconStyle = {
  width: 28,
  height: 28,
  borderRadius: 999,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#0f172a",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
} satisfies CSSProperties;
