"use client";

import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { BlockingItem } from "../../../../lib/workflow/blockingModel";
import type { GuidanceAction, GuidanceItem } from "../../../../lib/readiness/guidance";
import type { VaultApplicabilityState } from "../../../../lib/vaultPreferences";
import { countOpenNeedsYou, getVaultTaskGroup } from "../../../../lib/workflow/taskGroups";
import Icon from "../../../../components/ui/Icon";
import SwipeToClear from "../../../../components/notifications/SwipeToClear";
import { actionReadKey, useInboxReads, useInboxUpdates } from "../../../../lib/notifications/inboxUpdates";

type ActionQueuePanelProps = {
  items: BlockingItem[];
  onAction: (actionKey: string) => void;
  context?: ActionCentreContext;
  guidanceItems?: GuidanceItem[];
  onGuidanceDecision?: (item: GuidanceItem, action: Exclude<GuidanceAction, "add" | "learn_more">) => void;
  onGuidanceApplicability?: (item: GuidanceItem, state: Extract<VaultApplicabilityState, "yes" | "no" | "unsure">) => Promise<boolean> | boolean;
  guidanceBusyKey?: string | null;
};

export type ActionCentreContext = {
  hasExecutor: boolean;
  contactCount: number;
  documentCount: number;
  profileIncomplete: boolean;
  tasks?: ActionCentreTask[];
  guidanceItems?: GuidanceItem[];
  estateReadiness?: {
    executorAssigned: boolean;
    willUploaded: boolean;
    keyDocumentsPresent: boolean;
  };
  /** Nominees asking for access now (va-v7). */
  earlyAccessRequests?: Array<{ id: string; name: string }>;
  /** Suggested documents waiting for the owner's decision (V5.2 7b). */
  pendingSuggestions?: Array<{ id: string; proposerName: string; recordTitle: string }>;
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
  guidanceItem?: GuidanceItem;
};

export type ActionCentrePreviewItem = {
  key: string;
  title: string;
  actionKey: string;
  href: string;
  blockerLabel: string;
  priorityLevel: ActionPriorityLevel;
  source: "readiness" | "workflow" | "task";
  dismissible: boolean;
  snoozable: boolean;
  eligibleChannels: Array<"in_app" | "login" | "email" | "push">;
  guidanceKey?: GuidanceItem["key"];
  guidanceState?: VaultApplicabilityState;
};

type ActionCentreStatus = "Required" | "Recommended" | "Pending" | "Complete" | "Failed" | "Plan limit reached";
type ActionPriorityLevel = "Critical" | "High" | "Medium" | "Low";
type ActionCentreTaskType = "user_created" | "system_generated" | "reminder";

function actionGroup(row: ActionCentreRow): "todo" | "waiting" | "suggested" {
  return getVaultTaskGroup(row);
}

function taskIcon(row: ActionCentreRow) {
  const key = `${row.actionKey} ${row.title}`.toLowerCase();
  if (key.includes("invite")) return "send";
  if (key.includes("access") || key.includes("share")) return "key";
  if (key.includes("will") || key.includes("legal")) return "gavel";
  if (key.includes("document") || key.includes("statement")) return "note_add";
  if (key.includes("verif")) return "verified_user";
  if (row.taskType === "reminder" || actionGroup(row) === "waiting") return "schedule";
  return actionGroup(row) === "suggested" ? "lightbulb" : "task_alt";
}

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

