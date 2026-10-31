"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LFPageHeader } from "../../../components/ui/LFDesignSystem";
import Icon from "../../../components/ui/Icon";
import { waitForActiveUser } from "../../../lib/auth/session";
import { supabase } from "../../../lib/supabaseClient";
import { describePersonNotification, loadPersonNotifications, markPersonNotificationsRead } from "../../../lib/notifications/personNotifications";

type NotificationEvent = {
  id: string;
  event_type: string;
  created_at: string;
  invitation_id?: string | null;
  owner_name?: string | null;
  link?: string;
};

type Filter = "all" | "unread" | "security" | "people" | "records";

const READ_KEY = "lf:notification-events:read";

function describeEvent(event: NotificationEvent) {
  if (event.event_type.startsWith("person:")) {
    const item = describePersonNotification(event.event_type.slice(7), event.owner_name ?? null);
    return { ...item, href: event.link ?? "/notifications" };
  }
  const type = event.event_type.toLowerCase();
  if (type.includes("accepted")) return { title: "Invitation accepted", detail: "A person accepted an invitation to your Fortress.", group: "people", icon: "person_check", href: "/contacts" };
  if (type.includes("verified")) return { title: "Identity verified", detail: "An invited relationship completed identity verification.", group: "people", icon: "verified_user", href: "/contacts" };
  if (type.includes("access")) return { title: "Access updated", detail: "Shared living access was changed for a relationship.", group: "people", icon: "key", href: "/access-sharing" };
  if (type.includes("record") || type.includes("asset")) return { title: "Record updated", detail: "A record in your Fortress was changed.", group: "records", icon: "description", href: "/dashboard" };
  if (type.includes("sign") || type.includes("security")) return { title: "Security event", detail: "A security event was recorded on your account.", group: "security", icon: "shield", href: "/account/security" };
  if (type.includes("sent") || type.includes("invite")) return { title: "Invitation sent", detail: "An invitation was sent from your Fortress.", group: "people", icon: "send", href: "/contacts" };
  return { title: "Fortress activity", detail: "A relationship or access event was recorded.", group: "people", icon: "notifications_active", href: "/contacts" };
}

function formatEventTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function NotificationsPage() {
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  useEffect(() => {
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(READ_KEY) ?? "[]");
      if (Array.isArray(stored)) setReadIds(stored.filter((value): value is string => typeof value === "string"));
    } catch { /* presentation state only */ }

    let cancelled = false;
    async function load() {
      const user = await waitForActiveUser(supabase, { attempts: 3, delayMs: 100 });
      if (!user) {
        if (!cancelled) { setStatus("Sign in to view your notifications."); setLoading(false); }
        return;
      }
      const [result, personal] = await Promise.all([
        supabase.from("invitation_events").select("id,event_type,created_at,invitation_id").eq("owner_user_id", user.id).order("created_at", { ascending: false }).limit(50),
        loadPersonNotifications(supabase),
      ]);
      if (cancelled) return;
      if (result.error) setStatus("Notifications are temporarily unavailable.");
      const merged: NotificationEvent[] = [
        ...((result.data ?? []) as NotificationEvent[]),
        ...personal.map((item) => ({ id: item.id, event_type: `person:${item.kind}`, created_at: item.createdAt, owner_name: item.ownerName, link: item.link })),
      ].sort((a, b) => b.created_at.localeCompare(a.created_at));
      setEvents(merged);
      const alreadyRead = personal.filter((item) => item.readAt).map((item) => item.id);
      if (alreadyRead.length) setReadIds((current) => Array.from(new Set([...current, ...alreadyRead])));
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => events.filter((event) => {
    const item = describeEvent(event);
    return filter === "all" || (filter === "unread" ? !readIds.includes(event.id) : item.group === filter);
  }), [events, filter, readIds]);
  const selected = filtered.find((event) => event.id === selectedId) ?? filtered[0] ?? null;

  function markRead(id: string) {
    void markPersonNotificationsRead(supabase, [id]);
    const next = Array.from(new Set([...readIds, id])).slice(-100);
    setReadIds(next);
    try { window.sessionStorage.setItem(READ_KEY, JSON.stringify(next)); } catch { /* presentation state only */ }
  }

  function markAllRead() {
    void markPersonNotificationsRead(supabase, events.filter((event) => event.event_type.startsWith("person:")).map((event) => event.id));
    const next = Array.from(new Set([...readIds, ...events.map((event) => event.id)])).slice(-100);
    setReadIds(next);
    try { window.sessionStorage.setItem(READ_KEY, JSON.stringify(next)); } catch { /* presentation state only */ }
  }

  return (
    <div className="lf-notifications-page">
      <LFPageHeader title="Notifications" description="Changes to your Fortress, people and security." />
      <div className="lf-notifications-toolbar">
        <div className="lf-filter-chips" aria-label="Notification filters">
          {(["all", "unread", "security", "people", "records"] as Filter[]).map((value) => (
            <button key={value} type="button" className={`lf-filter-chip${filter === value ? " is-active" : ""}`} onClick={() => setFilter(value)}>
              {value[0].toUpperCase() + value.slice(1)}{value === "unread" ? ` · ${events.filter((event) => !readIds.includes(event.id)).length}` : ""}
            </button>
          ))}
        </div>
        <button type="button" className="lf-ui-button lf-ui-button-text" onClick={markAllRead}>Mark all read</button>
      </div>
      {status ? <div className="lf-inline-status" role="status">{status}</div> : null}
      {loading ? <div className="lf-notification-empty">Loading notifications…</div> : null}
      {!loading && !events.length ? <div className="lf-notifications-empty-state"><Icon name="done_all" size={28} /><strong>You&apos;re all caught up</strong><span>Events from your Fortress will appear here.</span></div> : null}
      {!loading && events.length ? (
        <div className="lf-notifications-layout">
          <section className="lf-notifications-list" aria-label="Notification events">
            {!filtered.length ? <div className="lf-notification-empty">No notifications match this filter.</div> : null}
            {filtered.map((event) => {
              const item = describeEvent(event);
              const unread = !readIds.includes(event.id);
              return <button key={event.id} type="button" className={`lf-notification-row${selected?.id === event.id ? " is-selected" : ""}`} onClick={() => { setSelectedId(event.id); markRead(event.id); }}>
                <span className="lf-notification-event-icon"><Icon name={item.icon} size={20} /></span>
                <span className="lf-notification-row-copy"><strong className={unread ? "is-unread" : ""}>{item.title}</strong><small>{item.detail}</small><time>{formatEventTime(event.created_at)}</time></span>
                {unread ? <span className="lf-notification-unread-dot" aria-label="Unread" /> : null}
              </button>;
            })}
          </section>
          {selected ? (() => { const item = describeEvent(selected); return <aside className="lf-notification-detail"><span className="lf-notification-detail-icon"><Icon name={item.icon} size={24} /></span><h2>{item.title}</h2><p>{item.detail}</p><dl><div><dt>When</dt><dd>{formatEventTime(selected.created_at)}</dd></div>{selected.event_type.startsWith("person:") ? null : <div><dt>Event</dt><dd>{selected.event_type}</dd></div>}</dl><Link href={item.href} className="lf-ui-button lf-ui-button-secondary">Open related area <Icon name="chevron_right" size={18} /></Link></aside>; })() : null}
        </div>
      ) : null}
    </div>
  );
}
