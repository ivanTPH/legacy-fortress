"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { waitForActiveUser } from "../auth/session";
import { describeInvitationEvent } from "./invitationEvents";
import { describePersonNotification, loadPersonNotifications, markPersonNotificationsRead } from "./personNotifications";
import { loadSuggestionRecordLabels, titleWithRecord } from "./suggestionContext";
import { clearNotificationIds, loadClearedNotificationIds, restoreNotificationIds, syncClearedNotificationIds } from "./cleared";

/**
 * Updates for the Inbox (owner decision 10 Nov 2026): the notifications that used to sit behind the bell now share
 * one list with things to do. Updates are news ("Sarah accepted your invitation"): read, then cleared, like Mail.
 * The same sources, read state and cross-device clearing as before; nothing here changes the events themselves.
 */
/** person: who the update is about (for the initials on the row), when known. */
export type InboxUpdate = { id: string; title: string; detail: string; href: string; createdAt: string; read: boolean; person?: string | null };

type EventRow = { id: string; event_type: string; created_at: string; payload?: Record<string, unknown> | null; contact_invitations?: { contact_name?: string | null } | null };

/**
 * What the person has read in the Inbox, for actions ("action:<key>") and updates (their id). It follows them across
 * devices through public.inbox_reads (their own rows only); this device keeps a copy so the dots don't flicker and
 * still work if the server is unavailable or the table isn't there yet. Reading never completes or clears anything.
 */
const READ_KEY = "lf:inbox:read";
const LEGACY_KEYS = ["lf:notification-events:read", "lf:inbox:seen-actions"];

function readList(key: string): string[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function loadLocalRead(): string[] {
  const legacyActions = readList("lf:inbox:seen-actions").map((key) => `action:${key}`);
  return Array.from(new Set([...readList(READ_KEY), ...readList("lf:notification-events:read"), ...legacyActions]));
}

function saveLocalRead(ids: string[]) {
  const next = Array.from(new Set(ids)).slice(-1000);
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify(next));
    for (const key of LEGACY_KEYS) window.localStorage.removeItem(key);
  } catch { /* this device's copy is optional */ }
  return next;
}

async function currentUserId() {
  try { return (await supabase.auth.getUser()).data.user?.id ?? null; } catch { return null; }
}

/**
 * The server is the truth; this device keeps a short queue of changes it hasn't managed to save yet (a page closed
 * mid-save, no signal). Each sync sends the queue first, then takes the server's list as it is, so marking something
 * unread on one device isn't undone by another device's old copy.
 */
const PENDING_KEY = "lf:inbox:read-pending";
type Pending = { add: string[]; remove: string[]; legacyMoved?: boolean };

function loadPending(): Pending {
  try {
    const stored = JSON.parse(window.localStorage.getItem(PENDING_KEY) ?? "{}") as Partial<Pending>;
    return { add: Array.isArray(stored.add) ? stored.add : [], remove: Array.isArray(stored.remove) ? stored.remove : [], legacyMoved: Boolean(stored.legacyMoved) };
  } catch {
    return { add: [], remove: [] };
  }
}

function savePending(pending: Pending) {
  try { window.localStorage.setItem(PENDING_KEY, JSON.stringify({ ...pending, add: pending.add.slice(-500), remove: pending.remove.slice(-500) })); } catch { /* optional */ }
}

function queue(kind: "add" | "remove", keys: string[]) {
  const pending = loadPending();
  const other = kind === "add" ? "remove" : "add";
  pending[other] = pending[other].filter((key) => !keys.includes(key));
  pending[kind] = Array.from(new Set([...pending[kind], ...keys]));
  savePending(pending);
}

async function flushPending(userId: string) {
  const pending = loadPending();
  let ok = true;
  const add = pending.add.filter((key) => key && key.length <= 200);
  if (add.length) {
    const { error } = await supabase.from("inbox_reads").upsert(add.map((item_key) => ({ user_id: userId, item_key })), { onConflict: "user_id,item_key", ignoreDuplicates: true });
    if (error) ok = false; else pending.add = pending.add.filter((key) => !add.includes(key));
  }
  if (pending.remove.length) {
    const { error } = await supabase.from("inbox_reads").delete().eq("user_id", userId).in("item_key", pending.remove);
    if (error) ok = false; else pending.remove = [];
  }
  savePending(pending);
  return ok;
}