function ActionQueuePanel({ items, onAction, context, guidanceItems, onGuidanceDecision, onGuidanceApplicability, guidanceBusyKey }: ActionQueuePanelProps) {
  return <ActionCentreInbox {...{ items, onAction, context, guidanceItems, onGuidanceDecision, onGuidanceApplicability, guidanceBusyKey }} />;

  /* Legacy grouping retained below for the existing action builders. */
  /*
  const sections = useMemo(
    () => buildActionCentreSections(items, context ? { ...context, guidanceItems } : undefined),
    [context, guidanceItems, items],
  );
  const activeBlockerCount = sections
    .filter((section) => section.key !== "completed" && section.key !== "clear")
    .reduce((sum, section) => sum + section.count, 0);
  const visibleSections = sections.filter((section) => section.key !== "completed" && section.key !== "clear" && section.rows.length > 0);

  return (
    <section id="action-centre" className="lf-action-centre" style={panelStyle} aria-label="To do">
      <div style={{ display: "grid", gap: 4 }}>
        <div className="lf-action-centre-header" style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
          <div style={iconWrapStyle}>
            <Icon name={activeBlockerCount > 0 ? "notifications_active" : "verified"} size={21} />
          </div>
          <h2 style={{ margin: 0, fontSize: 18 }}>To do</h2>
          <span style={activeBlockerCount > 0 ? activeBadgeStyle : clearBadgeStyle}>
            {activeBlockerCount > 0 ? `${activeBlockerCount} active` : "All clear"}
          </span>
          <InfoTip
            className="lf-panel-help"
            label="Explain To do"
            title="To do"
            tone="warning"
            message="Actions are grouped prompts from your vault data. Completing them can make records easier for trusted people to understand."
          />
        </div>
        <div className="lf-action-centre-intro" style={{ color: "var(--lf-text-secondary)", fontSize: 13 }}>
          See the next actions that make your vault easier for trusted people to understand and use. Things to do,
          reminders, and user-created tasks live here instead of the dashboard overview.
        </div>
      </div>

      {activeBlockerCount === 0 ? (
        <section style={clearStateStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="verified" size={22} />
            <strong>All up to date</strong>
          </div>
          <div style={{ color: "var(--lf-status-approved-text)", fontSize: 13 }}>
            No urgent dashboard actions need attention right now. You can still review or add records at any time.
          </div>
        </section>
      ) : (
        <div className="lf-action-centre-sections" style={{ display: "grid", gap: 8 }}>
          {visibleSections.map((section) => (
              <section key={section.key} className="lf-action-centre-section" style={sectionCardStyle(section.tone)} aria-label={section.title}>
                <div className="lf-action-centre-section-header" style={sectionHeaderStyle}>
                  <div style={{ display: "grid", gap: 4, textAlign: "left", minWidth: 0 }}>
                    <div className="lf-action-centre-section-title-row" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                      <span style={sectionIconStyle(section.tone)} aria-hidden>
                        <Icon name={section.icon} size={20} />
                      </span>
                      <span style={sectionTitleStyle}>{section.title}</span>
                      <span style={sectionPillStyle(section.tone)}>
                        {section.count}
                      </span>
                    </div>
                    <div className="lf-action-centre-section-summary" style={sectionSummaryStyle}>
                      {section.summary}
                    </div>
                  </div>
                </div>
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
                            {item.guidanceItem?.key === "will" && item.guidanceItem.state === "unknown" && onGuidanceApplicability ? (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} aria-label="Will applicability choices">
                                <button type="button" style={primaryActionStyle} onClick={() => onGuidanceApplicability(item.guidanceItem!, "yes")}>Yes, I have a Will</button>
                                <button type="button" style={secondaryActionStyle} onClick={() => onGuidanceApplicability(item.guidanceItem!, "no")}>No, I don&apos;t have one</button>
                                <button type="button" style={secondaryActionStyle} onClick={() => onGuidanceApplicability(item.guidanceItem!, "unsure")}>I&apos;m not sure</button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                style={primaryActionStyle}
                                onClick={() => onAction(item.actionKey)}
                                title={`${item.primaryActionLabel}: ${item.title}`}
                              >
                                {item.primaryActionLabel}
                              </button>
                            )}
                            {item.guidanceItem?.learnMoreHref ? (
                              <a href={item.guidanceItem.learnMoreHref} style={secondaryActionStyle} title={`Learn more: ${item.title}`}>
                                Learn more
                              </a>
                            ) : null}
                            {item.guidanceItem && onGuidanceDecision ? (
                              <details className="lf-action-centre-more-options">
                                <summary>More options</summary>
                                <div className="lf-action-centre-more-options-list">
                                  <button type="button" style={secondaryActionStyle} disabled={guidanceBusyKey === item.guidanceItem.key} onClick={() => onGuidanceDecision(item.guidanceItem!, "already_done")}>Already done</button>
                                  <button type="button" style={secondaryActionStyle} disabled={guidanceBusyKey === item.guidanceItem.key} onClick={() => onGuidanceDecision(item.guidanceItem!, "not_relevant")}>{(item.guidanceItem as { dismissLabel?: string }).dismissLabel ?? "Not relevant"}</button>
                                  <button type="button" style={secondaryActionStyle} disabled={guidanceBusyKey === item.guidanceItem.key} onClick={() => onGuidanceDecision(item.guidanceItem!, "remind_later")}>
                                    {guidanceBusyKey === item.guidanceItem.key ? "Saving..." : "Remind me later"}
                                  </button>
                                </div>
                              </details>
                            ) : null}
                          </div>
                        </div>
                      </article>
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </section>
  );
  */
}

