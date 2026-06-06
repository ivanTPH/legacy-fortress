"use client";

import { memo, useCallback, useMemo, useState, type CSSProperties } from "react";
import Icon from "../../../../components/ui/Icon";
import InfoTip from "../../../../components/ui/InfoTip";
import type { BlockingItem } from "../../../../lib/workflow/blockingModel";
import { getWorkflowRequiredRoleLabel } from "../../../../lib/workflow/blockingModel";

type ActionQueuePanelProps = {
  items: BlockingItem[];
  onAction: (actionKey: string) => void;
  context?: ActionCentreContext;
};

export type ActionCentreContext = {
  hasExecutor: boolean;
  contactCount: number;
  documentCount: number;
  profileIncomplete: boolean;
  tasks?: ActionCentreTask[];
  estateReadiness?: {
    executorAssigned: boolean;
    willUploaded: boolean;
    keyDocumentsPresent: boolean;
  };
};

type ActionCentreSection = {
  key: "critical" | "recommended" | "tasks" | "completed" | "clear";
  title: string;
  count: number;
  summary: string;
  rows: ActionCentreRow[];
  tone: "alert" | "muted" | "clear";
  priority: number;
  priorityLevel: ActionPriorityLevel;
  icon: string;
};

type ActionCentreRow = {
  key: string;
  title: string;
  stageName: string;
  blockerLabel: string;
  whyItMatters: string;
  status: ActionCentreStatus;
  actionKey: string;
  href: string;
  requiredRole: BlockingItem["requiredRole"];
  primaryActionLabel: string;
  secondaryActionLabel?: string;
  totalItems: number;
  priority: number;
  priorityLevel: ActionPriorityLevel;
  taskType?: ActionCentreTask["type"];
  relatedEntity?: string;
};

type ActionCentreStatus = "Required" | "Recommended" | "Pending" | "Complete" | "Failed" | "Plan limit reached";
type ActionPriorityLevel = "Critical" | "High" | "Medium" | "Low";
type ActionCentreTaskType = "user_created" | "system_generated" | "reminder";

export type ActionCentreTask = {
  id: string;
  title: string;
  status: string;
  type: ActionCentreTaskType;
  href: string;
  relatedEntity?: string;
  createdAt?: string | null;
  dueDate?: string | null;
  description?: string;
};

type DashboardActionSeed = Pick<
  ActionCentreRow,
  "key" | "title" | "stageName" | "blockerLabel" | "whyItMatters" | "status" | "actionKey" | "href" | "requiredRole" | "primaryActionLabel" | "secondaryActionLabel"
>;

