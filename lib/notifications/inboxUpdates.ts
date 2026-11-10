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
export type InboxUpdate = { id: string; title: string; detail: string; href: string; createdAt: string; read: boolean };

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

async function persistReads(keys: string[]) {
  const userId = await currentUserId();
  const rows = keys.filter((key) => key && key.length <= 200).map((item_key) => ({ user_id: userId, item_key }));
  if (!userId || !rows.length) return;
  try { await supabase.from("inbox_reads").upsert(rows, { onConflict: "user_id,item_key", ignoreDuplicates: true }); } catch { /* this device still remembers */ }
}

async function forgetRead(key: string) {
  const userId = await currentUserId();
  if (!userId) return;
  try { await supabase.from("inbox_reads").delete().eq("user_id", userId).eq("item_key", key); } catch { /* this device still remembers */ }
}

/** This device's list merged with what was read on other devices. */
async function syncReads(): Promise<string[]> {
  const local = loadLocalRead();
  try {
    const { data, error } = await supabase.from("inbox_reads").select("item_key").order("read_at", { ascending: false }).limit(1000);
    if (error) return local;
    const remote = ((data ?? []) as Array<{ item_key: string }>).map((row) => String(row.item_key));
    const missingRemotely = local.filter((key) => !remote.includes(key));
    if (missingRemotely.length) void persistReads(missingRemotely);
    return saveLocalRead([...local, ...remote]);
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
    setRead((current) => {
      const fresh = keys.filter((key) => !current.includes(key));
      if (fresh.length) void persistReads(fresh);
      return saveLocalRead([...current, ...keys]);
    });
  }, []);
  const markUnread = useCallback((key: string) => {
    void forgetRead(key);
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
        return { id: event.id, title: copy.title, detail: copy.detail, href: copy.kind === "access" ? "/access-sharing" : "/people-access?view=people", createdAt: event.created_at };
      });
      const personUpdates = personal.map((item) => {
        const copy = describePersonNotification(item.kind, item.ownerName ?? null);
        return { id: item.id, title: titleWithRecord(item.kind, copy.title, item.link, labels), detail: copy.detail, href: item.link ?? "/actions", createdAt: item.createdAt };
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
