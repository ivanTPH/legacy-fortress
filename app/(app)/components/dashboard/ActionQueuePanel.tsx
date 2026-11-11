"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { BlockingItem } from "../../../../lib/workflow/blockingModel";
import type { GuidanceAction, GuidanceItem } from "../../../../lib/readiness/guidance";
import type { VaultApplicabilityState } from "../../../../lib/vaultPreferences";
import { countOpenNeedsYou, getVaultTaskGroup } from "../../../../lib/workflow/taskGroups";
import Icon from "../../../../components/ui/Icon";
import SwipeRow from "../../../../components/inbox/SwipeRow";
import NamedPeoplePanel from "../../../../components/inbox/NamedPeoplePanel";
import { actionReadKey, laterKeysNow, publishNeedsYouCountForCurrentUser, useInboxLater, useInboxReads, useInboxUpdates } from "../../../../lib/notifications/inboxUpdates";

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

// Inbox (owner decisions 10–11 Nov 2026), built to work like Apple Mail.
// - Categories: All / Needs you / Waiting / Updates. The badge counts only what needs the person.
// - One tap goes straight to the thing. Only your own tasks and the Will question open first, so a tap never
//   completes anything by accident.
// - Swipe right: Read/Unread and Later. Swipe left: Later and Done (Clear for updates). Long swipe left: Done.
//   Press and hold: quick actions. On a laptop the same buttons appear on hover. Select ticks several at once.
// - A filled dot is new, an outline has been read. Orange: needs you. Grey: waiting. Blue: update. Each row also
//   says which in words. Later brings an item back as new on the chosen date.
type InboxCategory = "all" | "needs" | "waiting" | "update";
type InboxKind = Exclude<InboxCategory, "all">;
type InboxFinish = { label: "Done" | "Clear" | "Doesn’t apply"; run: () => void; message: string; undo?: () => void } | null;
type InboxEntry = {
  key: string;
  kind: InboxKind;
  /** A suggestion rather than something that must be done: listed under Needs you, but not in the badge. */
  suggested?: boolean;
  title: string;
  sub: string;
  when: string;
  person: string | null;
  icon: string;
  isNew: boolean;
  count: number;
  readKeys: string[];
  open: () => void;
  finish: InboxFinish;
  extraNotRelevant?: () => void;
};

function inboxTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const age = Date.now() - date.getTime();
  if (age < 60_000) return "Just now";
  if (age < 86_400_000 && date.getDate() === new Date().getDate()) return new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit" }).format(date);
  if (age < 2 * 86_400_000) return "Yesterday";
  if (age < 7 * 86_400_000) return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(date);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}

function initials(name: string | null) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return `${parts[0][0] ?? ""}${parts.length > 1 ? parts[parts.length - 1][0] ?? "" : ""}`.toUpperCase();
}

function laterDate(choice: "tomorrow" | "week" | string) {
  const date = new Date();
  if (choice === "tomorrow") { date.setDate(date.getDate() + 1); date.setHours(8, 0, 0, 0); return date; }
  if (choice === "week") { date.setDate(date.getDate() + ((8 - date.getDay()) % 7 || 7)); date.setHours(8, 0, 0, 0); return date; }
  const picked = new Date(`${choice}T08:00:00`);
  return Number.isNaN(picked.getTime()) ? null : picked;
}

/** Will and Power of Attorney people steps are decided in the Inbox itself (owner, 11 Nov 2026). */
const NAMED_PEOPLE_STEPS: Record<string, "will" | "poa"> = {
  review_executors: "will", invite_executors: "will", remind_executors: "will",
  review_attorneys: "poa", invite_attorneys: "poa", remind_attorneys: "poa",
};