// Inbox (owner decision 10 Nov 2026): things to do and updates in one list, like Mail. Filter All / Actions / Updates;
// a filled dot is new, an outline dot has been read. Orange is an action, blue an update, and each row also says so
// in words. Opening an action never completes it: actions stay until done or put off; updates can be cleared.
type InboxFilter = "all" | "actions" | "updates";
type InboxSelection = { kind: "action"; key: string } | { kind: "update"; id: string } | null;

function inboxTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const age = Date.now() - date.getTime();
  if (age < 60_000) return "Just now";
  if (age < 3_600_000) return `${Math.floor(age / 60_000)} min ago`;
  if (age < 86_400_000) return `${Math.floor(age / 3_600_000)} h ago`;
  if (age < 7 * 86_400_000) return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(date);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}

function ActionCentreInbox({ items, onAction, context, guidanceItems, onGuidanceDecision, onGuidanceApplicability, guidanceBusyKey }: ActionQueuePanelProps) {
  const rows = useMemo(
    () => getActiveActionRows(items, context ? { ...context, guidanceItems } : undefined),
    [context, guidanceItems, items],
  );
  const reads = useInboxReads();
  const { updates, loading: updatesLoading, markRead, markUnread, clear, restore } = useInboxUpdates(true, reads);
  const [selection, setSelection] = useState<InboxSelection>(null);
  const [willChoice, setWillChoice] = useState<"yes" | "no" | "unsure" | null>(null);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [undo, setUndo] = useState<string[]>([]);
  const requestedActionHandled = useRef(false);
  const selectedRow = selection?.kind === "action" ? rows.find((row) => row.actionKey === selection.key) ?? null : null;
  const selectedUpdate = selection?.kind === "update" ? updates.find((item) => item.id === selection.id) ?? null : null;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get("filter");
    if (wanted === "todo" || wanted === "actions") queueMicrotask(() => setFilter("actions"));
    if (wanted === "updates") queueMicrotask(() => setFilter("updates"));
  }, []);

  useEffect(() => {
    const requestedAction = new URLSearchParams(window.location.search).get("action");
    if (requestedAction && !requestedActionHandled.current && rows.some((row) => row.actionKey === requestedAction)) {
      requestedActionHandled.current = true;
      queueMicrotask(() => setSelection({ kind: "action", key: requestedAction }));
    }
  }, [rows]);

  useEffect(() => {
    if (!selection) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelection(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selection]);

  function openAction(row: ActionCentreRow) {
    setWillChoice(null);
    reads.markRead([actionReadKey(row.actionKey)]);
    setSelection({ kind: "action", key: row.actionKey });
  }
  function openUpdate(id: string) {
    markRead([id]);
    setSelection({ kind: "update", id });
  }
  function clearUpdates(ids: string[]) {
    clear(ids);
    setUndo(ids);
    setSelection(null);
  }
  function markAllRead() {
    markRead(updates.map((item) => item.id));
    reads.markRead(rows.map((row) => actionReadKey(row.actionKey)));
  }

  const groupLabel = (row: ActionCentreRow) => actionGroup(row) === "todo" ? "Needs you" : actionGroup(row) === "waiting" ? "Waiting on others" : "Suggested";
  const showActions = filter !== "updates";
  const showUpdates = filter !== "actions";
  const readUpdates = updates.filter((item) => item.read).map((item) => item.id);

  function dot(kind: "action" | "update", isNew: boolean) {
    return <span className={`lf-inbox-dot is-${kind}${isNew ? " is-new" : ""}`} aria-hidden="true" />;
  }

  return (
    <section id="action-centre" className="lf-action-centre lf-v52-todo lf-inbox" style={panelStyle} aria-label="Inbox">
      <div className="lf-inbox-toolbar">
        <div className="lf-v51-action-filters" aria-label="Show">
          {([["all", "All", rows.length + updates.length], ["actions", "Actions", rows.length], ["updates", "Updates", updates.length]] as const).map(([key, label, count]) =>
            <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>
              {key !== "all" ? <span className={`lf-inbox-dot is-${key === "actions" ? "action" : "update"} is-new`} aria-hidden="true" /> : null}{label} <span>{count}</span>
            </button>)}
        </div>
        <span className="lf-inbox-toolbar-actions">
          <button type="button" className="lf-ui-button lf-ui-button-text" onClick={markAllRead}>Mark all as read</button>
          {showUpdates && readUpdates.length ? <button type="button" className="lf-ui-button lf-ui-button-text" onClick={() => clearUpdates(readUpdates)}>Clear read updates</button> : null}
        </span>
      </div>
      <p className="lf-inbox-key"><span>{dot("action", true)} Action</span><span>{dot("update", true)} Update</span><span>Filled dot: new. Outline: read. Actions stay until done or put off.</span></p>
      {undo.length ? <div className="lf-notifications-undo" role="status">{undo.length === 1 ? "Update cleared." : `${undo.length} updates cleared.`}<button type="button" onClick={() => { restore(undo); setUndo([]); }}>Undo</button></div> : null}
      {!rows.length && !updates.length && !updatesLoading ? <section style={clearStateStyle}><strong>You’re all caught up.</strong><span>Things to do and updates about your Vault will appear here.</span></section> : null}
      <div className="lf-action-centre-inbox lf-inbox-list" role="list">
        {showActions ? rows.map((row) => {
          const isNew = !reads.read.includes(actionReadKey(row.actionKey));
          return <article key={row.actionKey} role="listitem" className="lf-v52-todo-row lf-inbox-row" data-task-group={actionGroup(row)}>
            <button type="button" className="lf-v52-todo-row-button" onClick={() => openAction(row)} aria-label={`Action, ${groupLabel(row)}${isNew ? ", new" : ""}: ${row.title}. Open`}>
              {dot("action", isNew)}
              <span className="lf-v52-todo-row-copy">
                <strong className={isNew ? "is-new" : undefined}>{row.title}</strong>
                <small>{row.blockerLabel}</small>
                <span className="lf-inbox-tag is-action">Action · {groupLabel(row)}</span>
              </span>
              <Icon name="chevron_right" size={20} />
            </button>
          </article>;
        }) : null}
        {showUpdates ? updates.map((item) => (
          <SwipeToClear key={item.id} label={item.title} onClear={() => clearUpdates([item.id])}>
            <article role="listitem" className="lf-v52-todo-row lf-inbox-row">
              <button type="button" className="lf-v52-todo-row-button" onClick={() => openUpdate(item.id)} aria-label={`Update${item.read ? "" : ", new"}: ${item.title}. Open`}>
                {dot("update", !item.read)}
                <span className="lf-v52-todo-row-copy">
                  <strong className={item.read ? undefined : "is-new"}>{item.title}</strong>
                  <small>{item.detail}</small>
                  <span className="lf-inbox-tag is-update">Update · <time dateTime={item.createdAt}>{inboxTime(item.createdAt)}</time></span>
                </span>
                <Icon name="chevron_right" size={20} />
              </button>
            </article>
          </SwipeToClear>
        )) : null}
      </div>
      {(rows.length || updates.length) && filter === "actions" && !rows.length ? <p className="lf-inbox-empty">Nothing to do right now.</p> : null}
      {(rows.length || updates.length) && filter === "updates" && !updates.length && !updatesLoading ? <p className="lf-inbox-empty">No updates yet. When someone accepts an invitation or something changes in your Vault, it will appear here.</p> : null}
      {showUpdates && updates.length ? <p className="lf-notifications-hint">On a phone, swipe an update left or right to clear it.</p> : null}
      {updatesLoading && showUpdates ? <p className="lf-notifications-hint">Loading updates…</p> : null}

      {selectedRow ? (
        <div className="lf-action-centre-drawer-backdrop" role="presentation" onClick={() => setSelection(null)}>
          <section className="lf-action-centre-drawer lf-inbox-message" role="dialog" aria-modal="true" aria-labelledby="inbox-message-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="lf-inbox-back" onClick={() => setSelection(null)}><Icon name="arrow_back" size={20} />Inbox</button>
            <span className="lf-inbox-tag is-action">Action · {groupLabel(selectedRow)}</span>
            <h2 id="inbox-message-title">{selectedRow.title}</h2>
            <p className="lf-inbox-message-body">{selectedRow.whyItMatters}</p>
            <p className="lf-inbox-message-meta">{selectedRow.blockerLabel}</p>
            {selectedRow.guidanceItem?.key === "will" && selectedRow.guidanceItem.state === "unknown" && onGuidanceApplicability ? (
              <div style={drawerChoiceStyle}>
                <fieldset className="lf-action-will-choices">
                  <legend>Have you already made a Will?</legend>
                  {([ ["yes", "Yes, I have a Will"], ["no", "No, I don’t have one"], ["unsure", "I’m not sure"] ] as const).map(([value, label]) => (
                    <label key={value}><input type="radio" name="will-applicability" value={value} checked={willChoice === value} onChange={() => setWillChoice(value)} />{label}</label>
                  ))}
                </fieldset>
                <button type="button" style={primaryActionStyle} disabled={!willChoice || guidanceBusyKey === selectedRow.guidanceItem.key} onClick={() => {
                  if (!willChoice) return;
                  void Promise.resolve(onGuidanceApplicability(selectedRow.guidanceItem!, willChoice)).then((saved) => {
                    if (saved) setSelection(null);
                  });
                }}>Save choice</button>
              </div>
            ) : (
              <button type="button" className="lf-inbox-primary" onClick={() => onAction(selectedRow.actionKey)}>{selectedRow.primaryActionLabel}</button>
            )}
            {selectedRow.guidanceItem && onGuidanceDecision ? (
              <div className="lf-inbox-message-actions">
                <button type="button" className="lf-inbox-secondary" disabled={guidanceBusyKey === selectedRow.guidanceItem.key} onClick={() => { onGuidanceDecision(selectedRow.guidanceItem!, "remind_later"); setSelection(null); }}>{guidanceBusyKey === selectedRow.guidanceItem.key ? "Saving…" : "Not now"}</button>
                <button type="button" className="lf-inbox-secondary" disabled={guidanceBusyKey === selectedRow.guidanceItem.key} onClick={() => { onGuidanceDecision(selectedRow.guidanceItem!, "already_done"); setSelection(null); }}>Mark as done</button>
              </div>
            ) : null}
            {selectedRow.guidanceItem && onGuidanceDecision ? <button type="button" className="lf-inbox-quiet" disabled={guidanceBusyKey === selectedRow.guidanceItem.key} onClick={() => { onGuidanceDecision(selectedRow.guidanceItem!, "not_relevant"); setSelection(null); }}>{(selectedRow.guidanceItem as { dismissLabel?: string }).dismissLabel ?? "This doesn’t apply to me"}</button> : null}
            {selectedRow.guidanceItem?.learnMoreHref ? <a href={selectedRow.guidanceItem.learnMoreHref} className="lf-inbox-quiet">Learn more</a> : null}
            <button type="button" className="lf-inbox-quiet" onClick={() => { reads.markUnread(actionReadKey(selectedRow.actionKey)); setSelection(null); }}>Mark as unread</button>
          </section>
        </div>
      ) : null}

      {selectedUpdate ? (
        <div className="lf-action-centre-drawer-backdrop" role="presentation" onClick={() => setSelection(null)}>
          <section className="lf-action-centre-drawer lf-inbox-message" role="dialog" aria-modal="true" aria-labelledby="inbox-message-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="lf-inbox-back" onClick={() => setSelection(null)}><Icon name="arrow_back" size={20} />Inbox</button>
            <span className="lf-inbox-tag is-update">Update · <time dateTime={selectedUpdate.createdAt}>{inboxTime(selectedUpdate.createdAt)}</time></span>
            <h2 id="inbox-message-title">{selectedUpdate.title}</h2>
            <p className="lf-inbox-message-body">{selectedUpdate.detail}</p>
            <a href={selectedUpdate.href} className="lf-inbox-primary">Open</a>
            <div className="lf-inbox-message-actions">
              <button type="button" className="lf-inbox-secondary" onClick={() => { markUnread(selectedUpdate.id); setSelection(null); }}>Mark as unread</button>
              <button type="button" className="lf-inbox-secondary" onClick={() => clearUpdates([selectedUpdate.id])}>Clear</button>
            </div>
          </section>
        </div>
      ) : null}
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
      primaryActionLabel: "View invitations",
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
      title: "Invite trusted people",
      stageName: "Contacts",
      blockerLabel: `${readyInviteItems.length} contacts are ready for invite emails.`,
      whyItMatters: "Invites help trusted people confirm their role before access is ever needed.",
      status: "Required",
      actionKey: readyInviteItems[0].actionKey,
      href: readyInviteItems[0].href,
      requiredRole: readyInviteItems[0].requiredRole,
      primaryActionLabel: "Send invitations",
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

  return dedupeRows([...buildDashboardActionRows(context), ...rows, ...buildGuidanceActionRows(context?.guidanceItems ?? [])])
    .sort((left, right) => left.priority - right.priority || left.title.localeCompare(right.title));
}

function getActiveActionRows(items: BlockingItem[], context?: ActionCentreContext) {
  return buildActionCentreSections(items, context)
    .filter((section) => section.key !== "completed" && section.key !== "clear")
    .flatMap((section) => section.rows)
    .sort((left, right) => left.priority - right.priority || left.title.localeCompare(right.title));
}

export function getActionCentreActionCount(
  items: BlockingItem[],
  context?: ActionCentreContext,
  guidanceItems: GuidanceItem[] = [],
) {
  return getActiveActionRows(items, context ? { ...context, guidanceItems } : undefined).length;
}

export function getActionCentreToDoCount(items: BlockingItem[], context?: ActionCentreContext, guidanceItems: GuidanceItem[] = []) {
  return countOpenNeedsYou(getActiveActionRows(items, context ? { ...context, guidanceItems } : undefined));
}

export function buildActionCentrePreview(
  items: BlockingItem[],
  context?: ActionCentreContext,
  guidanceItems: GuidanceItem[] = [],
  limit = 3,
  excludedActionKeys: readonly string[] = [],
  filter: "all" | "todo" = "all",
): ActionCentrePreviewItem[] {
  const excluded = new Set(excludedActionKeys);
  return getActiveActionRows(items, context ? { ...context, guidanceItems } : undefined)
    .filter((row) => !excluded.has(row.actionKey) && (filter === "all" || actionGroup(row) === "todo"))
    .slice(0, limit)
    .map(({ key, title, actionKey, href, blockerLabel, priorityLevel, guidanceItem, taskType }) => ({
      key,
      title,
      actionKey,
      href,
      blockerLabel,
      priorityLevel,
      source: guidanceItem ? "readiness" : taskType ? "task" : "workflow",
      dismissible: Boolean(guidanceItem),
      snoozable: Boolean(guidanceItem),
      eligibleChannels: guidanceItem ? ["in_app", "login", "email", "push"] : ["in_app", "login"],
      guidanceKey: guidanceItem?.key,
      guidanceState: guidanceItem?.state,
    }));
}

function buildGuidanceActionRows(items: GuidanceItem[]): ActionCentreRow[] {
  return items.map((item) => ({
    key: `guidance-${item.key}`,
    title: getGuidanceActionTitle(item),
    stageName: item.category,
    blockerLabel: item.description,
    whyItMatters: "A small, optional next step based on what you have recorded so far.",
    status: item.priority === "high" ? "Required" : "Recommended",
    actionKey: `guidance:${item.key}`,
    href: item.href,
    requiredRole: "owner",
    primaryActionLabel: getGuidanceActionLabel(item),
    secondaryActionLabel: item.learnMoreHref ? "Learn more" : undefined,
    totalItems: 1,
    priority: item.priority === "high" ? 25 : item.priority === "medium" ? 55 : 75,
    priorityLevel: item.priority === "high" ? "High" : item.priority === "medium" ? "Medium" : "Low",
    guidanceItem: item,
  }));
}

function getGuidanceActionTitle(item: GuidanceItem) {
  if (item.key === "will" && item.state === "unknown") return "Do you have a Will?";
  if (item.key === "will" && item.state === "no") return "Would you like help understanding your options for making a Will?";
  if (item.key === "will" && item.state === "unsure") return "Would you like to understand what a Will does?";
  if (item.key === "will") return "Would you like to add your Will to your Fortress?";
  if (item.key === "capacity_arrangements") return "Do you have a Lasting Power of Attorney?";
  if (item.key === "executor_after_will") return "Add the executors named in your Will";
  if (item.key === "attorney_after_capacity") return "Add an attorney to People I Trust";
  return item.title;
}

function getGuidanceActionLabel(item: GuidanceItem) {
  if (item.key === "will" && item.state === "unknown") return "Choose an option";
  if (item.key === "will" && item.state === "no") return "Explore my options";
  if (item.key === "will" && item.state === "unsure") return "Learn about Wills";
  if (item.key === "will") return "Add my Will";
  if (item.key === "executor_after_will") return "Add executor";
  if (item.key === "attorney_after_capacity") return "Add person";
  return item.actionLabel;
}

function getActionTitle(item: BlockingItem) {
  const label = item.blockerLabel.toLowerCase();
  if (item.stageKey === "profile") return label.includes("address") ? "Add your home address" : "Add your contact details";
  if (item.stageKey === "contacts" && label.includes("ready for an invite")) return `Invite ${item.blockerLabel.split(" is ready")[0]}`;
  if (item.stageKey === "contacts" && label.includes("accept")) return `Check ${item.blockerLabel.split(" still needs")[0]}'s invitation`;
  if (item.stageKey === "contacts" && label.includes("failed")) return "Resolve the invitation";
  if (item.stageKey === "financial") return "Add your financial details";
  if (item.stageKey === "legal") return label.includes("upload") ? "Add a copy of your Will" : "Review your legal records";
  if (item.stageKey === "property") return "Add your property details";
  if (item.stageKey === "business") return "Add your business details";
  if (item.stageKey === "digital") return "Add your digital details";
  if (item.stageKey === "personal") return "Add your personal details";
  if (item.stageKey === "verification") return "Review verification";
  return item.stageName;
}

function getActionReason(item: BlockingItem) {
  const label = item.blockerLabel.toLowerCase();
  if (item.stageKey === "profile") return "Your contact details help people reach you and keep your account information current.";
  if (item.stageKey === "contacts" && label.includes("ready for an invite")) return "This person is ready to receive a secure invitation.";
  if (item.stageKey === "contacts" && label.includes("accept")) return "This person is waiting to accept the invitation.";
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

  for (const suggestion of context.pendingSuggestions ?? []) {
    const first = suggestion.proposerName.trim().split(/\s+/)[0] || suggestion.proposerName;
    seeds.push({
      key: `suggestion-${suggestion.id}`,
      title: `Review ${first}’s document`,
      stageName: "Pending approval",
      blockerLabel: `${first} suggested a document for ${suggestion.recordTitle}. It isn’t added until you approve.`,
      whyItMatters: "Approving adds the file. It doesn’t share the record.",
      status: "Required",
      actionKey: `suggestion:${suggestion.id}`,
      href: `/actions?review=${encodeURIComponent(suggestion.id)}`,
      requiredRole: "owner",
      primaryActionLabel: "Review",
      secondaryActionLabel: "Open Inbox",
    });
  }

  for (const request of context.earlyAccessRequests ?? []) {
    const first = request.name.trim().split(/\s+/)[0] || request.name;
    seeds.push({
      key: `early-access-${request.id}`,
      title: `${first} asked for access now`,
      stageName: "People & Access",
      blockerLabel: `${first} is nominated for later and asked to see something now. Nothing changes unless you share.`,
      whyItMatters: "You decide. If you share, you choose exactly which records.",
      status: "Required",
      actionKey: `early-access:${request.id}`,
      href: `/people-access?view=vault-access&request=${encodeURIComponent(request.id)}`,
      requiredRole: "owner",
      primaryActionLabel: "Review request",
      secondaryActionLabel: "Open Vault access",
    });
  }

  if (context.estateReadiness?.willUploaded && !context.hasExecutor) {
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
  if (item.stageKey === "contacts" && label.includes("executor") && !label.includes("invitation")) return "Critical";
  if (item.stageKey === "contacts" && label.includes("failed")) return "High";
  if (item.stageKey === "contacts") return "Medium";
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
  if (item.stageKey === "contacts") return item.blockerLabel.toLowerCase().includes("accept") ? "View invitation" : "Send invitation";
  if (item.stageKey === "verification") return "Review verification";
  if (item.stageKey === "property") return "Continue setup";
  if (item.stageKey === "legal") return "Review your records";
  return "See what to do next";
}

function getSecondaryActionLabel(item: BlockingItem) {
  if (item.stageKey === "profile") return "Complete profile";
  if (item.stageKey === "contacts") return "View details";
  if (item.stageKey === "financial") return "View finances";
  if (item.stageKey === "legal") return "View legal records";
  if (item.stageKey === "property") return "Continue setup";
  if (item.stageKey === "business") return "View business records";
  if (item.stageKey === "digital") return "View digital records";
  if (item.stageKey === "personal") return "View personal records";
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
  border: 0,
  borderRadius: 0,
  background: "transparent",
  padding: 0,
  display: "grid",
  gap: 16,
} satisfies CSSProperties;

const resolvedRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  color: "var(--lf-text-secondary)",
  fontSize: 13,
  padding: "8px 0",
} satisfies CSSProperties;

const drawerEyebrowStyle = {
  color: "var(--lf-link)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
} satisfies CSSProperties;

const drawerChoiceStyle = {
  display: "grid",
  gap: 8,
  borderTop: "1px solid var(--lf-divider)",
  borderBottom: "1px solid var(--lf-divider)",
  padding: "12px 0",
} satisfies CSSProperties;

const closeButtonStyle = {
  border: "1px solid var(--lf-border-control)",
  borderRadius: "var(--lf-radius-input)",
  background: "var(--lf-surface-card)",
  color: "var(--lf-text)",
  width: 44,
  height: 44,
  fontSize: 22,
  lineHeight: 1,
  cursor: "pointer",
} satisfies CSSProperties;

const iconWrapStyle = {
  width: 40,
  height: 40,
  borderRadius: 12,
  background: "var(--lf-surface-page)",
  border: "1px solid var(--lf-border)",
  color: "var(--lf-text)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
} satisfies CSSProperties;

const activeBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  border: "1px solid var(--lf-border)",
  background: "var(--lf-surface-card)",
  color: "#5d2d1f",
  fontSize: 11,
  fontWeight: 700,
  padding: "3px 8px",
} satisfies CSSProperties;