async function sendQueued() {
  const userId = await currentUserId();
  if (!userId) return;
  try { await flushPending(userId); } catch { /* stays queued on this device */ }
}

/** Save what's queued, then take the server's list as the truth (keeping anything still waiting to be saved). */
async function syncReads(): Promise<string[]> {
  const local = loadLocalRead();
  const userId = await currentUserId();
  if (!userId) return local;
  try {
    const pending = loadPending();
    if (!pending.legacyMoved) {
      // First sync on this device: what it remembered before syncing existed is saved once, then never re-added.
      pending.add = Array.from(new Set([...pending.add, ...local]));
      pending.legacyMoved = true;
      savePending(pending);
    }
    await flushPending(userId);
    const { data, error } = await supabase.from("inbox_reads").select("item_key").order("read_at", { ascending: false }).limit(1000);
    if (error) return local;
    const remote = ((data ?? []) as Array<{ item_key: string }>).map((row) => String(row.item_key)).filter((key) => !key.startsWith(LATER_PREFIX));
    const still = loadPending();
    return saveLocalRead([...remote.filter((key) => !still.remove.includes(key)), ...still.add]);
  } catch {
    return local;
  }
}

export function useInboxReads() {
  const [read, setRead] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setRead(loadLocalRead()); });
    void syncReads().then((ids) => { if (!cancelled) setRead(ids); });
    return () => { cancelled = true; };
  }, []);
  const markRead = useCallback((keys: string[]) => {
    if (!keys.length) return;
    queue("add", keys);
    void sendQueued();
    setRead((current) => saveLocalRead([...current, ...keys]));
  }, []);
  const markUnread = useCallback((key: string) => {
    queue("remove", [key]);
    void sendQueued();
    setRead((current) => saveLocalRead(current.filter((item) => item !== key)));
  }, []);
  return { read, markRead, markUnread };
}

