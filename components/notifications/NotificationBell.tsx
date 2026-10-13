"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Icon from "../ui/Icon";
import { supabase } from "../../lib/supabaseClient";
import { waitForActiveUser } from "../../lib/auth/session";

type NotificationEvent = {
  id: string;
  event_type: string;
  created_at: string;
  invitation_id?: string | null;
};

const READ_KEY = "lf:notification-events:read";

function eventCopy(event: NotificationEvent) {
  const type = event.event_type.toLowerCase();
  if (type.includes("accepted")) return { title: "Invitation accepted", detail: "A person accepted an invitation to your Fortress.", href: "/contacts" };
  if (type.includes("verified")) return { title: "Identity verified", detail: "An invited relationship completed identity verification.", href: "/contacts" };
  if (type.includes("access_revoked")) return { title: "Access removed", detail: "Shared living access was removed from a relationship.", href: "/access-sharing" };
  if (type.includes("access_updated")) return { title: "Access updated", detail: "Shared living access was updated for a relationship.", href: "/access-sharing" };
  if (type.includes("sent") || type.includes("invite")) return { title: "Invitation sent", detail: "An invitation was sent from your Fortress.", href: "/contacts" };
  return { title: "Fortress activity", detail: "A relationship or access event was recorded.", href: "/contacts" };
}

function relativeTime(value: string) {
  const age = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(age / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell({ ownerUserId, disabled = false }: { ownerUserId?: string | null; disabled?: boolean }) {
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(READ_KEY) ?? "[]");
      return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!ownerUserId || disabled) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const user = await waitForActiveUser(supabase, { attempts: 3, delayMs: 100 });
      if (!user || user.id !== ownerUserId) {
        if (!cancelled) setLoading(false);
        return;
      }
      const result = await supabase
        .from("invitation_events")
        .select("id,event_type,created_at,invitation_id")
        .eq("owner_user_id", ownerUserId)
        .order("created_at", { ascending: false })
        .limit(8);
      if (!cancelled) {
        setEvents((result.data ?? []) as NotificationEvent[]);
        setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [disabled, ownerUserId]);

  const visibleEvents = ownerUserId && !disabled ? events : [];
  const unreadCount = useMemo(() => visibleEvents.filter((event) => !readIds.includes(event.id)).length, [readIds, visibleEvents]);

  function markRead() {
    const next = Array.from(new Set([...readIds, ...visibleEvents.map((event) => event.id)])).slice(-80);
    setReadIds(next);
    try { window.sessionStorage.setItem(READ_KEY, JSON.stringify(next)); } catch { /* presentation state only */ }
  }

  return (
    <div className="lf-notification-control">
      <button
        type="button"
        className="lf-notification-trigger"
        aria-label={unreadCount ? `${unreadCount} unread notifications` : "Notifications"}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => { setOpen((current) => !current); if (!open) markRead(); }}
      >
        <Icon name="notifications" size={20} />
        {unreadCount ? <span className="lf-notification-count" aria-hidden="true">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
      </button>
      {open ? (
        <div className="lf-notification-sheet" role="dialog" aria-label="Notifications">
          <div className="lf-notification-sheet-header">
            <div><strong>Notifications</strong><span>Events from your Fortress</span></div>
            <button type="button" className="lf-icon-btn-round" aria-label="Close notifications" onClick={() => setOpen(false)}><Icon name="close" size={18} /></button>
          </div>
          {loading ? <p className="lf-notification-empty">Loading recent events…</p> : null}
          {!loading && !visibleEvents.length ? <p className="lf-notification-empty">Nothing new has happened yet.</p> : null}
          {!loading ? visibleEvents.map((event) => {
            const copy = eventCopy(event);
            return <Link key={event.id} href={copy.href} className="lf-notification-event" onClick={() => setOpen(false)}>
              <span className="lf-notification-event-icon"><Icon name="notifications_active" size={18} /></span>
              <span><strong>{copy.title}</strong><small>{copy.detail}</small><time dateTime={event.created_at}>{relativeTime(event.created_at)}</time></span>
              <Icon name="chevron_right" size={18} />
            </Link>;
          }) : null}
          {!loading && visibleEvents.length ? <Link href="/notifications" className="lf-notification-view-all" onClick={() => setOpen(false)}>View all notifications <Icon name="chevron_right" size={16} /></Link> : null}
        </div>
      ) : null}
    </div>
  );
}