function ActionQueuePanel({ items, onAction, context }: ActionQueuePanelProps) {
  const sections = useMemo(() => buildActionCentreSections(items, context), [items, context]);
  const activeBlockerCount = sections
    .filter((section) => section.key !== "completed" && section.key !== "clear")
    .reduce((sum, section) => sum + section.count, 0);
  const visibleRowCount = sections.reduce((sum, section) => sum + section.count, 0);
  const initialOpenSectionKey = sections.find((section) => section.rows.some((row) => row.priorityLevel === "Critical"))?.key ?? null;
  const [openSectionKey, setOpenSectionKey] = useState<ActionCentreSection["key"] | null | undefined>(undefined);
  const effectiveOpenSectionKey = openSectionKey === undefined ? initialOpenSectionKey : openSectionKey;

  const toggleSection = useCallback((sectionKey: ActionCentreSection["key"]) => {
    setOpenSectionKey((current) => {
      const currentSectionKey = current === undefined ? initialOpenSectionKey : current;
      return currentSectionKey === sectionKey ? null : sectionKey;
    });
  }, [initialOpenSectionKey]);

  return (
    <section className="lf-action-centre" style={panelStyle} aria-label="Action centre">
      <div style={{ display: "grid", gap: 4 }}>
        <div className="lf-action-centre-header" style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
          <div style={iconWrapStyle}>
            <Icon name={activeBlockerCount > 0 ? "notifications_active" : "verified"} size={21} />
          </div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Action Centre</h2>
          <span style={activeBlockerCount > 0 ? activeBadgeStyle : clearBadgeStyle}>
            {activeBlockerCount > 0 ? `${activeBlockerCount} active` : "All clear"}
          </span>
          <InfoTip
            className="lf-panel-help"
            label="Explain Action Centre"
            title="Action Centre"
            tone="warning"
            message="Actions are grouped prompts from your vault data. Completing them can make records easier for trusted people to understand."
          />
        </div>
        <div className="lf-action-centre-intro" style={{ color: "#64748b", fontSize: 13 }}>
          See the next actions that make your vault easier for trusted people to understand and use. Things to do,
          reminders, and user-created tasks live here instead of the dashboard overview.
        </div>
      </div>

      {visibleRowCount === 0 ? (
        <section style={clearStateStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="verified" size={22} />
            <strong>All up to date</strong>
          </div>
          <div style={{ color: "#166534", fontSize: 13 }}>
            No urgent dashboard actions need attention right now. You can still review or add records at any time.
          </div>
        </section>
      ) : (
        <div className="lf-action-centre-sections" style={{ display: "grid", gap: 8 }}>
          {sections.map((section) => {
            const isOpen = section.key === effectiveOpenSectionKey;
            return (
              <section key={section.key} className="lf-action-centre-section" style={sectionCardStyle(section.tone)} aria-label={section.title}>
                <button
                  className="lf-action-centre-section-button"
                  type="button"
                  style={sectionHeaderButtonStyle}
                  onClick={() => toggleSection(section.key)}
                  aria-expanded={isOpen}
                  title={`${isOpen ? "Collapse" : "Expand"} ${section.title}`}
                >
                  <div style={{ display: "grid", gap: 4, textAlign: "left", minWidth: 0 }}>
                    <div className="lf-action-centre-section-title-row" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                      <span style={sectionIconStyle(section.tone)} aria-hidden>
                        <Icon name={section.icon} size={20} />
                      </span>
                      <span style={sectionTitleStyle}>{section.title}</span>
                      <span style={sectionPillStyle(section.tone)}>
                        {section.count}
                      </span>
                      {section.rows.length ? (
                        <span className="lf-action-centre-priority-pill" style={priorityPillStyle(section.priorityLevel)}>
                          {section.priorityLevel} priority
                        </span>
                      ) : null}
                    </div>
                    <div className="lf-action-centre-section-summary" style={sectionSummaryStyle}>
                      {section.summary}
                    </div>
                  </div>
                  <span style={accordionIconStyle(isOpen)} aria-hidden>
                    <Icon name={isOpen ? "expand_more" : "chevron_right"} size={16} />
                  </span>
                </button>
                {isOpen && section.rows.length ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {section.rows.map((item) => (
                      <article
                        key={item.actionKey}
                        className="lf-action-centre-row"
                        style={itemRowStyle}
                        aria-label={`${item.title}. ${item.whyItMatters}. Status ${item.status}. Required role ${getWorkflowRequiredRoleLabel(item.requiredRole)}.`}
                      >
                        <div style={{ display: "grid", gap: 8, textAlign: "left", minWidth: 0 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                            <strong style={rowTitleStyle}>{item.title}</strong>
                            <div className="lf-action-centre-row-badges" style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                              <span className="lf-action-centre-priority-pill" style={priorityPillStyle(item.priorityLevel)}>{item.priorityLevel}</span>
                              <span style={statusPillStyle(item.status)}>{item.status}</span>
                            </div>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                            <span style={stageChipStyle}>{item.stageName}</span>
                            {item.totalItems > 1 ? (
                              <span style={rowCountStyle}>{item.totalItems} grouped</span>
                            ) : null}
                          </div>
                          <div style={rowLabelStyle}>{item.blockerLabel}</div>
                          <div style={rowReasonStyle}>{item.whyItMatters}</div>
                          <div className="lf-action-centre-row-actions" style={rowActionsStyle}>
                            <button
                              type="button"
                              style={primaryActionStyle}
                              onClick={() => onAction(item.actionKey)}
                              title={`${item.primaryActionLabel}: ${item.title}`}
                            >
                              {item.primaryActionLabel}
                            </button>
                            {item.secondaryActionLabel ? (
                              <a href={item.href} style={secondaryActionStyle} title={`${item.secondaryActionLabel}: ${item.title}`}>
                                {item.secondaryActionLabel}
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </article>
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

export default memo(ActionQueuePanel);

function buildActionCentreSections(items: BlockingItem[], context?: ActionCentreContext): ActionCentreSection[] {
  const ownerItems = items.filter((item) => item.isBlocking && item.requiredRole === "owner");
  const otherItems = items.filter((item) => item.isBlocking && item.requiredRole !== "owner");
  const actionRows = dedupeRows([...buildActionRows(ownerItems, context), ...buildActionRows(otherItems)]);
  const actionDedupeKeys = new Set(actionRows.map(getRowDedupeKey));
  const criticalRows = actionRows.filter((row) => row.priorityLevel === "Critical");
  const recommendedRows = actionRows.filter((row) => row.priorityLevel !== "Critical");
  const taskRows = buildTaskActionRows(context?.tasks ?? [], actionDedupeKeys, false);
  const completedRows = buildTaskActionRows(context?.tasks ?? [], actionDedupeKeys, true);
  if (!criticalRows.length && !recommendedRows.length && !taskRows.length && !completedRows.length) {
    const clearSections: ActionCentreSection[] = [
      {
        key: "clear",
        title: "All clear",
        count: 0,
        summary: "No urgent dashboard actions need attention right now.",
        rows: [],
        tone: "clear",
        priority: Number.POSITIVE_INFINITY,
        priorityLevel: "Low",
        icon: "verified",
      },
    ];
    return clearSections;
  }

  const sections: ActionCentreSection[] = [
    {
      key: "critical",
      title: "Critical actions",
      count: criticalRows.length,
      summary: buildSectionSummary(criticalRows, "No critical actions are blocking right now."),
      rows: criticalRows,
      tone: "alert",
      priority: getSectionPriority(criticalRows),
      priorityLevel: getSectionPriorityLevel(criticalRows),
      icon: "assignment_late",
    },
    {
      key: "recommended",
      title: "Recommended actions",
      count: recommendedRows.length,
      summary: buildSectionSummary(recommendedRows, "No recommended actions need attention right now."),
      rows: recommendedRows,
      tone: "muted",
      priority: getSectionPriority(recommendedRows),
      priorityLevel: getSectionPriorityLevel(recommendedRows),
      icon: "playlist_add_check",
    },
    {
      key: "tasks",
      title: "Your tasks",
      count: taskRows.length,
      summary: buildSectionSummary(taskRows, "No open tasks need attention right now."),
      rows: taskRows,
      tone: "muted",
      priority: getSectionPriority(taskRows),
      priorityLevel: getSectionPriorityLevel(taskRows),
      icon: "task_alt",
    },
    {
      key: "completed",
      title: "Completed",
      count: completedRows.length,
      summary: buildSectionSummary(completedRows, "No completed tasks to show yet."),
      rows: completedRows,
      tone: "clear",
      priority: 90,
      priorityLevel: "Low",
      icon: "verified",
    },
  ];

  return sections;
}

function buildSectionSummary(rows: ActionCentreRow[], fallback: string) {
  if (!rows.length) return fallback;
  const primary = rows[0];
  if (rows.length === 1) return primary.blockerLabel;
  return `${primary.blockerLabel} +${rows.length - 1} more`;
}

function buildTaskActionRows(tasks: ActionCentreTask[], actionDedupeKeys: Set<string>, completedOnly: boolean): ActionCentreRow[] {
  return tasks
    .filter((task) => isCompletedTaskStatus(task.status) === completedOnly)
    .filter((task) => !taskDuplicatesAction(task, actionDedupeKeys))
    .map((task) => {
      const priorityLevel = getTaskPriorityLevel(task);
      return {
        key: `task-${task.id}`,
        title: task.title || "Untitled task",
        stageName: "Tasks",
        blockerLabel: formatTaskType(task.type),
        whyItMatters: formatTaskReason(task),
        status: completedOnly ? "Complete" : task.status === "waiting" ? "Pending" : "Recommended",
        actionKey: completedOnly ? `task:open:${task.id}` : `task:complete:${task.id}`,
        href: task.href,
        requiredRole: "owner",
        primaryActionLabel: completedOnly ? "Open task" : "Mark complete",
        secondaryActionLabel: "Open Tasks",
        totalItems: 1,
        priority: priorityRank(priorityLevel),
        priorityLevel,
        taskType: task.type,
        relatedEntity: task.relatedEntity,
      };
    });
}

function buildActionRows(items: BlockingItem[], context?: ActionCentreContext): ActionCentreRow[] {
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
      title: "Check invitation status",
      stageName: "Contacts",
      blockerLabel: `${pendingInvitationItems.length} contacts still need to accept invitations.`,
      whyItMatters: "Pending invitations can delay trusted access when it is needed.",
      status: "Pending",
      actionKey: pendingInvitationItems[0].actionKey,
      href: pendingInvitationItems[0].href,
      requiredRole: pendingInvitationItems[0].requiredRole,
      primaryActionLabel: "Review invites",
      secondaryActionLabel: "Open Contacts",
      totalItems: pendingInvitationItems.length,
      priority: pendingInvitationItems[0].priority,
      priorityLevel: "Medium",
    });
    pendingInvitationItems.forEach((item) => consumed.add(item.actionKey));
  }

  if (readyInviteItems.length > 1) {
    rows.push({
      key: "contacts-ready-group",
      title: "Send invite",
      stageName: "Contacts",
      blockerLabel: `${readyInviteItems.length} contacts are ready for invite emails.`,
      whyItMatters: "Invites help trusted people confirm their role before access is ever needed.",
      status: "Required",
      actionKey: readyInviteItems[0].actionKey,
      href: readyInviteItems[0].href,
      requiredRole: readyInviteItems[0].requiredRole,
      primaryActionLabel: "Review invite",
      secondaryActionLabel: "Open Contacts",
      totalItems: readyInviteItems.length,
      priority: readyInviteItems[0].priority,
      priorityLevel: "Medium",
    });
    readyInviteItems.forEach((item) => consumed.add(item.actionKey));
  }

  for (const item of items) {
    if (consumed.has(item.actionKey)) continue;
    rows.push({
      key: item.actionKey,
      title: getActionTitle(item),
      stageName: item.stageName,
      blockerLabel: item.blockerLabel,
      whyItMatters: getActionReason(item),
      status: getActionStatus(item),
      actionKey: item.actionKey,
      href: item.href,
      requiredRole: item.requiredRole,
      primaryActionLabel: getPrimaryActionLabel(item),
      secondaryActionLabel: getSecondaryActionLabel(item),
      totalItems: 1,
      priority: getActionPriorityRank(item),
      priorityLevel: getActionPriorityLevel(item),
    });
  }

  return dedupeRows([...buildDashboardActionRows(context), ...rows])
    .sort((left, right) => left.priority - right.priority || left.title.localeCompare(right.title));
}

function getActionTitle(item: BlockingItem) {
  const label = item.blockerLabel.toLowerCase();
  if (item.stageKey === "profile") return "Complete profile";
  if (item.stageKey === "contacts" && label.includes("ready for an invite")) return "Send invite";
  if (item.stageKey === "contacts" && label.includes("accept")) return "Check invitation status";
  if (item.stageKey === "contacts" && label.includes("failed")) return "Resolve failed invitation";
  if (item.stageKey === "financial") return "Add financial record";
  if (item.stageKey === "legal") return "Review will information";
  if (item.stageKey === "property") return "Add property record";
  if (item.stageKey === "business") return "Add business record";
  if (item.stageKey === "digital") return "Add digital record";
  if (item.stageKey === "personal") return "Add personal record";
  if (item.stageKey === "verification") return "Review verification";
  return item.stageName;
}

function getActionReason(item: BlockingItem) {
  const label = item.blockerLabel.toLowerCase();
  if (item.stageKey === "profile") return "Your profile helps trusted people verify your identity and contact details.";
  if (item.stageKey === "contacts" && label.includes("ready for an invite")) return "The contact is ready, but they need an invitation before they can accept their role.";
  if (item.stageKey === "contacts" && label.includes("accept")) return "Access is not ready until the invitation has been accepted.";
  if (item.stageKey === "financial") return "Financial records help your executor understand accounts and assets quickly.";
  if (item.stageKey === "legal") return "Legal information, including wills and key documents, is central to estate decisions.";
  if (item.stageKey === "property") return "Property details help others understand ownership, value, and responsibilities.";
  if (item.stageKey === "business") return "Business interests can need fast, careful handling if someone else must step in.";
  if (item.stageKey === "digital") return "Digital records reduce uncertainty around accounts, subscriptions, and online access.";
  if (item.stageKey === "personal") return "Personal records give trusted people context that may not be stored elsewhere.";
  if (item.stageKey === "verification") return "Verification keeps access controlled before sensitive vault information is released.";
  return "This keeps your vault clearer and easier to act on later.";
}

function buildDashboardActionRows(context?: ActionCentreContext): ActionCentreRow[] {
  if (!context) return [];
  const seeds: DashboardActionSeed[] = [];

  if (!context.hasExecutor) {
    seeds.push({
      key: "dashboard-add-executor",
      title: "Add executor",
      stageName: "Contacts",
      blockerLabel: "Add an executor so your estate has a named person who can act when needed.",
      whyItMatters: "An executor is a core estate-readiness record and helps your family understand who should take responsibility.",
      status: "Required",
      actionKey: "dashboard:add-executor",
      href: "/contacts?group=executors",
      requiredRole: "owner",
      primaryActionLabel: "Add executor",
      secondaryActionLabel: "Open Contacts",
    });
  }

  if (context.contactCount === 0 && context.hasExecutor) {
    seeds.push({
      key: "dashboard-add-contact",
      title: "Add trusted contact",
      stageName: "Contacts",
      blockerLabel: "Add at least one trusted contact.",
      whyItMatters: "Trusted contacts make access decisions clearer and reduce uncertainty for your family.",
      status: "Recommended",
      actionKey: "stage:personal",
      href: "/contacts",
      requiredRole: "owner",
      primaryActionLabel: "Add contact",
      secondaryActionLabel: "Open Contacts",
    });
  }

  if (context.documentCount === 0) {
    if (context.estateReadiness) {
      // Estate-readiness document actions are added below with more specific labels.
    } else {
    seeds.push({
      key: "dashboard-upload-document",
      title: "Upload key document",
      stageName: "Documents",
      blockerLabel: "Upload at least one important document.",
      whyItMatters: "Documents provide evidence for records and help trusted people act with confidence.",
      status: "Recommended",
      actionKey: "dashboard:upload-document",
      href: "/property/documents",
      requiredRole: "owner",
      primaryActionLabel: "Upload document",
      secondaryActionLabel: "Open Documents",
    });
    }
  }

  if (context.estateReadiness && !context.estateReadiness.willUploaded) {
    seeds.push({
      key: "dashboard-upload-will",
      title: "Upload will",
      stageName: "Legal readiness",
      blockerLabel: "Upload your will or add will information so trusted people can find the record when needed.",
      whyItMatters: "Will information is a core readiness signal. Legacy Fortress records whether it exists, but does not validate legal authenticity.",
      status: "Recommended",
      actionKey: "dashboard:review-will",
      href: "/legal/wills",
      requiredRole: "owner",
      primaryActionLabel: "Review will",
      secondaryActionLabel: "Open Legal",
    });
  }

  if (context.estateReadiness && !context.estateReadiness.keyDocumentsPresent) {
    seeds.push({
      key: "dashboard-add-key-documents",
      title: "Add key documents",
      stageName: "Legal readiness",
      blockerLabel: "Add identity and key financial or property documents where relevant.",
      whyItMatters: "Supporting documents help trusted people understand the record without relying on memory or guesswork.",
      status: "Recommended",
      actionKey: "dashboard:upload-document",
      href: "/property/documents",
      requiredRole: "owner",
      primaryActionLabel: "Add documents",
      secondaryActionLabel: "Open Documents",
    });
  }

  if (context.profileIncomplete) {
    seeds.push({
      key: "dashboard-complete-profile",
      title: "Complete profile",
      stageName: "Profile",
      blockerLabel: "Complete your basic profile details.",
      whyItMatters: "Your profile helps trusted people verify identity, address, and contact details.",
      status: "Recommended",
      actionKey: "stage:profile",
      href: "/profile",
      requiredRole: "owner",
      primaryActionLabel: "Complete profile",
      secondaryActionLabel: "Open Profile",
    });
  }

  return seeds.map((seed) => {
    const priorityLevel = getSeedPriorityLevel(seed);
    return {
      ...seed,
      totalItems: 1,
      priorityLevel,
      priority: priorityRank(priorityLevel),
    };
  });
}

function dedupeRows(rows: ActionCentreRow[]) {
  const seen = new Set<string>();
  const result: ActionCentreRow[] = [];
  for (const row of rows) {
    const dedupeKey = getRowDedupeKey(row);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    result.push(row);
  }
  return result;
}

function getRowDedupeKey(row: ActionCentreRow) {
  if (row.stageName === "Tasks") return getTaskDedupeKey({ title: row.title, href: row.href, relatedEntity: row.relatedEntity });
  if (row.title.toLowerCase().includes("executor")) return "executor";
  if (row.key === "dashboard-upload-will" || row.title.toLowerCase().includes("will")) return "will";
  if (row.stageName === "Profile") return "profile";
  if (row.stageName === "Documents") return "documents";
  if (row.key === "dashboard-add-key-documents") return "key-documents";
  if (row.stageName === "Contacts" && row.title.toLowerCase().includes("contact")) return "contacts";
  return row.key || row.actionKey;
}

function taskDuplicatesAction(task: Pick<ActionCentreTask, "title" | "href" | "relatedEntity" | "type">, actionDedupeKeys: Set<string>) {
  if (task.type !== "system_generated") return false;
  return actionDedupeKeys.has(getTaskDedupeKey(task));
}

function getTaskDedupeKey(task: Pick<ActionCentreTask, "title" | "href" | "relatedEntity">) {
  const haystack = [task.title, task.href, task.relatedEntity].map((value) => String(value ?? "").toLowerCase()).join(" ");
  if (haystack.includes("executor")) return "executor";
  if (haystack.includes("will")) return "will";
  if (haystack.includes("profile")) return "profile";
  if (haystack.includes("document") || haystack.includes("upload")) return "documents";
  if (haystack.includes("contact") || haystack.includes("next of kin")) return "contacts";
  return `task:${haystack.trim()}`;
}

function isCompletedTaskStatus(status: string) {
  return /completed|cancelled/i.test(status);
}

function getTaskPriorityLevel(task: ActionCentreTask): ActionPriorityLevel {
  if (task.type === "reminder") return "Medium";
  if (task.type === "system_generated") return "High";
  return "Low";
}

function formatTaskType(type: ActionCentreTaskType) {
  if (type === "system_generated") return "System generated";
  if (type === "reminder") return "Reminder";
  return "User created";
}

function formatTaskReason(task: ActionCentreTask) {
  const details = [task.description, task.relatedEntity ? `Related to ${task.relatedEntity}.` : "", task.dueDate ? `Due ${task.dueDate}.` : ""]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return details || "This task is part of your vault follow-up list.";
}

function getSeedPriorityLevel(seed: DashboardActionSeed): ActionPriorityLevel {
  if (seed.key === "dashboard-add-executor") return "Critical";
  if (seed.key === "dashboard-add-contact" || seed.key === "dashboard-upload-will") return "High";
  if (seed.key === "dashboard-upload-document" || seed.key === "dashboard-add-key-documents") return "Medium";
  if (seed.key === "dashboard-complete-profile") return "Medium";
  return "Low";
}

function getActionPriorityLevel(item: BlockingItem): ActionPriorityLevel {
  const label = item.blockerLabel.toLowerCase();
  if (item.stageKey === "contacts" && label.includes("executor")) return "Critical";
  if (item.stageKey === "contacts") return "High";
  if (item.stageKey === "profile") return "Medium";
  return "Low";
}

function getActionPriorityRank(item: BlockingItem) {
  return priorityRank(getActionPriorityLevel(item)) + Math.min(item.priority, 9) / 10;
}

function priorityRank(level: ActionPriorityLevel) {
  if (level === "Critical") return 0;
  if (level === "High") return 10;
  if (level === "Medium") return 20;
  return 30;
}

function getActionStatus(item: BlockingItem): ActionCentreStatus {
  const label = item.blockerLabel.toLowerCase();
  if (label.includes("plan") || label.includes("limit")) return "Plan limit reached";
  if (label.includes("failed") || label.includes("error")) return "Failed";
  if (item.requiredRole !== "owner") return "Pending";
  if (item.stageKey === "profile" || item.stageKey === "contacts") return "Required";
  return "Recommended";
}

function getPrimaryActionLabel(item: BlockingItem) {
  const status = getActionStatus(item);
  if (status === "Plan limit reached") return "Review subscription";
  if (status === "Failed") return "Resolve issue";
  if (item.stageKey === "contacts") return "Review invite";
  if (item.stageKey === "verification") return "Review request";
  return "Review task";
}

function getSecondaryActionLabel(item: BlockingItem) {
  if (item.stageKey === "profile") return "Open Profile";
  if (item.stageKey === "contacts") return "Open Contacts";
  if (item.stageKey === "financial") return "Open Finances";
  if (item.stageKey === "legal") return "Open Legal";
  if (item.stageKey === "property") return "Open Property";
  if (item.stageKey === "business") return "Open Business";
  if (item.stageKey === "digital") return "Open Digital";
  if (item.stageKey === "personal") return "Open Personal";
  return undefined;
}

function getSectionPriority(rows: ActionCentreRow[]) {
  if (!rows.length) return Number.POSITIVE_INFINITY;
  return Math.min(...rows.map((item) => item.priority));
}

function getSectionPriorityLevel(rows: ActionCentreRow[]): ActionPriorityLevel {
  const priority = getSectionPriority(rows);
  if (priority < 10) return "Critical";
  if (priority < 20) return "High";
  if (priority < 30) return "Medium";
  return "Low";
}

const panelStyle = {
  border: "1px solid #e8e1dc",
  borderRadius: 12,
  background: "#fff",
  padding: 22,
  display: "grid",
  gap: 14,
} satisfies CSSProperties;

const iconWrapStyle = {
  width: 40,
  height: 40,
  borderRadius: 12,
  background: "#f7f3f0",
  border: "1px solid #eadfd8",
  color: "#3a2118",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
} satisfies CSSProperties;

const activeBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  border: "1px solid #eadfd8",
  background: "#fffefd",
  color: "#5d2d1f",
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
      padding: 14,
      display: "grid",
      gap: 8,
      background: "#f0fdf4",
    };
  }
  if (tone === "alert") {
    return {
      border: "1px solid #eadfd8",
      borderRadius: 12,
      padding: 14,
      display: "grid",
      gap: 8,
      background: "#fffefd",
    };
  }
  return {
    border: "1px solid #e8e1dc",
    borderRadius: 12,
    padding: 14,
    display: "grid",
    gap: 8,
    background: "#fffefd",
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
    border: "1px solid #e8e1dc",
    background: "#f8f6f4",
    color: "#5f5852",
    padding: "2px 7px",
  };
}

const itemRowStyle = {
  border: "1px solid #eee8e3",
  borderRadius: 10,
  background: "#fff",
  padding: "11px 12px",
  display: "grid",
  gap: 10,
} satisfies CSSProperties;

function accordionIconStyle(isOpen: boolean): CSSProperties {
  return {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#fff",
    color: "#0f172a",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transform: isOpen ? "rotate(0deg)" : "none",
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
      width: 34,
      height: 34,
      borderRadius: 10,
      background: "#f7f3f0",
      color: "#5d2d1f",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    };
  }
  if (tone === "muted") {
    return {
      width: 34,
      height: 34,
      borderRadius: 10,
      background: "#f8f6f4",
      color: "#5f5852",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    };
  }
  return {
    width: 34,
    height: 34,
    borderRadius: 10,
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

const rowTitleStyle = {
  color: "#1f1712",
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.25,
} satisfies CSSProperties;

const rowLabelStyle = {
  color: "#334155",
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1.35,
} satisfies CSSProperties;

const rowReasonStyle = {
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.4,
} satisfies CSSProperties;

const rowActionsStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
  paddingTop: 2,
} satisfies CSSProperties;

const primaryActionStyle = {
  border: "1px solid #2b201b",
  borderRadius: 9,
  background: "#2b201b",
  color: "#fff",
  minHeight: 36,
  padding: "0 12px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
} satisfies CSSProperties;

const secondaryActionStyle = {
  textDecoration: "none",
  border: "1px solid #ded6cf",
  borderRadius: 9,
  background: "#fffefd",
  color: "#3a2118",
  minHeight: 36,
  padding: "0 12px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  fontWeight: 750,
} satisfies CSSProperties;

function statusPillStyle(status: ActionCentreStatus): CSSProperties {
  const palette: Record<ActionCentreStatus, { border: string; background: string; color: string }> = {
    Required: { border: "#eadfd8", background: "#fff7ed", color: "#7c2d12" },
    Recommended: { border: "#e8e1dc", background: "#f8f6f4", color: "#5f5852" },
    Pending: { border: "#bfdbfe", background: "#eff6ff", color: "#1d4ed8" },
    Complete: { border: "#bbf7d0", background: "#f0fdf4", color: "#166534" },
    Failed: { border: "#fecaca", background: "#fef2f2", color: "#991b1b" },
    "Plan limit reached": { border: "#fed7aa", background: "#fff7ed", color: "#9a3412" },
  };
  const tone = palette[status];
  return {
    border: `1px solid ${tone.border}`,
    background: tone.background,
    color: tone.color,
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: "nowrap",
  };
}

function priorityPillStyle(priority: ActionPriorityLevel): CSSProperties {
  const palette: Record<ActionPriorityLevel, { border: string; background: string; color: string }> = {
    Critical: { border: "#d6b59b", background: "#2b201b", color: "#ffffff" },
    High: { border: "#fed7aa", background: "#fff7ed", color: "#9a3412" },
    Medium: { border: "#e8e1dc", background: "#f8f6f4", color: "#5f5852" },
    Low: { border: "#e2e8f0", background: "#f8fafc", color: "#475569" },
  };
  const tone = palette[priority];
  return {
    border: `1px solid ${tone.border}`,
    background: tone.background,
    color: tone.color,
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 850,
    whiteSpace: "nowrap",
  };
}