/** Updates, read and cleared through the shared Inbox read state (pass the result of useInboxReads). */
export function useInboxUpdates(enabled: boolean, reads: ReturnType<typeof useInboxReads>) {
  const [updates, setUpdates] = useState<Omit<InboxUpdate, "read">[]>([]);
  const [personIds, setPersonIds] = useState<string[]>([]);
  const [cleared, setCleared] = useState<string[]>([]);
  const [loading, setLoading] = useState(enabled);
  const { read, markRead: markReadKeys, markUnread: markUnreadKey } = reads;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setCleared(loadClearedNotificationIds()); });
    void syncClearedNotificationIds(supabase).then((ids) => { if (!cancelled) setCleared(ids); });
    void (async () => {
      const user = await waitForActiveUser(supabase, { attempts: 3, delayMs: 100 });
      if (!user) { if (!cancelled) setLoading(false); return; }
      const [result, personal] = await Promise.all([
        supabase.from("invitation_events").select("id,event_type,created_at,payload,contact_invitations(contact_name)").eq("owner_user_id", user.id).order("created_at", { ascending: false }).limit(50),
        loadPersonNotifications(supabase),
      ]);
      const labels = await loadSuggestionRecordLabels(supabase, personal.map((item) => ({ kind: item.kind, link: item.link }))).catch(() => ({} as Record<string, string>));
      if (cancelled) return;
      const invitationUpdates = ((result.data ?? []) as EventRow[]).map((event) => {
        const copy = describeInvitationEvent(event.event_type, event.payload ?? null, event.contact_invitations?.contact_name ?? null);
        return { id: event.id, title: copy.title, detail: copy.detail, href: copy.kind === "access" ? "/access-sharing" : "/people-access?view=people", createdAt: event.created_at, person: event.contact_invitations?.contact_name ?? null };
      });
      const personUpdates = personal.map((item) => {
        const copy = describePersonNotification(item.kind, item.ownerName ?? null);
        return { id: item.id, title: titleWithRecord(item.kind, copy.title, item.link, labels), detail: copy.detail, href: item.link ?? "/actions", createdAt: item.createdAt, person: item.ownerName ?? null };
      });
      setPersonIds(personal.map((item) => item.id));
      // Person notifications already carry their own read mark; fold those in so every device agrees.
      const alreadyRead = personal.filter((item) => item.readAt).map((item) => item.id);
      if (alreadyRead.length) markReadKeys(alreadyRead);
      setUpdates([...invitationUpdates, ...personUpdates].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [enabled, markReadKeys]);

  const markRead = useCallback((ids: string[]) => {
    if (!ids.length) return;
    void markPersonNotificationsRead(supabase, ids.filter((id) => personIds.includes(id)));
    markReadKeys(ids);
  }, [markReadKeys, personIds]);

  const markUnread = useCallback((id: string) => markUnreadKey(id), [markUnreadKey]);

  const clear = useCallback((ids: string[]) => {
    if (!ids.length) return;
    void markPersonNotificationsRead(supabase, ids.filter((id) => personIds.includes(id)));
    markReadKeys(ids);
    setCleared((current) => clearNotificationIds(supabase, current, ids));
  }, [markReadKeys, personIds]);

  const restore = useCallback((ids: string[]) => {
    setCleared((current) => restoreNotificationIds(supabase, current, ids));
  }, []);

  const visible: InboxUpdate[] = updates.filter((item) => !cleared.includes(item.id)).map((item) => ({ ...item, read: read.includes(item.id) }));
  return { updates: visible, loading, markRead, markUnread, clear, restore };
}

/** The read-state key for an action. Opening an action only marks it read; it never completes it. */
export const actionReadKey = (actionKey: string) => `action:${actionKey}`;

/**
 * Later (owner decision 11 Nov 2026, like Mail's Remind Me): hide an Inbox item until a chosen date, when it comes
 * back as new. Kept in the person's own inbox_reads rows as "later:<item>" with the date it returns, so it follows
 * them across devices without a new table; this device keeps a copy. Nothing about the item itself changes.
 */
export const LATER_PREFIX = "later:";
const LATER_KEY = "lf:inbox:later";

function loadLaterLocal(): Record<string, string> {
  try {
    const stored = JSON.parse(window.localStorage.getItem(LATER_KEY) ?? "{}");
    return stored && typeof stored === "object" ? stored as Record<string, string> : {};
  } catch {
    return {};
  }
}

function saveLaterLocal(map: Record<string, string>) {
  const now = Date.now();
  const live = Object.fromEntries(Object.entries(map).filter(([, until]) => Date.parse(until) > now));
  try { window.localStorage.setItem(LATER_KEY, JSON.stringify(live)); } catch { /* optional */ }
  return live;
}

export function useInboxLater() {
  const [later, setLater] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setLater(saveLaterLocal(loadLaterLocal())); });
    void (async () => {
      try {
        const { data, error } = await supabase.from("inbox_reads").select("item_key,read_at").like("item_key", `${LATER_PREFIX}%`).limit(500);
        if (error || cancelled) return;
        const merged = { ...loadLaterLocal() };
        for (const row of (data ?? []) as Array<{ item_key: string; read_at: string }>) {
          const key = row.item_key.slice(LATER_PREFIX.length);
          if (!merged[key] || Date.parse(row.read_at) > Date.parse(merged[key])) merged[key] = row.read_at;
        }
        if (!cancelled) setLater(saveLaterLocal(merged));
      } catch { /* this device's copy still works */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const snooze = useCallback((keys: string[], until: Date) => {
    if (!keys.length) return;
    const iso = until.toISOString();
    setLater((current) => saveLaterLocal({ ...current, ...Object.fromEntries(keys.map((key) => [key, iso])) }));
    void (async () => {
      const userId = await currentUserId();
      if (!userId) return;
      const itemKeys = keys.map((key) => `${LATER_PREFIX}${key}`).filter((key) => key.length <= 200);
      try {
        // No updates on this table: replace the row.
        await supabase.from("inbox_reads").delete().eq("user_id", userId).in("item_key", itemKeys);
        await supabase.from("inbox_reads").insert(itemKeys.map((item_key) => ({ user_id: userId, item_key, read_at: iso })));
      } catch { /* this device still remembers */ }
    })();
  }, []);

  const wake = useCallback((keys: string[]) => {
    if (!keys.length) return;
    setLater((current) => saveLaterLocal(Object.fromEntries(Object.entries(current).filter(([key]) => !keys.includes(key)))));
    void (async () => {
      const userId = await currentUserId();
      if (!userId) return;
      try { await supabase.from("inbox_reads").delete().eq("user_id", userId).in("item_key", keys.map((key) => `${LATER_PREFIX}${key}`)); } catch { /* optional */ }
    })();
  }, []);

  const isLater = useCallback((key: string) => Boolean(later[key] && Date.parse(later[key]) > Date.now()), [later]);
  return { later, isLater, snooze, wake };
}


/**
 * Archive (owner decision 11 Nov 2026, like Mail): moves an Inbox item out of the list without completing it, into
 * Archived, where it can be found and moved back. Kept in the person's own inbox_reads rows as "archive:<item>", so it
 * follows them across devices without a new table; this device keeps a copy. Nothing about the item itself changes.
 */
export const ARCHIVE_PREFIX = "archive:";
const ARCHIVE_KEY = "lf:inbox:archive";

function loadArchiveLocal(): string[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(ARCHIVE_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function saveArchiveLocal(keys: string[]) {
  const unique = [...new Set(keys)].slice(-1000);
  try { window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(unique)); } catch { /* optional */ }
  return unique;
}

export function useInboxArchive() {
  const [archived, setArchived] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setArchived(loadArchiveLocal()); });
    void (async () => {
      try {
        const { data, error } = await supabase.from("inbox_reads").select("item_key").like("item_key", `${ARCHIVE_PREFIX}%`).limit(1000);
        if (error || cancelled) return;
        const server = ((data ?? []) as Array<{ item_key: string }>).map((row) => row.item_key.slice(ARCHIVE_PREFIX.length));
        if (!cancelled) setArchived(saveArchiveLocal([...loadArchiveLocal(), ...server]));
      } catch { /* this device's copy still works */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const archive = useCallback((keys: string[]) => {
    if (!keys.length) return;
    setArchived((current) => saveArchiveLocal([...current, ...keys]));
    void (async () => {
      const userId = await currentUserId();
      if (!userId) return;
      const itemKeys = keys.map((key) => `${ARCHIVE_PREFIX}${key}`).filter((key) => key.length <= 200);
      try {
        await supabase.from("inbox_reads").upsert(itemKeys.map((item_key) => ({ user_id: userId, item_key })), { onConflict: "user_id,item_key", ignoreDuplicates: true });
      } catch { /* this device still remembers */ }
    })();
  }, []);

  const unarchive = useCallback((keys: string[]) => {
    if (!keys.length) return;
    setArchived((current) => saveArchiveLocal(current.filter((key) => !keys.includes(key))));
    void (async () => {
      const userId = await currentUserId();
      if (!userId) return;
      try { await supabase.from("inbox_reads").delete().eq("user_id", userId).in("item_key", keys.map((key) => `${ARCHIVE_PREFIX}${key}`)); } catch { /* optional */ }
    })();
  }, []);

  const isArchived = useCallback((key: string) => archived.includes(key), [archived]);
  return { archived, isArchived, archive, unarchive };
}

/** Items moved to Archived, from this device's copy (kept in step with the server). */
export function archivedKeysNow(): Set<string> {
  if (typeof window === "undefined") return new Set();
  return new Set(loadArchiveLocal());
}

/** Items put off with Later that haven't come back yet, from this device's copy (kept in step with the server). */
export function laterKeysNow(): Set<string> {
  if (typeof window === "undefined") return new Set();
  const now = Date.now();
  return new Set(Object.entries(loadLaterLocal()).filter(([, until]) => Date.parse(until) > now).map(([key]) => key));
}

/**
 * The Inbox badge (sidebar and phone tab bar). The Inbox page sets it from exactly what it shows, so the badge and
 * "N need you" always agree; other pages fall back to the same rule (must-do items, not suggestions, not Later).
 */
export function publishNeedsYouCount(userId: string, count: number) {
  if (typeof window === "undefined" || !userId) return;
  try { window.sessionStorage.setItem(`lf:needs-you-count:${userId}`, JSON.stringify({ count, at: Date.now() })); } catch { /* optional */ }
  window.dispatchEvent(new CustomEvent("lf-needs-you-count", { detail: { userId, count } }));
}

export async function publishNeedsYouCountForCurrentUser(count: number) {
  const userId = await currentUserId();
  if (userId) publishNeedsYouCount(userId, count);
}