const clearBadgeStyle = {
  ...activeBadgeStyle,
  border: "1px solid var(--lf-status-approved-bg)",
  background: "var(--lf-status-approved-bg)",
  color: "var(--lf-status-approved-text)",
} satisfies CSSProperties;

const clearStateStyle = {
  border: "1px solid var(--lf-status-approved-bg)",
  borderRadius: 14,
  background: "var(--lf-status-approved-bg)",
  color: "var(--lf-status-approved-text)",
  padding: 12,
  display: "grid",
  gap: 4,
} satisfies CSSProperties;

const sectionHeaderStyle = {
  display: "grid",
  gap: 8,
} satisfies CSSProperties;

function sectionCardStyle(tone: ActionCentreSection["tone"]): CSSProperties {
  if (tone === "clear") {
    return {
      border: "1px solid var(--lf-status-approved-bg)",
      borderRadius: 12,
      padding: 14,
      display: "grid",
      gap: 8,
      background: "var(--lf-status-approved-bg)",
    };
  }
  if (tone === "alert") {
    return {
      border: "1px solid var(--lf-border)",
      borderRadius: 12,
      padding: 14,
      display: "grid",
      gap: 8,
      background: "var(--lf-surface-card)",
    };
  }
  return {
    border: "1px solid var(--lf-border)",
    borderRadius: 12,
    padding: 14,
    display: "grid",
    gap: 8,
    background: "var(--lf-surface-card)",
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
    border: "1px solid var(--lf-border)",
    background: "#f8f6f4",
    color: "#5f5852",
    padding: "2px 7px",
  };
}