function ActionCentreInbox({ items, onAction, context, guidanceItems, onGuidanceDecision, onGuidanceApplicability, guidanceBusyKey }: ActionQueuePanelProps) {
  const rows = useMemo(
    () => getActiveActionRows(items, context ? { ...context, guidanceItems } : undefined),
    [context, guidanceItems, items],
  );
  const reads = useInboxReads();
  const { updates, loading: updatesLoading, markRead, markUnread, clear, restore } = useInboxUpdates(true, reads);
  const later = useInboxLater();
  const [category, setCategory] = useState<InboxCategory>("all");
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [swiped, setSwiped] = useState<{ key: string; side: "left" | "right" } | null>(null);
  const [sheet, setSheet] = useState<{ type: "later" | "menu"; keys: string[] } | null>(null);
  const [pickDate, setPickDate] = useState("");
  const [minDate] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [willChoice, setWillChoice] = useState<"yes" | "no" | "unsure" | null>(null);
  const [peopleChanged, setPeopleChanged] = useState(false);
  const requestedActionHandled = useRef(false);

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("filter");
    if (wanted === "updates") queueMicrotask(() => setCategory("update"));
    if (wanted === "todo" || wanted === "actions") queueMicrotask(() => setCategory("needs"));
  }, []);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("action");
    if (requested && !requestedActionHandled.current && rows.some((row) => row.actionKey === requested)) {
      requestedActionHandled.current = true;
      queueMicrotask(() => setOpened(`action:${requested}`));
    }
  }, [rows]);

  useEffect(() => {
    if (!sheet && !opened) return;
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") { setSheet(null); setOpened(null); } }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet, opened]);

  const say = useCallback((text: string, undo?: () => void) => {
    setToast({ text, undo });
    window.setTimeout(() => setToast((current) => (current?.text === text ? null : current)), 6000);
  }, []);

  const entries = useMemo<InboxEntry[]>(() => {
    const actionEntries = rows.map((row): InboxEntry => {
      const key = `action:${row.actionKey}`;
      const group = actionGroup(row);
      const guidance = row.guidanceItem;
      const ownTask = row.actionKey.startsWith("task:complete:");
      const opensFirst = ownTask || Boolean(guidance && NAMED_PEOPLE_STEPS[String(guidance.key)])
        || (guidance?.key === "will" && guidance.state === "unknown" && Boolean(onGuidanceApplicability));
      const finish: InboxFinish = guidance && onGuidanceDecision
        ? { label: "Done", run: () => onGuidanceDecision(guidance, "already_done"), message: "Marked as done" }
        : ownTask ? { label: "Done", run: () => onAction(row.actionKey), message: "Marked as done" } : null;
      return {
        key, kind: group === "waiting" ? "waiting" : "needs", suggested: group === "suggested", title: row.title, sub: row.blockerLabel, when: "", person: null,
        icon: taskIcon(row), isNew: !reads.read.includes(actionReadKey(row.actionKey)), count: 1, readKeys: [actionReadKey(row.actionKey)],
        open: () => { reads.markRead([actionReadKey(row.actionKey)]); if (opensFirst) setOpened(key); else onAction(row.actionKey); },
        finish,
        extraNotRelevant: guidance && onGuidanceDecision ? () => onGuidanceDecision(guidance, "not_relevant") : undefined,
      };
    });
    // Repeats of the same update (three "Invite sent to Jacqui") show once, with a count.
    const grouped = new Map<string, typeof updates>();
    for (const update of updates) {
      const list = grouped.get(update.title) ?? [];
      list.push(update);
      grouped.set(update.title, list);
    }
    const updateEntries = [...grouped.values()].map((list): InboxEntry => {
      const latest = list[0];
      const ids = list.map((item) => item.id);
      return {
        key: `update:${latest.id}`, kind: "update", title: latest.title,
        sub: list.length > 1 ? `${latest.detail} Sent ${list.length} times, most recently ${inboxTime(latest.createdAt)}.` : latest.detail,
        when: latest.createdAt, person: latest.person ?? null, icon: "notifications", isNew: list.some((item) => !item.read), count: list.length, readKeys: ids,
        open: () => { markRead(ids); window.location.assign(latest.href); },
        finish: { label: "Clear", run: () => clear(ids), message: list.length > 1 ? `${list.length} updates cleared` : "Update cleared", undo: () => restore(ids) },
      };
    });
    return [...actionEntries, ...updateEntries].filter((entry) => !later.isLater(entry.key));
  }, [rows, updates, reads, later, onAction, onGuidanceDecision, onGuidanceApplicability, markRead, clear, restore]);

  const count = (kind: InboxCategory) => entries.filter((entry) => kind === "all" || entry.kind === kind).length;
  const shown = entries.filter((entry) => category === "all" || entry.kind === category);
  // The same number as the Inbox badge: things that must be done, not suggestions (release C rule).
  const needs = entries.filter((entry) => entry.kind === "needs" && !entry.suggested).length;
  const newCount = entries.filter((entry) => entry.isNew).length;
  useEffect(() => { void publishNeedsYouCountForCurrentUser(needs); }, [needs]);
  const byKey = (key: string) => entries.find((entry) => entry.key === key);
  const openedRow = opened?.startsWith("action:") ? rows.find((row) => `action:${row.actionKey}` === opened) ?? null : null;

  function setRead(entry: InboxEntry, read: boolean) {
    if (read) { if (entry.kind === "update") markRead(entry.readKeys); else reads.markRead(entry.readKeys); }
    else entry.readKeys.forEach((key) => (entry.kind === "update" ? markUnread(key) : reads.markUnread(key)));
  }
  function finishEntries(keys: string[]) {
    const chosen = keys.map(byKey).filter((entry): entry is InboxEntry => Boolean(entry));
    const doable = chosen.filter((entry) => entry.finish);
    doable.forEach((entry) => entry.finish!.run());
    setSwiped(null); setSheet(null); setSelecting(false); setPicked([]);
    const skipped = chosen.length - doable.length;
    if (!doable.length) { say(skipped === 1 ? "That one needs opening first" : "Those need opening first"); return; }
    const undos = doable.map((entry) => entry.finish!.undo).filter((fn): fn is () => void => Boolean(fn));
    const text = doable.length === 1 ? doable[0].finish!.message : `${doable.length} done or cleared`;
    say(skipped ? `${text} · ${skipped} need${skipped === 1 ? "s" : ""} opening` : text, undos.length === doable.length ? () => undos.forEach((fn) => fn()) : undefined);
  }
  function laterEntries(keys: string[], choice: string) {
    const until = laterDate(choice);
    if (!until) return;
    const chosen = keys.map(byKey).filter((entry): entry is InboxEntry => Boolean(entry));
    chosen.forEach((entry) => setRead(entry, false)); // comes back as new
    later.snooze(keys, until);
    setSheet(null); setSwiped(null); setSelecting(false); setPicked([]); setPickDate("");
    const when = choice === "tomorrow" ? "tomorrow morning" : choice === "week" ? "next week" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(until);
    say(`Back ${when}`, () => later.wake(keys));
  }

  const swipeButtons = (entry: InboxEntry, side: "left" | "right") => side === "right" ? <>
    <button type="button" className="lf-swipe-button is-read" onClick={() => { setRead(entry, entry.isNew); setSwiped(null); }}><Icon name={entry.isNew ? "drafts" : "mark_email_unread"} size={20} />{entry.isNew ? "Read" : "Unread"}</button>
    <button type="button" className="lf-swipe-button is-later" onClick={() => setSheet({ type: "later", keys: [entry.key] })}><Icon name="schedule" size={20} />Later</button>
  </> : <>
    <button type="button" className="lf-swipe-button is-later" onClick={() => setSheet({ type: "later", keys: [entry.key] })}><Icon name="schedule" size={20} />Later</button>
    {entry.finish ? <button type="button" className={`lf-swipe-button ${entry.kind === "update" ? "is-clear" : "is-done"}`} onClick={() => finishEntries([entry.key])}><Icon name={entry.kind === "update" ? "clear_all" : "check_circle"} size={20} />{entry.finish.label}</button> : null}
  </>;

  const menuEntry = sheet?.type === "menu" ? byKey(sheet.keys[0]) : undefined;
  const tag = (kind: InboxKind) => kind === "needs" ? "Needs you" : kind === "waiting" ? "Waiting" : "Update";

  return (
    <section id="action-centre" className="lf-action-centre lf-inbox" style={panelStyle} aria-label="Inbox">
      <div className="lf-inbox-head">
        {selecting ? <p className="lf-inbox-subtitle"><strong>{picked.length} selected</strong> · tap rows to choose</p> : <p className="lf-inbox-subtitle">{needs} {needs === 1 ? "needs" : "need"} you · {newCount} new</p>}
        <span className="lf-inbox-head-actions">
          {!selecting && newCount ? <button type="button" className="lf-inbox-quiet" onClick={() => { entries.forEach((entry) => setRead(entry, true)); }}>Mark all as read</button> : null}
          <button type="button" className="lf-inbox-pill-button" onClick={() => { setSelecting(!selecting); setPicked([]); setSwiped(null); }}>{selecting ? "Cancel" : "Select"}</button>
        </span>
      </div>
      <div className="lf-inbox-categories" role="group" aria-label="Show">
        {([["all", "All", "inbox"], ["needs", "Needs you", "priority_high"], ["waiting", "Waiting", "hourglass_top"], ["update", "Updates", "notifications"]] as const).map(([key, label, icon]) => (
          <button key={key} type="button" className={`lf-inbox-category is-${key}`} aria-pressed={category === key} aria-label={`${label}, ${count(key)}`} onClick={() => setCategory(key)}>
            <Icon name={icon} size={20} />{category === key ? <span>{label} {count(key)}</span> : null}
          </button>
        ))}
      </div>
      {!entries.length && !updatesLoading ? <section style={clearStateStyle}><strong>You’re all caught up.</strong><span>Things to do and updates about your Vault will appear here.</span></section> : null}
      {entries.length && !shown.length && !updatesLoading ? <p className="lf-inbox-empty">{category === "update" ? "No updates yet. When someone accepts an invitation or something changes in your Vault, it will appear here." : category === "waiting" ? "Nothing waiting on anyone else." : "Nothing needs you right now."}</p> : null}
      <div className="lf-inbox-list" role="list">
        {shown.map((entry) => {
          const isPicked = picked.includes(entry.key);
          const who = initials(entry.person);
          return <div key={entry.key} role="listitem" className={`lf-inbox-row is-${entry.kind}${isPicked ? " is-picked" : ""}`}>
            <SwipeRow
              open={swiped?.key === entry.key ? swiped.side : null}
              onOpenChange={(side) => setSwiped(side ? { key: entry.key, side } : null)}
              left={swipeButtons(entry, "left")}
              right={swipeButtons(entry, "right")}
              onLongLeft={entry.finish ? () => finishEntries([entry.key]) : undefined}
              onHold={selecting ? undefined : () => setSheet({ type: "menu", keys: [entry.key] })}
            >
              <button type="button" className="lf-inbox-row-button" aria-label={`${entry.suggested ? "Suggested" : tag(entry.kind)}${entry.isNew ? ", new" : ""}: ${entry.title}${entry.count > 1 ? `, ${entry.count} times` : ""}. ${selecting ? (isPicked ? "Selected" : "Select") : "Open"}`}
                onClick={() => {
                  if (selecting) { setPicked((current) => current.includes(entry.key) ? current.filter((key) => key !== entry.key) : [...current, entry.key]); return; }
                  if (swiped) { setSwiped(null); return; }
                  entry.open();
                }}>
                {selecting ? <span className="lf-inbox-check" aria-hidden="true">{isPicked ? <Icon name="check" size={16} /> : null}</span> : null}
                <span className={`lf-inbox-dot is-${entry.kind}${entry.isNew ? " is-new" : ""}`} aria-hidden="true" />
                <span className={`lf-inbox-pic${who ? " is-person" : ""}`} aria-hidden="true">{who || <Icon name={entry.icon} size={20} />}</span>
                <span className="lf-inbox-row-copy">
                  <span className="lf-inbox-row-top"><strong className={entry.isNew ? "is-new" : undefined}>{entry.title}{entry.count > 1 ? <span className="lf-inbox-count">{entry.count}</span> : null}</strong>{entry.when ? <time dateTime={entry.when}>{inboxTime(entry.when)}</time> : null}</span>
                  <small>{entry.sub}</small>
                  <span className={`lf-inbox-tag is-${entry.kind}`}>{entry.suggested ? "Suggested" : tag(entry.kind)}</span>
                </span>
              </button>
              {!selecting ? <span className="lf-inbox-hover" aria-hidden="false">
                <button type="button" onClick={() => setRead(entry, entry.isNew)}>{entry.isNew ? "Read" : "Unread"}</button>
                <button type="button" onClick={() => setSheet({ type: "later", keys: [entry.key] })}>Later</button>
                {entry.finish ? <button type="button" onClick={() => finishEntries([entry.key])}>{entry.finish.label}</button> : null}
              </span> : null}
            </SwipeRow>
          </div>;
        })}
      </div>
      {shown.length ? <p className="lf-notifications-hint">Tap to open. On a phone, swipe right to mark read or for Later, swipe left for Done, or press and hold for more.</p> : null}
      {updatesLoading && category !== "needs" && category !== "waiting" ? <p className="lf-notifications-hint">Loading updates…</p> : null}

      {selecting ? <div className="lf-inbox-selectbar" role="toolbar" aria-label="Selected items">
        <button type="button" disabled={!picked.length} onClick={() => { picked.map(byKey).forEach((entry) => entry && setRead(entry, true)); setSelecting(false); setPicked([]); }}><Icon name="drafts" size={20} />Mark read</button>
        <button type="button" disabled={!picked.length} onClick={() => setSheet({ type: "later", keys: picked })}><Icon name="schedule" size={20} />Later</button>
        <button type="button" disabled={!picked.length} onClick={() => finishEntries(picked)}><Icon name="check_circle" size={20} />Done / Clear</button>
      </div> : null}

      {toast ? <div className="lf-inbox-toast" role="status">{toast.text}{toast.undo ? <button type="button" onClick={() => { toast.undo!(); setToast(null); }}>Undo</button> : null}</div> : null}

      {sheet?.type === "later" ? (
        <div className="lf-inbox-sheet-backdrop" role="presentation" onClick={() => setSheet(null)}>
          <section className="lf-inbox-sheet" role="dialog" aria-modal="true" aria-labelledby="inbox-later-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="inbox-later-title">Bring {sheet.keys.length > 1 ? `these ${sheet.keys.length}` : "this"} back…</h2>
            <button type="button" onClick={() => laterEntries(sheet.keys, "tomorrow")}><Icon name="wb_sunny" size={22} />Tomorrow morning</button>
            <button type="button" onClick={() => laterEntries(sheet.keys, "week")}><Icon name="date_range" size={22} />Next week</button>
            <label className="lf-inbox-sheet-date"><Icon name="calendar_month" size={22} /><span>Pick a date</span><input type="date" value={pickDate} min={minDate} onChange={(event) => setPickDate(event.target.value)} /></label>
            {pickDate ? <button type="button" className="is-primary" onClick={() => laterEntries(sheet.keys, pickDate)}>Bring back on {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(new Date(`${pickDate}T08:00:00`))}</button> : null}
            <button type="button" className="is-cancel" onClick={() => setSheet(null)}>Cancel</button>
          </section>
        </div>
      ) : null}

      {sheet?.type === "menu" && menuEntry ? (
        <div className="lf-inbox-sheet-backdrop" role="presentation" onClick={() => setSheet(null)}>
          <section className="lf-inbox-sheet" role="menu" aria-label={`Quick actions for ${menuEntry.title}`} onClick={(event) => event.stopPropagation()}>
            <h2>{menuEntry.title}</h2>
            <button type="button" role="menuitem" onClick={() => { setSheet(null); menuEntry.open(); }}><Icon name="open_in_new" size={22} />Open</button>
            <button type="button" role="menuitem" onClick={() => { setRead(menuEntry, menuEntry.isNew); setSheet(null); }}><Icon name={menuEntry.isNew ? "drafts" : "mark_email_unread"} size={22} />{menuEntry.isNew ? "Mark as read" : "Mark as unread"}</button>
            <button type="button" role="menuitem" onClick={() => setSheet({ type: "later", keys: [menuEntry.key] })}><Icon name="schedule" size={22} />Later</button>
            {menuEntry.finish ? <button type="button" role="menuitem" onClick={() => finishEntries([menuEntry.key])}><Icon name={menuEntry.kind === "update" ? "clear_all" : "check_circle"} size={22} />{menuEntry.finish.label === "Done" ? "Mark as done" : menuEntry.finish.label}</button> : null}
            {menuEntry.extraNotRelevant ? <button type="button" role="menuitem" onClick={() => { menuEntry.extraNotRelevant!(); setSheet(null); say("Removed. It won’t come back."); }}><Icon name="block" size={22} />This doesn’t apply to me</button> : null}
            <button type="button" className="is-cancel" onClick={() => setSheet(null)}>Cancel</button>
          </section>
        </div>
      ) : null}

      {openedRow ? (
        <div className="lf-action-centre-drawer-backdrop" role="presentation" onClick={() => setOpened(null)}>
          <section className="lf-action-centre-drawer lf-inbox-message" role="dialog" aria-modal="true" aria-labelledby="inbox-message-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="lf-inbox-back" onClick={() => setOpened(null)}><Icon name="arrow_back" size={20} />Inbox</button>
            <span className={`lf-inbox-tag is-${actionGroup(openedRow) === "waiting" ? "waiting" : "needs"}`}>{actionGroup(openedRow) === "waiting" ? "Waiting" : "Needs you"}</span>
            <h2 id="inbox-message-title">{openedRow.title}</h2>
            <p className="lf-inbox-message-body">{openedRow.whyItMatters}</p>
            {openedRow.guidanceItem && NAMED_PEOPLE_STEPS[String(openedRow.guidanceItem.key)] ? (
              <>
                <NamedPeoplePanel doc={NAMED_PEOPLE_STEPS[String(openedRow.guidanceItem.key)]} onChanged={() => setPeopleChanged(true)} />
                {/* The step clears itself once everyone is added and invited; closing refreshes the Inbox if anything changed. */}
                <button type="button" className="lf-inbox-primary" onClick={() => { setOpened(null); if (peopleChanged) window.location.reload(); }}>Done</button>
              </>
            ) : openedRow.guidanceItem?.key === "will" && openedRow.guidanceItem.state === "unknown" && onGuidanceApplicability ? (
              <div style={drawerChoiceStyle}>
                <fieldset className="lf-action-will-choices">
                  <legend>Have you already made a Will?</legend>
                  {([["yes", "Yes, I have a Will"], ["no", "No, I don’t have one"], ["unsure", "I’m not sure"]] as const).map(([value, label]) => (
                    <label key={value}><input type="radio" name="will-applicability" value={value} checked={willChoice === value} onChange={() => setWillChoice(value)} />{label}</label>
                  ))}
                </fieldset>
                <button type="button" style={primaryActionStyle} disabled={!willChoice || guidanceBusyKey === openedRow.guidanceItem.key} onClick={() => {
                  if (!willChoice) return;
                  void Promise.resolve(onGuidanceApplicability(openedRow.guidanceItem!, willChoice)).then((saved) => { if (saved) setOpened(null); });
                }}>Save choice</button>
              </div>
            ) : openedRow.actionKey.startsWith("task:complete:") ? (
              <button type="button" className="lf-inbox-primary" onClick={() => { onAction(openedRow.actionKey); setOpened(null); say("Marked as done"); }}>Mark as done</button>
            ) : (
              <button type="button" className="lf-inbox-primary" onClick={() => onAction(openedRow.actionKey)}>{openedRow.primaryActionLabel}</button>
            )}
            <div className="lf-inbox-message-actions">
              <button type="button" className="lf-inbox-secondary" onClick={() => { setOpened(null); setSheet({ type: "later", keys: [`action:${openedRow.actionKey}`] }); }}>Later</button>
              <button type="button" className="lf-inbox-secondary" onClick={() => { reads.markUnread(actionReadKey(openedRow.actionKey)); setOpened(null); }}>Mark as unread</button>
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
  // Same rule as the Inbox's "N need you": must-do items, not suggestions, and not anything put off with Later.
  const later = laterKeysNow();
  return countOpenNeedsYou(getActiveActionRows(items, context ? { ...context, guidanceItems } : undefined)
    .filter((row) => !later.has(`action:${row.actionKey}`)));
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
  if (type === "system_generated") return "Suggested for you";
  if (type === "reminder") return "Reminder";
  return "Your task";
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
