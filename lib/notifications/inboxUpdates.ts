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

const READ_KEY = "lf:notification-events:read";

type EventRow = { id: string; event_type: string; created_at: string; payload?: Record<string, unknown> | null; contact_invitations?: { contact_name?: string | null } | null };

function loadLocalRead(): string[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(READ_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function saveLocalRead(ids: string[]) {
  const next = Array.from(new Set(ids)).slice(-300);
  try { window.localStorage.setItem(READ_KEY, JSON.stringify(next)); } catch { /* presentation state only */ }
  return next;
}

export function useInboxUpdates(enabled: boolean) {
  const [updates, setUpdates] = useState<Omit<InboxUpdate, "read">[]>([]);
  const [personIds, setPersonIds] = useState<string[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [cleared, setCleared] = useState<string[]>([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setReadIds(loadLocalRead());
      setCleared(loadClearedNotificationIds());
    });
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
      const alreadyRead = personal.filter((item) => item.readAt).map((item) => item.id);
      if (alreadyRead.length) setReadIds((current) => saveLocalRead([...current, ...alreadyRead]));
      setUpdates([...invitationUpdates, ...personUpdates].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  const markRead = useCallback((ids: string[]) => {
    if (!ids.length) return;
    void markPersonNotificationsRead(supabase, ids.filter((id) => personIds.includes(id)));
    setReadIds((current) => saveLocalRead([...current, ...ids]));
  }, [personIds]);

  const markUnread = useCallback((id: string) => {
    setReadIds((current) => saveLocalRead(current.filter((item) => item !== id)));
  }, []);

  const clear = useCallback((ids: string[]) => {
    if (!ids.length) return;
    void markPersonNotificationsRead(supabase, ids.filter((id) => personIds.includes(id)));
    setCleared((current) => clearNotificationIds(supabase, current, ids));
  }, [personIds]);

  const restore = useCallback((ids: string[]) => {
    setCleared((current) => restoreNotificationIds(supabase, current, ids));
  }, []);

  const visible: InboxUpdate[] = updates.filter((item) => !cleared.includes(item.id)).map((item) => ({ ...item, read: readIds.includes(item.id) }));
  return { updates: visible, loading, markRead, markUnread, clear, restore };
}

/** Actions the person has opened (dot turns to an outline). Presentation only: opening never completes an action. */
const SEEN_KEY = "lf:inbox:seen-actions";
export function loadSeenActions(): string[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
export function saveSeenActions(ids: string[]) {
  const next = Array.from(new Set(ids)).slice(-300);
  try { window.localStorage.setItem(SEEN_KEY, JSON.stringify(next)); } catch { /* presentation state only */ }
  return next;
}