const itemRowStyle = {
  border: "1px solid var(--lf-divider)",
  borderRadius: 10,
  background: "var(--lf-surface-card)",
  padding: "11px 12px",
  display: "grid",
  gap: 10,
} satisfies CSSProperties;

const sectionTitleStyle = {
  color: "var(--lf-text)",
  fontSize: 13,
  fontWeight: 700,
} satisfies CSSProperties;

const sectionSummaryStyle = {
  color: "var(--lf-text-secondary)",
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
      background: "var(--lf-surface-page)",
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
    background: "var(--lf-status-approved-bg)",
    color: "var(--lf-status-approved-text)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };
}

const stageChipStyle = {
  color: "var(--lf-text-secondary)",
  background: "var(--lf-surface-page)",
  border: "1px solid var(--lf-border)",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  padding: "2px 7px",
} satisfies CSSProperties;

const rowCountStyle = {
  color: "var(--lf-text-secondary)",
  fontSize: 11,
  fontWeight: 600,
} satisfies CSSProperties;

const rowTitleStyle = {
  color: "var(--lf-text)",
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.25,
} satisfies CSSProperties;

const rowLabelStyle = {
  color: "var(--lf-text)",
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1.35,
} satisfies CSSProperties;

const rowReasonStyle = {
  color: "var(--lf-text-secondary)",
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
  color: "var(--lf-primary-text)",
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
  background: "var(--lf-surface-card)",
  color: "var(--lf-text)",
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
    Required: { border: "var(--lf-border)", background: "var(--lf-status-pending-bg)", color: "#7c2d12" },
    Recommended: { border: "var(--lf-border)", background: "#f8f6f4", color: "#5f5852" },
    Pending: { border: "var(--lf-border)", background: "var(--lf-surface-subtle)", color: "#1d4ed8" },
    Complete: { border: "var(--lf-status-approved-bg)", background: "var(--lf-status-approved-bg)", color: "var(--lf-status-approved-text)" },
    Failed: { border: "var(--lf-status-rejected-bg)", background: "var(--lf-status-rejected-bg)", color: "var(--lf-status-rejected-text)" },
    "Plan limit reached": { border: "var(--lf-status-pending-bg)", background: "var(--lf-status-pending-bg)", color: "var(--lf-status-pending-text)" },
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
    Critical: { border: "#d6b59b", background: "#2b201b", color: "var(--lf-primary-text)" },
    High: { border: "var(--lf-status-pending-bg)", background: "var(--lf-status-pending-bg)", color: "var(--lf-status-pending-text)" },
    Medium: { border: "var(--lf-border)", background: "#f8f6f4", color: "#5f5852" },
    Low: { border: "var(--lf-border)", background: "var(--lf-surface-page)", color: "var(--lf-text-secondary)" },
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
